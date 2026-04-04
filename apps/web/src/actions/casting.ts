'use server';

/**
 * Hands Free â€” Media Casting (SSDP / DLNA / UPnP)
 *
 * Uses `node-ssdp` (pure Node.js) for device discovery.
 * Uses raw HTTP for UPnP AVTransport SOAP commands.
 *
 * Supports:
 *   - SSDP M-SEARCH discovery of DLNA/UPnP renderers on LAN
 *   - Unicast port-scan fallback (bypasses AP-band-isolation / multicast blocking)
 *   - Play, Pause, Stop, Seek, Set Volume on discovered devices
 *   - Cast any HTTP-accessible media URL to a DLNA renderer
 *
 * No native binaries required.
 */

import http from 'http';
import net  from 'net';
import os   from 'os';

// â”€â”€â”€ Network helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const VIRTUAL_PATTERNS = [
    'tailscale', 'tun', 'utun', 'loopback', 'lo0', 'vmnet', 'vboxnet', 'virbr',
    'docker', 'br-', 'veth', 'zerotier', 'wireguard', 'wg', 'openvpn', 'tap',
    'ppp', 'hyperv', 'hyper-v', 'wsl', 'vpn', 'nordvpn', 'mullvad', 'proton',
    'npcap', 'nmap', 'pseudo', 'virtual', 'bluetooth',
];

/**
 * Get ALL external IPv4 addresses (one per physical NIC), skipping loopback
 * and virtual adapters.  Returns IPs sorted by likelihood of being the real
 * home LAN interface: 192.168.x.x first, then 10.x.x.x, then others.
 * This ensures SSDP multicast and unicast scans prefer the correct interface.
 */
function getAllExternalIpv4(): string[] {
    const result: string[] = [];
    for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
        if (!addrs) continue;
        const lname = name.toLowerCase();
        if (VIRTUAL_PATTERNS.some(p => lname.includes(p))) continue;
        for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) result.push(addr.address);
        }
    }
    // Sort: 192.168.x.x first (typical home LAN), then 10.x.x.x, then others
    return result.sort((a, b) => {
        const score = (ip: string) => {
            if (ip.startsWith('192.168.')) return 0;
            if (ip.startsWith('10.'))     return 1;
            if (ip.startsWith('172.'))    return 2;
            return 3;
        };
        return score(a) - score(b);
    });
}

/**
 * Select IPs to use for LAN scanning â€” returns ALL valid IPs sorted by
 * preference (home LAN first, then class A). Does NOT exclude any subnet
 * because DLNA devices might live on a different subnet than the primary LAN
 * (e.g. TVs on 192.168.31.x while a VPN adds 10.5.0.x â€” both must be scanned).
 */
function getLanScanIps(allIps: string[]): string[] {
    const prefOrder = (ip: string): number => {
        if (ip.startsWith('192.168.')) return 0;  // Home LAN first
        if (ip.startsWith('10.'))     return 1;  // Class A second
        if (ip.startsWith('172.'))    return 2;  // Class B third
        return 3;
    };
    return [...allIps].sort((a, b) => prefOrder(a) - prefOrder(b));
}

/**
 * Derive the /24 subnet base from an IP (e.g. "192.168.1.55" â†’ "192.168.1").
 */
function subnetBase(ip: string): string {
    return ip.split('.').slice(0, 3).join('.');
}

/** Common UPnP/DLNA port numbers to probe when multicast fails.
 *  Covers: Samsung (7676, 9197, 52235), LG (1048, 8060), Sony (52323, 52325),
 *  Hisense (56789, 8008), generic UPnP (2869, 8200, 49152-49154), Kodi (8080) */
const UPNP_PROBE_PORTS = [
    1400,  // UPnP / Samsung
    2869,  // Windows SSDP responder / UPnP
    7676,  // Samsung AllShare / SmartThings
    8008,  // Chromecast / Hisense / generic HTTP
    8060,  // LG Netcast / Roku
    8080,  // Kodi / generic HTTP
    8200,  // MediaTomb / MiniDLNA
    9197,  // Samsung Smart TV
    52235, // Samsung AllShare
    52323, // Sony Bravia AVTransport
    52325, // Sony Bravia RenderingControl
    56789, // Hisense DLNA
    49152, // UPnP dynamic (most common)
    49153,
    49154,
    1048,  // LG Smart TV
];

/** Common UPnP device description paths (tried in order on each open port). */
const UPNP_DESC_PATHS = [
    '/rootDesc.xml',
    '/description.xml',
    '/DeviceDescription.xml',
    '/upnp/BasicDevice.xml',
    '/dmr/DMRDescription.xml',
    '/',
];

/**
 * Quick TCP connect probe to a host:port.
 * Resolves true if the port is open within timeoutMs, false otherwise.
 * Default timeout 600ms â€” real UPnP devices respond in <200ms; 600ms accounts
 * for cross-band WiFi routing latency without making full scans take 60+ seconds.
 */
function tcpProbe(ip: string, port: number, timeoutMs = 600): Promise<boolean> {
    return new Promise(resolve => {
        const sock = new net.Socket();
        sock.setTimeout(timeoutMs);
        sock.once('connect', () => { sock.destroy(); resolve(true);  });
        sock.once('timeout',  () => { sock.destroy(); resolve(false); });
        sock.once('error',    () => { sock.destroy(); resolve(false); });
        sock.connect(port, ip);
    });
}

/**
 * Attempt to fetch a UPnP device description from ip:port.
 * Returns a CastDevice if a valid description with AVTransport is found.
 */
async function probeUpnpDevice(ip: string, port: number): Promise<CastDevice | null> {
    for (const path of UPNP_DESC_PATHS) {
        const url = `http://${ip}:${port}${path}`;
        try {
            const xml = await httpGetTimeout(url, 2000);
            if (!xml.includes('AVTransport') && !xml.includes('MediaRenderer') && !xml.includes('friendlyName')) continue;

            const nameMatch  = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
            const usnMatch   = xml.match(/<UDN>([^<]+)<\/UDN>/i);
            const name       = nameMatch?.[1]?.trim() ?? `Device ${ip}`;
            const id         = (usnMatch?.[1] ?? `${ip}:${port}`).replace('uuid:', '');

            return { id, name, location: url, type: 'unicast-probe', ip, port };
        } catch { /* try next path */ }
    }
    return null;
}

/**
 * Unicast fallback discovery: scan the local /24 subnet on common UPnP ports.
 * This works even when the router blocks SSDP multicast between WiFi bands
 * (AP isolation / band steering issues).
 *
 * Concurrency is capped to avoid flooding the LAN.
 */
async function discoverByUnicastScan(
    localIps: string[],
    progressCb?: (found: CastDevice) => void,
): Promise<CastDevice[]> {
    if (localIps.length === 0) return [];

    // Derive all unique /24 subnets to scan
    const subnets = [...new Set(localIps.map(subnetBase))];
    const tasks: Array<() => Promise<CastDevice | null>> = [];

    for (const subnet of subnets) {
        for (let host = 1; host <= 254; host++) {
            const ip = `${subnet}.${host}`;
            // Skip own IPs
            if (localIps.includes(ip)) continue;
            for (const port of UPNP_PROBE_PORTS) {
                tasks.push(async () => {
                    const open = await tcpProbe(ip, port);
                    if (!open) return null;
                    const device = await probeUpnpDevice(ip, port);
                    if (device) progressCb?.(device);
                    return device;
                });
            }
        }
    }

    // Run with concurrency limit of 80
    const CONCURRENCY = 80;
    const found: CastDevice[] = [];
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
        const batch = tasks.slice(i, i + CONCURRENCY).map(fn => fn());
        const results = await Promise.all(batch);
        for (const r of results) {
            if (r) found.push(r);
        }
    }

    // Deduplicate by id
    const seen = new Set<string>();
    return found.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CastDevice {
    id:           string;   // UUID from USN header
    name:         string;
    location:     string;   // LOCATION header â€” URL to device description XML
    type:         string;   // NT / ST header
    ip:           string;
    port:         number;
    controlUrl?:  string;   // AVTransport control URL (filled after parseDevice)
    services?:    string[]; // Available UPnP services
}

export interface CastResult {
    success: boolean;
    error?:  string;
    data?:   any;
}

// â”€â”€â”€ SSDP Discovery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SSDP_SEARCH_TARGETS = [
    'urn:schemas-upnp-org:device:MediaRenderer:1',
    'urn:schemas-upnp-org:service:AVTransport:1',
    'ssdp:all',
];

/**
 * Discover DLNA/UPnP media renderers on the local network.
 *
 * Strategy (two-phase):
 *
 * Phase 1 â€” SSDP Multicast (fast, 5â€“10 s)
 *   Sends M-SEARCH on EVERY physical NIC simultaneously (not just the first one),
 *   so it works on dual-band machines where the active WiFi adapter might not be
 *   the one that was returned by the old single-interface lookup.
 *
 * Phase 2 â€” Unicast Port-Scan Fallback (triggered when Phase 1 finds nothing)
 *   Scans the local /24 subnet on common UPnP ports (1400, 2869, 8008 â€¦).
 *   This bypasses AP-isolation / band-steering issues where the router silently
 *   drops SSDP multicast between the 2.4 GHz and 5 GHz bands.  Because TCP
 *   unicast always crosses bands on the same subnet, this always finds devices
 *   even with multicast blocked.
 */
export async function discoverCastDevices(options?: {
    timeoutMs?: number;
    searchTarget?: string;
    unicastFallback?: boolean; // default true
}): Promise<{ success: boolean; devices?: CastDevice[]; error?: string; debug?: string }> {
    const timeoutMs       = options?.timeoutMs ?? 10_000;
    const useUnicast      = options?.unicastFallback !== false; // default: true
    const targets         = options?.searchTarget
        ? [options.searchTarget]
        : SSDP_SEARCH_TARGETS;

    const externalIps  = getAllExternalIpv4();
    const debugLines: string[] = [`Local IPs: ${externalIps.join(', ') || 'none found'}`];

    // â”€â”€ Phase 1: SSDP multicast on all physical NICs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const ssdpDevices = await new Promise<CastDevice[]>((resolve) => {
        let SSDPClient: any;
        try {
            // Use eval('require') to bypass webpack's __webpack_require__ interception.
            // node-ssdp is a native Node.js module using dgram (UDP) â€” webpack cannot
            // bundle it, so we must use the real Node.js require at runtime.
            // eslint-disable-next-line no-eval
            const nativeRequire: NodeRequire = eval('require');
            SSDPClient = nativeRequire('node-ssdp').Client;
        } catch (e) {
            console.error('[DLNA] Failed to load node-ssdp:', e);
            resolve([]);
            return;
        }

        const allDevices = new Map<string, CastDevice>();
        const clients: any[] = [];
        let done = false;

        const finish = () => {
            if (done) return;
            done = true;
            for (const c of clients) { try { c.stop(); } catch { /* ignore */ } }
            resolve(Array.from(allDevices.values()));
        };

        const handleResponse = (headers: Record<string, string>) => {
            const location = headers.LOCATION ?? headers.location ?? '';
            const usn      = headers.USN      ?? headers.usn      ?? '';
            const server   = headers.SERVER   ?? headers.server   ?? '';
            const st       = headers.ST       ?? headers.st       ?? '';
            if (!location) return;
            try {
                const url  = new URL(location);
                const id   = usn.split('::')[0].replace('uuid:', '') || usn;
                const ip   = url.hostname;
                const port = Number(url.port) || 80;
                if (!allDevices.has(id)) {
                    allDevices.set(id, { id, name: server || `Device ${ip}`, location, type: st, ip, port });
                }
            } catch { /* malformed LOCATION URL */ }
        };

        // Spawn one SSDP client per physical NIC so multicast goes out on every interface.
        // This is the key fix for systems with multiple adapters or dual-band routers that
        // only forward multicast on the interface the packet arrived on.
        const bindIps = externalIps.length > 0 ? externalIps : [undefined as unknown as string];
        for (const ip of bindIps) {
            try {
                const opts: Record<string, any> = { explicitSocketBind: true };
                if (ip) {
                    opts.ssdpIp     = '239.255.255.250';
                    opts.sourcePort = 0;
                    opts.interfaces = [ip];
                }
                const client = new SSDPClient(opts);
                client.on('response', handleResponse);
                clients.push(client);

                let delay = 0;
                for (const target of targets) {
                    setTimeout(() => {
                        try { client.search(target); } catch { /* ignore */ }
                    }, delay);
                    delay += 200;
                }
            } catch { /* skip broken NIC */ }
        }

        if (clients.length === 0) { resolve([]); return; }
        setTimeout(finish, timeoutMs);
    });

    debugLines.push(`SSDP found: ${ssdpDevices.length} device(s) on ${externalIps.length || 1} interface(s)`);

    // â”€â”€ Phase 2: Unicast fallback if multicast returned nothing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let unicastDevices: CastDevice[] = [];
    if (useUnicast && ssdpDevices.length === 0 && externalIps.length > 0) {
        // Use only the most likely home LAN IPs (e.g. 192.168.x.x) to avoid
        // wasting time scanning VPN/Docker/WSL subnets like 10.5.0.x.
        const lanIps = getLanScanIps(externalIps);
        debugLines.push(`SSDP found nothing â€” unicast /24 scan on ${lanIps.join(', ')}â€¦`);
        unicastDevices = await discoverByUnicastScan(lanIps);
        debugLines.push(`Unicast scan found: ${unicastDevices.length} device(s)`);
    }

    // Merge & deduplicate
    const seen    = new Set<string>();
    const merged: CastDevice[] = [];
    for (const d of [...ssdpDevices, ...unicastDevices]) {
        if (!seen.has(d.id)) { seen.add(d.id); merged.push(d); }
    }

    return {
        success: true,
        devices: merged,
        debug:   debugLines.join(' | '),
    };
}

// â”€â”€â”€ Device Description Parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Fetch and parse UPnP device description XML to extract:
 *   - Friendly name
 *   - AVTransport control URL
 *   - Available services
 */
export async function parseDeviceDescription(location: string): Promise<{
    success:    boolean;
    name?:      string;
    controlUrl?: string;
    services?:  string[];
    error?:     string;
}> {
    try {
        const xml = await httpGet(location);

        // Extract friendly name
        const nameMatch = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
        const name      = nameMatch?.[1]?.trim() ?? 'Unknown Device';

        // Find AVTransport service
        const services: string[] = [];
        const serviceTypeRe     = /<serviceType>([^<]+)<\/serviceType>/gi;
        const controlUrlRe      = /<controlURL>([^<]+)<\/controlURL>/gi;

        let stMatch: RegExpExecArray | null;
        while ((stMatch = serviceTypeRe.exec(xml)) !== null) {
            services.push(stMatch[1]);
        }

        // Find AVTransport control URL
        let controlUrl: string | undefined;
        const baseUrl   = new URL(location);
        const ctMatches = [...xml.matchAll(/<controlURL>([^<]+)<\/controlURL>/gi)];

        // Match AVTransport specifically by looking for it near the serviceType
        const avIndex = xml.search(/urn:schemas-upnp-org:service:AVTransport/i);
        if (avIndex !== -1) {
            const slice = xml.slice(avIndex);
            const ctm   = slice.match(/<controlURL>([^<]+)<\/controlURL>/i);
            if (ctm) {
                const raw = ctm[1].trim();
                controlUrl = raw.startsWith('http') ? raw : `${baseUrl.protocol}//${baseUrl.host}${raw.startsWith('/') ? '' : '/'}${raw}`;
            }
        }

        return { success: true, name, controlUrl, services };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ UPnP AVTransport SOAP Commands â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function soapEnvelope(action: string, serviceType: string, args: string): string {
    return `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
            s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="${serviceType}">${args}</u:${action}>
  </s:Body>
</s:Envelope>`;
}

async function sendSoapCommand(controlUrl: string, action: string, args: string): Promise<CastResult> {
    const serviceType = 'urn:schemas-upnp-org:service:AVTransport:1';
    const body        = soapEnvelope(action, serviceType, args);

    try {
        const responseXml = await httpPost(controlUrl, body, {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction':   `"${serviceType}#${action}"`,
        });

        // Check for UPnP fault
        if (responseXml.includes('<s:Fault>')) {
            const faultMatch = responseXml.match(/<errorDescription>([^<]+)<\/errorDescription>/i);
            return { success: false, error: faultMatch?.[1] ?? 'UPnP SOAP fault' };
        }

        return { success: true, data: responseXml };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Cast (play) a media URL on a DLNA renderer.
 */
export async function castMedia(options: {
    controlUrl: string;
    mediaUrl:   string;
    mimeType?:  string;
    title?:     string;
}): Promise<CastResult> {
    const mime  = options.mimeType ?? 'video/mp4';
    const title = options.title    ?? 'Hands Free Media';

    // Metadata â€” minimal DIDL-Lite (XML-escaped for embedding inside SOAP envelope)
    const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const didl = `&lt;DIDL-Lite xmlns=&quot;urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/&quot;`
        + ` xmlns:dc=&quot;http://purl.org/dc/elements/1.1/&quot;`
        + ` xmlns:upnp=&quot;urn:schemas-upnp-org:metadata-1-0/upnp/&quot;&gt;`
        + `&lt;item id=&quot;1&quot; parentID=&quot;0&quot; restricted=&quot;1&quot;&gt;`
        + `&lt;dc:title&gt;${escXml(title)}&lt;/dc:title&gt;`
        + `&lt;upnp:class&gt;object.item.videoItem&lt;/upnp:class&gt;`
        + `&lt;res protocolInfo=&quot;http-get:*:${escXml(mime)}:*&quot;&gt;${escXml(options.mediaUrl)}&lt;/res&gt;`
        + `&lt;/item&gt;`
        + `&lt;/DIDL-Lite&gt;`;

    // Step 1: SetAVTransportURI
    const setResult = await sendSoapCommand(options.controlUrl, 'SetAVTransportURI', `
        <InstanceID>0</InstanceID>
        <CurrentURI>${options.mediaUrl}</CurrentURI>
        <CurrentURIMetaData>${didl}</CurrentURIMetaData>
    `);
    if (!setResult.success) return setResult;

    // Step 2: Play
    return sendSoapCommand(options.controlUrl, 'Play', `
        <InstanceID>0</InstanceID>
        <Speed>1</Speed>
    `);
}

/**
 * Pause playback on a DLNA renderer.
 */
export async function pauseCasting(controlUrl: string): Promise<CastResult> {
    return sendSoapCommand(controlUrl, 'Pause', '<InstanceID>0</InstanceID>');
}

/**
 * Stop playback on a DLNA renderer.
 */
export async function stopCasting(controlUrl: string): Promise<CastResult> {
    return sendSoapCommand(controlUrl, 'Stop', '<InstanceID>0</InstanceID>');
}

/**
 * Seek to a position on a DLNA renderer.
 * @param position HH:MM:SS format
 */
export async function seekCasting(controlUrl: string, position: string): Promise<CastResult> {
    return sendSoapCommand(controlUrl, 'Seek', `
        <InstanceID>0</InstanceID>
        <Unit>REL_TIME</Unit>
        <Target>${position}</Target>
    `);
}

/**
 * Set volume on a DLNA renderer (0â€“100).
 * Uses RenderingControl service â€” requires a separate controlUrl for RenderingControl.
 */
export async function setVolume(options: {
    controlUrl: string;
    volume: number; // 0â€“100
}): Promise<CastResult> {
    const vol = Math.max(0, Math.min(100, Math.round(options.volume)));
    const serviceType = 'urn:schemas-upnp-org:service:RenderingControl:1';
    const body = soapEnvelope('SetVolume', serviceType, `
        <InstanceID>0</InstanceID>
        <Channel>Master</Channel>
        <DesiredVolume>${vol}</DesiredVolume>
    `);
    try {
        await httpPost(options.controlUrl, body, {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPAction':   `"${serviceType}#SetVolume"`,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Get current transport info (state: PLAYING, PAUSED_PLAYBACK, STOPPED, etc.)
 */
export async function getTransportInfo(controlUrl: string): Promise<CastResult> {
    const result = await sendSoapCommand(controlUrl, 'GetTransportInfo', '<InstanceID>0</InstanceID>');
    if (!result.success) return result;

    const stateMatch = (result.data as string).match(/<CurrentTransportState>([^<]+)<\/CurrentTransportState>/i);
    return { success: true, data: { state: stateMatch?.[1] ?? 'UNKNOWN', raw: result.data } };
}

// â”€â”€â”€ HTTP Helpers (pure Node.js, no fetch) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function httpGet(url: string): Promise<string> {
    return httpGetTimeout(url, 5000);
}

/** httpGet with a configurable timeout (ms).  Used by the unicast probe. */
function httpGetTimeout(url: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end',  () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(timeoutMs, () => { req.destroy(new Error('HTTP GET timeout')); });
    });
}

function httpPost(url: string, body: string, headers: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
            hostname: parsed.hostname,
            port:     Number(parsed.port) || 80,
            path:     parsed.pathname + parsed.search,
            method:   'POST',
            headers:  { ...headers, 'Content-Length': Buffer.byteLength(body) },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end',  () => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
                } else {
                    resolve(data);
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(8000, () => { req.destroy(new Error('HTTP POST timeout')); });
        req.write(body);
        req.end();
    });
}
