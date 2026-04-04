/**
 * GET  /api/network-scan?mode=full|handsfree|host&ip=&ports=&timeout=&concurrency=
 * POST /api/network-scan  { mode, ip, ports, timeout, concurrency }
 *
 * Modes:
 *   full   â€” full /24 subnet scan (can take 30â€“120 s)
 *   handsfree â€” quick scan for other Hands Free instances on port 3000 only
 *   host   â€” scan a single IP for all common ports
 *   info   â€” return local network interface info only
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import {
    scanLocalNetwork,
    findHandsFreeInstances,
    scanSingleHost,
    getLocalNetworkInfo,
} from '@/actions/network-scanner';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

// Max timeout we allow (prevent runaway scans)
const MAX_TIMEOUT_MS = 5_000;

function parseOptions(params: Record<string, string | null>) {
    return {
        mode:        params.mode        ?? 'handsfree',
        ip:          params.ip          ?? '',
        ports:       params.ports       ? params.ports.split(',').map(Number).filter(Boolean) : undefined,
        timeout:     params.timeout     ? Math.min(Number(params.timeout), MAX_TIMEOUT_MS)  : undefined,
        concurrency: params.concurrency ? Number(params.concurrency) : undefined,
        startHost:   params.startHost   ? Number(params.startHost)   : undefined,
        endHost:     params.endHost     ? Number(params.endHost)     : undefined,
    };
}

async function runScan(opts: ReturnType<typeof parseOptions>) {
    switch (opts.mode) {
        case 'full':
            return scanLocalNetwork({
                ports:       opts.ports,
                timeout:     opts.timeout,
                concurrency: opts.concurrency,
                startHost:   opts.startHost,
                endHost:     opts.endHost,
            });
        case 'host':
            return scanSingleHost({ ip: opts.ip, ports: opts.ports, timeout: opts.timeout });
        case 'info':
            return getLocalNetworkInfo();
        case 'handsfree':
        default:
            return findHandsFreeInstances({ timeout: opts.timeout, concurrency: opts.concurrency });
    }
}

export async function GET(req: Request) {
    noStore();
    const url    = new URL(req.url);
    const params = Object.fromEntries(
        ['mode', 'ip', 'ports', 'timeout', 'concurrency', 'startHost', 'endHost'].map(
            (k) => [k, url.searchParams.get(k)],
        ),
    );
    const result = await runScan(parseOptions(params));
    return NextResponse.json(result);
}

export async function POST(req: Request) {
    noStore();
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }
    const result = await runScan(parseOptions(body));
    return NextResponse.json(result);
}
