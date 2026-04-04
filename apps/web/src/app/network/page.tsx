'use client';

/**
 * Network & Devices Ã¢â‚¬â€ /network
 *
 * Tab A: Network Scanner Ã¢â‚¬â€ ping-sweep + port-probe your /24 subnet
 * Tab B: DLNA Casting    Ã¢â‚¬â€ discover UPnP/DLNA renderers and cast media URLs
 */

import { useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
    Network, Tv2, RefreshCw, Play, Pause, Square,
    Wifi, WifiOff, Loader2, ChevronRight, Volume2,
    Monitor, Speaker, Cast, Search, Info, AlertCircle,
} from 'lucide-react';

const Icon = ({ icon: I, ...p }: { icon: any; [k: string]: any }) => <I {...p} />;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

interface NetworkDevice {
    ip:       string;
    hostname?: string;
    openPorts?: number[];
    latencyMs?: number;
    isHandsFree?: boolean;
}

interface NetworkInfo {
    localIp?: string;
    subnet?:  string;
    gateway?: string;
    ifaces?:  Array<{ name: string; address: string; family: string }>;
}

interface DlnaDevice {
    location:     string;
    usn:          string;
    server?:      string;
    friendlyName?: string;
    controlUrl?:  string;
    udn?:         string;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Tab Button Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function TabBtn({ active, onClick, icon, label }: {
    active: boolean; onClick: () => void; icon: any; label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                active
                    ? 'bg-lime-500 text-black'
                    : 'hover:bg-[var(--surface-light)]'
            }`}
            style={active ? {} : { color: 'var(--text-muted)' }}
        >
            <Icon icon={icon} size={15} />
            {label}
        </button>
    );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Network Scanner Tab Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function ScannerTab() {
    const { t } = useTranslation();
    const [mode, setMode]           = useState<'handsfree' | 'full' | 'info'>('info');
    const [scanning, setScanning]   = useState(false);
    const [devices, setDevices]     = useState<NetworkDevice[]>([]);
    const [netInfo, setNetInfo]     = useState<NetworkInfo | null>(null);
    const [error, setError]         = useState<string | null>(null);
    const [singleIp, setSingleIp]   = useState('');

    const scan = useCallback(async () => {
        setScanning(true);
        setError(null);

        // Hard 10-second abort Ã¢â‚¬â€ prevents infinite hanging on Hands Free/Full scans
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), 10_000);

        try {
            const params = new URLSearchParams({ mode });
            if (mode === 'full' || mode === 'handsfree') {
                // Per-host TCP timeout and concurrency passed to the scanner
                params.set('timeout', '1500');
                params.set('concurrency', '50');
            }
            const res  = await fetch(`/api/network-scan?${params}`, { signal: controller.signal });
            const data = await res.json();
            if (!data.success) { setError(data.error ?? t('network.scanFailed')); return; }

            if (mode === 'info') {
                // API returns { success, localIp, subnet, interfaces: [{name,address,netmask,mac}] }
                setNetInfo({
                    localIp: data.localIp,
                    subnet:  data.subnet,
                    ifaces:  (data.interfaces ?? []).map((i: any) => ({
                        name:    i.name,
                        address: i.address,
                        family:  'IPv4',
                    })),
                });
                setDevices([]);
            } else {
                // API returns { success, hosts: ScanHost[], handsfreeInstances: ScanHost[] }
                // ScanHost = { ip, ports: [{port, open, service}], isHandsFree, latencyMs }
                const hosts: any[] = data.hosts ?? data.handsfreeInstances ?? [];
                setDevices(hosts.map((h: any) => ({
                    ip:        h.ip,
                    openPorts: (h.ports ?? []).filter((p: any) => p.open).map((p: any) => p.port),
                    latencyMs: h.latencyMs,
                    isHandsFree:  h.isHandsFree,
                })));
                setNetInfo(null);
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                setError(t('network.scanTimeout'));
            } else {
                setError(e.message ?? 'Network error');
            }
        } finally {
            clearTimeout(abortTimer);
            setScanning(false);
        }
    }, [mode]);

    const scanHost = useCallback(async () => {
        if (!singleIp.trim()) return;
        setScanning(true);
        setError(null);
        try {
            const res  = await fetch(`/api/network-scan?mode=host&ip=${encodeURIComponent(singleIp.trim())}&timeout=2000`);
            const data = await res.json();
            if (!data.success) { setError(data.error ?? t('network.hostScanFailed')); return; }
            setDevices(data.devices ?? []);
            setNetInfo(null);
        } catch (e: any) {
            setError(e.message ?? 'Network error');
        } finally {
            setScanning(false);
        }
    }, [singleIp]);

    return (
        <div className="space-y-5">
            {/* Controls */}
            <div className="rounded-2xl border p-4 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Icon icon={Search} size={15} className="text-lime-500" />
                    {t('network.scanOptions')}
                </h3>

                <div className="flex flex-wrap gap-2">
                    {([
                        { v: 'info',   label: t('network.modes.networkInfo'),   icon: Info   },
                        { v: 'handsfree', label: t('network.modes.handsfreeDevices'), icon: Wifi   },
                        { v: 'full',   label: t('network.modes.fullScan'),  icon: Network },
                    ] as const).map(m => (
                        <button
                            key={m.v}
                            onClick={() => setMode(m.v)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                mode === m.v
                                    ? 'bg-lime-500/15 border-lime-500/40 text-lime-500'
                                    : 'hover:bg-[var(--surface-light)]'
                            }`}
                            style={mode !== m.v ? { borderColor: 'var(--border)', color: 'var(--text-muted)' } : {}}
                        >
                            <Icon icon={m.icon} size={13} />
                            {m.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={scan}
                        disabled={scanning}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-lime-500 text-black hover:bg-lime-400 disabled:opacity-50 transition-all"
                    >
                        {scanning
                            ? <Icon icon={Loader2} size={14} className="animate-spin" />
                            : <Icon icon={RefreshCw} size={14} />}
                        {scanning ? t('network.scanning') : t('network.runScan')}
                    </button>
                </div>

                {/* Single-host quick scan */}
                <div className="flex gap-2 items-center pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('network.singleHost')}</span>
                    <input
                        value={singleIp}
                        onChange={e => setSingleIp(e.target.value)}
                        placeholder="192.168.1.10"
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs border"
                        style={{ background: 'var(--surface-light)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        onKeyDown={e => e.key === 'Enter' && scanHost()}
                    />
                    <button
                        onClick={scanHost}
                        disabled={scanning || !singleIp.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-lime-500 text-black disabled:opacity-50 hover:bg-lime-400 transition-all"
                    >
                        {t('network.probe')}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-xl border p-3 flex items-center gap-2 text-sm text-red-400"
                    style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.3)' }}>
                    <Icon icon={AlertCircle} size={15} />
                    {error}
                </div>
            )}

            {/* Network Info */}
            {netInfo && (
                <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('network.localNetInfo')}</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {netInfo.localIp && <InfoRow label={t('network.localIp')} value={netInfo.localIp} />}
                        {netInfo.subnet  && <InfoRow label={t('network.subnet')} value={netInfo.subnet} />}
                        {netInfo.gateway && <InfoRow label={t('network.gateway')} value={netInfo.gateway} />}
                    </div>
                    {netInfo.ifaces && netInfo.ifaces.length > 0 && (
                        <div className="space-y-1 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('network.interfaces')}</p>
                            {netInfo.ifaces.map((i, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span style={{ color: 'var(--text-muted)' }}>{i.name} ({i.family})</span>
                                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{i.address}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Device list */}
            {devices.length > 0 && (
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    <div className="px-4 py-3 border-b flex items-center justify-between"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {t('network.devicesFound', { count: devices.length })}
                        </span>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                        {devices.map(d => (
                            <div key={d.ip} className="px-4 py-3 flex items-center gap-3"
                                style={{ background: 'var(--surface)' }}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${d.isHandsFree ? 'bg-lime-500/15' : 'bg-[var(--surface-light)]'}`}>
                                    <Icon icon={d.isHandsFree ? Wifi : Monitor} size={15}
                                        className={d.isHandsFree ? 'text-lime-500' : ''} style={d.isHandsFree ? {} : { color: 'var(--text-muted)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        {d.hostname ?? d.ip}
                                        {d.isHandsFree && <span className="ml-2 text-xs text-lime-500 font-bold">Hands Free</span>}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {d.ip}
                                        {d.latencyMs != null && ` Ã‚Â· ${d.latencyMs}ms`}
                                        {d.openPorts?.length ? ` Ã‚Â· ${t('network.ports')}: ${d.openPorts.join(', ')}` : ''}
                                    </p>
                                </div>
                                {d.isHandsFree && (
                                    <a href={`http://${d.ip}:3000`} target="_blank" rel="noreferrer"
                                        className="text-xs text-lime-500 font-bold hover:underline flex items-center gap-1">
                                        {t('network.open')} <Icon icon={ChevronRight} size={12} />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!scanning && devices.length === 0 && !netInfo && !error && (
                <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                    {t('network.selectScanHint')}
                </p>
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg p-3" style={{ background: 'var(--surface-light)' }}>
            <p className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        </div>
    );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ DLNA Casting Tab Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function CastingTab() {
    const { t } = useTranslation();
    const [discovering, setDiscovering]   = useState(false);
    const [discoverPhase, setDiscoverPhase] = useState<string>('');
    const [renderers, setRenderers]       = useState<DlnaDevice[]>([]);
    const [selected, setSelected]         = useState<DlnaDevice | null>(null);
    const [mediaUrl, setMediaUrl]         = useState('');
    const [mimeType, setMimeType]         = useState('video/mp4');
    const [title, setTitle]               = useState('');
    const [status, setStatus]             = useState<string | null>(null);
    const [debugInfo, setDebugInfo]       = useState<string | null>(null);
    const [error, setError]               = useState<string | null>(null);
    const [busy, setBusy]                 = useState(false);

    const discover = useCallback(async () => {
        setDiscovering(true);
        setDiscoverPhase(t('network.dlna.ssdpPhase'));
        setError(null);
        setDebugInfo(null);
        setRenderers([]);
        setSelected(null);

        // Phase-label update: after 5 s SSDP, if still running Ã¢â€ â€™ unicast scan started
        const unicastLabelTimer = setTimeout(() => {
            setDiscoverPhase(t('network.dlna.unicastPhase'));
        }, 6_000);

        try {
            // No hard abort Ã¢â‚¬â€ unicast scan may take up to ~45 s for a /24 subnet
            const res  = await fetch('/api/casting?action=discover&timeout=5000');
            const data = await res.json();
            if (!data.success) { setError(data.error ?? t('network.dlna.discoveryFailed')); return; }
            const found: DlnaDevice[] = data.devices ?? [];
            setRenderers(found);
            if (data.debug) setDebugInfo(data.debug);
            if (found.length === 0) setStatus(t('network.dlna.noRenderersFound'));
            else setStatus(null);
        } catch (e: any) {
            setError(e.message ?? 'Network error');
        } finally {
            clearTimeout(unicastLabelTimer);
            setDiscoverPhase('');
            setDiscovering(false);
        }
    }, []);

    const doAction = useCallback(async (action: 'cast' | 'pause' | 'stop') => {
        if (!selected?.controlUrl) { setError(t('network.dlna.noRendererSelected')); return; }
        setBusy(true);
        setError(null);
        try {
            const body: Record<string, any> = { action, controlUrl: selected.controlUrl };
            if (action === 'cast') {
                if (!mediaUrl.trim()) { setError(t('network.dlna.enterMediaUrl')); setBusy(false); return; }
                body.mediaUrl = mediaUrl.trim();
                body.mimeType = mimeType;
                body.title    = title || t('network.dlna.defaultTitle');
            }
            const res  = await fetch('/api/casting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!data.success) { setError(data.error ?? t('network.dlna.actionFailed', { action })); return; }
            setStatus(t('network.dlna.actionSent', { action: action.charAt(0).toUpperCase() + action.slice(1), device: selected.friendlyName ?? selected.usn }));
        } catch (e: any) {
            setError(e.message ?? 'Network error');
        } finally {
            setBusy(false);
        }
    }, [selected, mediaUrl, mimeType, title]);

    return (
        <div className="space-y-5">
            {/* Discover */}
            <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Icon icon={Cast} size={15} className="text-lime-500" />
                    {t('network.dlna.discoverHeading')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t('network.dlna.discoverDesc')}
                </p>
                <button
                    onClick={discover}
                    disabled={discovering}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-lime-500 text-black hover:bg-lime-400 disabled:opacity-50 transition-all"
                >
                    {discovering
                        ? <Icon icon={Loader2} size={14} className="animate-spin" />
                        : <Icon icon={Search} size={14} />}
                    {discovering ? t('network.dlna.discovering') : t('network.dlna.discoverBtn')}
                </button>

                {/* Phase label shown while scanning */}
                {discovering && discoverPhase && (
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Ã°Å¸â€œÂ¡ {discoverPhase}
                    </p>
                )}

                {/* Debug info after scan */}
                {!discovering && debugInfo && (
                    <p className="text-xs font-mono px-2 py-1 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--surface-raised, rgba(255,255,255,0.04))', border: '1px solid var(--border)' }}>
                        Ã°Å¸â€Â {debugInfo}
                    </p>
                )}
            </div>

            {/* Renderer list */}
            {renderers.length > 0 && (
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    <div className="px-4 py-3 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {t('network.dlna.renderersFound', { count: renderers.length })}
                        </span>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                        {renderers.map(r => (
                            <button
                                key={r.usn}
                                onClick={() => setSelected(r)}
                                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all ${
                                    selected?.usn === r.usn ? 'bg-lime-500/10' : 'hover:bg-[var(--surface-light)]'
                                }`}
                                style={{ background: selected?.usn === r.usn ? undefined : 'var(--surface)' }}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selected?.usn === r.usn ? 'bg-lime-500/20' : 'bg-[var(--surface-light)]'}`}>
                                    <Icon icon={Tv2} size={15} className={selected?.usn === r.usn ? 'text-lime-500' : ''} style={selected?.usn !== r.usn ? { color: 'var(--text-muted)' } : {}} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate" style={{ color: selected?.usn === r.usn ? '#84cc16' : 'var(--text-primary)' }}>
                                        {r.friendlyName ?? r.usn}
                                    </p>
                                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                        {r.server ?? r.location}
                                    </p>
                                </div>
                                {selected?.usn === r.usn && (
                                    <span className="text-xs font-bold text-lime-500">{t('network.dlna.selected')}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Cast controls */}
            {selected && (
                <div className="rounded-2xl border p-4 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Icon icon={Volume2} size={15} className="text-lime-500" />
                        {t('network.dlna.castTo')} {selected.friendlyName ?? selected.usn}
                    </h3>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                                {t('network.dlna.mediaUrl')}
                            </label>
                            <input
                                value={mediaUrl}
                                onChange={e => setMediaUrl(e.target.value)}
                                placeholder="https://example.com/movie.mp4"
                                className="w-full px-3 py-2 rounded-xl text-sm border"
                                style={{ background: 'var(--surface-light)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('network.dlna.mimeType')}</label>
                                <select
                                    value={mimeType}
                                    onChange={e => setMimeType(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl text-sm border"
                                    style={{ background: 'var(--surface-light)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                >
                                    <option value="video/mp4">video/mp4</option>
                                    <option value="video/webm">video/webm</option>
                                    <option value="video/x-matroska">video/mkv</option>
                                    <option value="audio/mpeg">audio/mpeg</option>
                                    <option value="audio/flac">audio/flac</option>
                                    <option value="audio/ogg">audio/ogg</option>
                                    <option value="image/jpeg">image/jpeg</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('network.dlna.titleOptional')}</label>
                                <input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="My Video"
                                    className="w-full px-3 py-2 rounded-xl text-sm border"
                                    style={{ background: 'var(--surface-light)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => doAction('cast')}
                            disabled={busy || !mediaUrl.trim()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-lime-500 text-black hover:bg-lime-400 disabled:opacity-50 transition-all"
                        >
                            {busy ? <Icon icon={Loader2} size={14} className="animate-spin" /> : <Icon icon={Play} size={14} />}
                            {t('network.dlna.cast')}
                        </button>
                        <button
                            onClick={() => doAction('pause')}
                            disabled={busy}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all hover:bg-[var(--surface-light)] disabled:opacity-50"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        >
                            <Icon icon={Pause} size={14} />
                            {t('network.dlna.pause')}
                        </button>
                        <button
                            onClick={() => doAction('stop')}
                            disabled={busy}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all hover:bg-[var(--surface-light)] disabled:opacity-50"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        >
                            <Icon icon={Square} size={14} />
                            {t('network.dlna.stop')}
                        </button>
                    </div>
                </div>
            )}

            {/* Status / Error */}
            {status && !error && (
                <div className="rounded-xl border p-3 text-sm" style={{ background: 'rgba(132,204,22,0.06)', borderColor: 'rgba(132,204,22,0.3)', color: '#84cc16' }}>
                    {status}
                </div>
            )}
            {error && (
                <div className="rounded-xl border p-3 flex items-center gap-2 text-sm text-red-400"
                    style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.3)' }}>
                    <Icon icon={AlertCircle} size={15} />
                    {error}
                </div>
            )}

            {!discovering && renderers.length === 0 && !status && !error && (
                <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                    {t('network.dlna.clickDiscoverHint')}
                </p>
            )}
        </div>
    );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Page Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export default function NetworkPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'scanner' | 'casting'>('scanner');

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pb-32">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                            <div className="w-9 h-9 rounded-xl bg-lime-500/15 flex items-center justify-center">
                                <Icon icon={Network} size={20} className="text-lime-500" />
                            </div>
                            {t('network.title')}
                        </h1>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">BETA</span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {t('network.subtitle')}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 p-1 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <TabBtn active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} icon={Network} label={t('network.tabs.scanner')} />
                    <TabBtn active={activeTab === 'casting'} onClick={() => setActiveTab('casting')} icon={Tv2}     label={t('network.tabs.dlna')} />
                </div>

                {/* Tab Content */}
                {activeTab === 'scanner' ? <ScannerTab /> : <CastingTab />}
            </div>
        </div>
    );
}
