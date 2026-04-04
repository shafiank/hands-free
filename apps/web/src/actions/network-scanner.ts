'use server';

/**
 * Hands Free Ã¢â‚¬â€ Network Scanner
 *
 * Uses Node.js native `net` module for TCP port scanning Ã¢â‚¬â€ zero npm dependencies.
 *
 * Features:
 *   - Local subnet discovery (detect all live IPs on the LAN)
 *   - Port scanning with common-port presets
 *   - Automatic detection of other Hands Free instances (port 3000)
 *   - Service name identification
 *
 * No shell commands (nmap, ping, etc.) Ã¢â‚¬â€ pure Node.js net.connect().
 */

import net  from 'net';
import os   from 'os';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface ScanPort {
    port:    number;
    open:    boolean;
    service: string;
}

export interface ScanHost {
    ip:       string;
    ports:    ScanPort[];
    isHandsFree: boolean;  // true if port 3000 is open
    latencyMs?: number;
}

export interface ScanResult {
    success:    boolean;
    localIp?:   string;
    subnet?:    string;
    hosts?:     ScanHost[];
    handsfreeInstances?: ScanHost[];
    scanned?:   number;
    elapsed?:   number;
    error?:     string;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Well-known port names Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const PORT_NAMES: Record<number, string> = {
    21:    'FTP',
    22:    'SSH',
    23:    'Telnet',
    25:    'SMTP',
    53:    'DNS',
    80:    'HTTP',
    110:   'POP3',
    143:   'IMAP',
    443:   'HTTPS',
    445:   'SMB',
    548:   'AFP',
    554:   'RTSP',
    993:   'IMAPS',
    1883:  'MQTT',
    3000:  'Hands Free / Node App',
    3306:  'MySQL',
    3389:  'RDP',
    4000:  'Alt HTTP',
    5000:  'UPnP / Alt HTTP',
    5432:  'PostgreSQL',
    5900:  'VNC',
    6379:  'Redis',
    7000:  'Alt HTTP',
    8080:  'HTTP Alt',
    8443:  'HTTPS Alt',
    8888:  'Jupyter',
    9090:  'Prometheus',
    9100:  'Printer',
    27017: 'MongoDB',
};

const DEFAULT_PORTS = [22, 80, 443, 3000, 3306, 5000, 8080, 8443];
const HANDSFREE_PORT   = 3000;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/**
 * Attempt TCP connect to ip:port. Returns true if connection succeeds.
 */
function probePort(ip: string, port: number, timeoutMs = 800): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;

        const done = (result: boolean) => {
            if (resolved) return;
            resolved = true;
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(timeoutMs);
        socket.on('connect', () => done(true));
        socket.on('timeout', () => done(false));
        socket.on('error',   () => done(false));

        try {
            socket.connect(port, ip);
        } catch {
            done(false);
        }
    });
}

/**
 * Get the primary local IP and derive the /24 subnet base.
 * e.g. "192.168.1.42" Ã¢â€ â€™ { localIp: "192.168.1.42", base: "192.168.1" }
 */
function getLocalNetwork(): { localIp: string; base: string } | null {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        if (!iface) continue;
        for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                const parts = addr.address.split('.');
                return {
                    localIp: addr.address,
                    base:    parts.slice(0, 3).join('.'),
                };
            }
        }
    }
    return null;
}

/**
 * Verify a host on port 3000 is actually a Hands Free instance via /api/health.
 * Just checking if port 3000 is open is not specific enough (any Node app uses 3000).
 */
async function verifyHandsFreeInstance(ip: string, timeoutMs: number): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timer      = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(`http://${ip}:${HANDSFREE_PORT}/api/health`, {
            signal:  controller.signal,
            headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);
        if (!res.ok) return false;
        const data = await res.json();
        return data?.handsfree === true;
    } catch {
        return false;
    }
}

/**
 * Scan a single IP for the given ports.
 */
async function scanHost(ip: string, ports: number[], timeoutMs: number): Promise<ScanHost> {
    const start = Date.now();

    // Probe port 80 AND 3000 in PARALLEL Ã¢â‚¬â€ previously sequential which missed
    // hosts where port 80 was closed but 3000 was open (typical Hands Free setup).
    const [liveness80, liveness3000] = await Promise.all([
        probePort(ip, 80, timeoutMs),
        probePort(ip, HANDSFREE_PORT, timeoutMs),
    ]);

    if (!liveness80 && !liveness3000) {
        // Fast-fail Ã¢â‚¬â€ no response on either probe port
        return { ip, ports: [], isHandsFree: false };
    }

    // Full port scan Ã¢â‚¬â€ use cached results for already-probed ports
    const results = await Promise.all(
        ports.map(async (port) => {
            if (port === 80)          return { port, open: liveness80,   service: PORT_NAMES[port] ?? `Port ${port}` };
            if (port === HANDSFREE_PORT) return { port, open: liveness3000, service: PORT_NAMES[port] ?? `Port ${port}` };
            const open = await probePort(ip, port, timeoutMs);
            return { port, open, service: PORT_NAMES[port] ?? `Port ${port}` };
        }),
    );

    const openPorts = results.filter((r) => r.open);
    const latencyMs = Date.now() - start;

    // Verify via /api/health Ã¢â‚¬â€ not just port 3000 being open (any Node app uses port 3000)
    let isHandsFree = false;
    if (liveness3000) {
        isHandsFree = await verifyHandsFreeInstance(ip, Math.min(timeoutMs * 2, 3000));
    }

    return { ip, ports: openPorts, isHandsFree, latencyMs };
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Exported actions Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

/**
 * Scan the local /24 subnet for live hosts and open ports.
 *
 * @param options.ports      Ports to check per host (default: common set + 3000)
 * @param options.timeout    Per-connection timeout ms (default 800)
 * @param options.concurrency Max simultaneous host scans (default 20)
 * @param options.startHost  First host number in .1Ã¢â‚¬â€œ.254 range (default 1)
 * @param options.endHost    Last  host number in .1Ã¢â‚¬â€œ.254 range (default 254)
 */
export async function scanLocalNetwork(options?: {
    ports?:       number[];
    timeout?:     number;
    concurrency?: number;
    startHost?:   number;
    endHost?:     number;
}): Promise<ScanResult> {
    const startTime   = Date.now();
    const ports       = options?.ports       ?? DEFAULT_PORTS;
    const timeoutMs   = options?.timeout     ?? 800;
    const concurrency = options?.concurrency ?? 20;
    const startHost   = options?.startHost   ?? 1;
    const endHost     = options?.endHost     ?? 254;

    const net_ = getLocalNetwork();
    if (!net_) {
        return { success: false, error: 'Could not determine local network interface.' };
    }

    const { localIp, base } = net_;
    const allIps = Array.from(
        { length: endHost - startHost + 1 },
        (_, i) => `${base}.${startHost + i}`,
    ).filter((ip) => ip !== localIp); // Skip our own IP

    const hosts: ScanHost[] = [];

    // Process in batches of `concurrency`
    for (let i = 0; i < allIps.length; i += concurrency) {
        const batch   = allIps.slice(i, i + concurrency);
        const results = await Promise.all(batch.map((ip) => scanHost(ip, ports, timeoutMs)));
        hosts.push(...results.filter((h) => h.ports.length > 0));
    }

    const handsfreeInstances = hosts.filter((h) => h.isHandsFree);

    return {
        success:         true,
        localIp,
        subnet:          `${base}.0/24`,
        hosts:           hosts.sort((a, b) => {
            const [, lastA] = a.ip.split('.').slice(-1).map(Number);
            const [, lastB] = b.ip.split('.').slice(-1).map(Number);
            return lastA - lastB;
        }),
        handsfreeInstances,
        scanned:         allIps.length,
        elapsed:         Date.now() - startTime,
    };
}

/**
 * Quick scan Ã¢â‚¬â€ only checks for other Hands Free instances (port 3000).
 * Much faster than a full subnet scan.
 */
export async function findHandsFreeInstances(options?: {
    timeout?:     number;
    concurrency?: number;
}): Promise<ScanResult> {
    return scanLocalNetwork({
        ports:       [HANDSFREE_PORT],
        timeout:     options?.timeout     ?? 600,
        concurrency: options?.concurrency ?? 30,
    });
}

/**
 * Scan a specific IP for all common ports.
 */
export async function scanSingleHost(options: {
    ip:      string;
    ports?:  number[];
    timeout?: number;
}): Promise<{ success: boolean; host?: ScanHost; error?: string }> {
    try {
        const ports = options.ports ?? Object.keys(PORT_NAMES).map(Number);
        const host  = await scanHost(options.ip, ports, options.timeout ?? 1000);
        return { success: true, host };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Return the local machine's network interfaces.
 */
export async function getLocalNetworkInfo(): Promise<{
    success: boolean;
    interfaces?: { name: string; address: string; netmask: string; mac: string }[];
    localIp?: string;
    subnet?: string;
    error?: string;
}> {
    try {
        const ifaces = os.networkInterfaces();
        const result: { name: string; address: string; netmask: string; mac: string }[] = [];

        for (const [name, addrs] of Object.entries(ifaces)) {
            if (!addrs) continue;
            for (const addr of addrs) {
                if (addr.family === 'IPv4') {
                    result.push({ name, address: addr.address, netmask: addr.netmask, mac: addr.mac });
                }
            }
        }

        const net_ = getLocalNetwork();
        return {
            success:    true,
            interfaces: result,
            localIp:    net_?.localIp,
            subnet:     net_ ? `${net_.base}.0/24` : undefined,
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
