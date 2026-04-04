/**
 * /api/casting — DLNA/UPnP media casting control
 *
 * GET  /api/casting?action=discover&timeout=5000
 * GET  /api/casting?action=parse&location=<url>
 * GET  /api/casting?action=info&controlUrl=<url>
 *
 * POST /api/casting
 * {
 *   action: "cast" | "pause" | "stop" | "seek" | "volume"
 *   controlUrl: string
 *   mediaUrl?:  string      // for cast
 *   mimeType?:  string      // for cast
 *   title?:     string      // for cast
 *   position?:  string      // for seek — "HH:MM:SS"
 *   volume?:    number      // for volume — 0–100
 * }
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import {
    discoverCastDevices,
    parseDeviceDescription,
    castMedia,
    pauseCasting,
    stopCasting,
    seekCasting,
    setVolume,
    getTransportInfo,
} from '@/actions/casting';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
    noStore();
    const url    = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'discover';

    try {
        switch (action) {
            case 'discover': {
                // Default 5 s for SSDP phase; unicast fallback adds up to ~45 s more.
                // Cap at 60 s to avoid hanging forever.
                const timeout      = Number(url.searchParams.get('timeout') ?? '5000');
                const searchTarget = url.searchParams.get('target') ?? undefined;
                const result = await discoverCastDevices({
                    timeoutMs:       Math.min(timeout, 60_000),
                    searchTarget,
                    unicastFallback: true,
                });

                if (!result.success) return NextResponse.json(result);

                // Auto-parse each device's description XML to extract friendlyName
                // and AVTransport controlUrl. This is the data the UI actually needs
                // to display device names and execute cast commands.
                const rawDevices = result.devices ?? [];
                const enriched = await Promise.all(
                    rawDevices.map(async (dev) => {
                        try {
                            const parsed = await parseDeviceDescription(dev.location);
                            return {
                                location:     dev.location,
                                usn:          dev.id,
                                server:       dev.name,
                                friendlyName: parsed.success ? (parsed.name ?? dev.name) : dev.name,
                                controlUrl:   parsed.controlUrl ?? undefined,
                                udn:          dev.id,
                            };
                        } catch {
                            return {
                                location:     dev.location,
                                usn:          dev.id,
                                server:       dev.name,
                                friendlyName: dev.name ?? dev.ip,
                                controlUrl:   undefined,
                                udn:          dev.id,
                            };
                        }
                    }),
                );

                return NextResponse.json({ success: true, devices: enriched, debug: result.debug });
            }
            case 'parse': {
                const location = url.searchParams.get('location');
                if (!location) return NextResponse.json({ success: false, error: 'Missing location parameter' }, { status: 400 });
                const result = await parseDeviceDescription(location);
                return NextResponse.json(result);
            }
            case 'info': {
                const controlUrl = url.searchParams.get('controlUrl');
                if (!controlUrl) return NextResponse.json({ success: false, error: 'Missing controlUrl parameter' }, { status: 400 });
                const result = await getTransportInfo(controlUrl);
                return NextResponse.json(result);
            }
            default:
                return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    noStore();

    let body: any = {};
    try { body = await req.json(); } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action, controlUrl } = body ?? {};

    try {
        switch (action) {
            case 'cast': {
                if (!controlUrl || !body.mediaUrl) {
                    return NextResponse.json({ success: false, error: 'controlUrl and mediaUrl are required' }, { status: 400 });
                }
                const result = await castMedia({
                    controlUrl,
                    mediaUrl: body.mediaUrl,
                    mimeType: body.mimeType,
                    title:    body.title,
                });
                return NextResponse.json(result);
            }
            case 'pause': {
                if (!controlUrl) return NextResponse.json({ success: false, error: 'controlUrl is required' }, { status: 400 });
                return NextResponse.json(await pauseCasting(controlUrl));
            }
            case 'stop': {
                if (!controlUrl) return NextResponse.json({ success: false, error: 'controlUrl is required' }, { status: 400 });
                return NextResponse.json(await stopCasting(controlUrl));
            }
            case 'seek': {
                if (!controlUrl || !body.position) {
                    return NextResponse.json({ success: false, error: 'controlUrl and position are required' }, { status: 400 });
                }
                return NextResponse.json(await seekCasting(controlUrl, body.position));
            }
            case 'volume': {
                if (!controlUrl || body.volume === undefined) {
                    return NextResponse.json({ success: false, error: 'controlUrl and volume are required' }, { status: 400 });
                }
                return NextResponse.json(await setVolume({ controlUrl, volume: Number(body.volume) }));
            }
            default:
                return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message ?? 'Casting error' }, { status: 500 });
    }
}
