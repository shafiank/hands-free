export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// SECURITY: Only allow downloads from the official Hands Free update server.
// This is hardcoded and never user-configurable.
const ALLOWED_ORIGIN = 'https://handsfree.app';

export async function POST(req: NextRequest): Promise<Response> {
    let url: string;
    let checksumExpected: string | undefined;
    let filename: string;

    try {
        const body = await req.json();
        url = body.url;
        checksumExpected = body.checksumExpected;
        filename = body.filename || 'handsfree-update.zip';
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Security check â€” only allow downloads from handsfree.app
    if (!url || !url.startsWith(`${ALLOWED_ORIGIN}/`)) {
        return NextResponse.json({ error: 'Download URL must be from handsfree.app' }, { status: 403 });
    }

    // Sanitize filename â€” prevent path traversal
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');

    // â”€â”€ SSE stream â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    const send = async (event: string, data: Record<string, unknown>) => {
        try {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ event, ...data })}\n\n`));
        } catch { /* ignore write errors (client disconnected) */ }
    };

    // Run download in background, stream progress
    (async () => {
        try {
            // Determine save directory: Downloads â†’ Desktop â†’ home
            const home = os.homedir();
            let saveDir = path.join(home, 'Downloads');
            if (!fs.existsSync(saveDir)) {
                saveDir = path.join(home, 'Desktop');
                if (!fs.existsSync(saveDir)) saveDir = home;
            }

            const destPath = path.join(saveDir, safeFilename);
            await send('start', { status: 'Connecting to update server...', destPath });

            // Fetch with a generous timeout
            let response: Response;
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 300_000); // 5 min
                try {
                    response = await fetch(url, {
                        signal: controller.signal,
                        headers: { 'User-Agent': 'Hands Free-Updater/2.0' },
                    });
                } finally {
                    clearTimeout(timeout);
                }
            } catch (e: any) {
                await send('error', { message: e.name === 'AbortError' ? 'Download timed out (5 min)' : `Connection failed: ${e.message}` });
                return;
            }

            if (!response.ok) {
                await send('error', { message: `Download server returned HTTP ${response.status}` });
                return;
            }

            const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
            await send('progress', { percent: 0, status: 'Downloading...', downloadedSize: 0, totalSize });

            // Stream to file
            const fileStream = fs.createWriteStream(destPath);
            const hash = crypto.createHash('sha256');
            let downloadedSize = 0;
            let lastReportedPercent = -1;

            const reader = response.body!.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                await new Promise<void>((resolve, reject) => {
                    fileStream.write(value, (err) => err ? reject(err) : resolve());
                });
                hash.update(value);
                downloadedSize += value.length;

                const percent = totalSize > 0 ? Math.min(99, Math.round((downloadedSize / totalSize) * 100)) : -1;
                // Throttle: only send when percent changes by â‰¥1
                if (percent !== lastReportedPercent) {
                    lastReportedPercent = percent;
                    await send('progress', { percent, status: 'Downloading...', downloadedSize, totalSize });
                }
            }

            // Flush and close file
            await new Promise<void>((resolve, reject) => {
                fileStream.end((err: any) => err ? reject(err) : resolve());
            });

            // â”€â”€ Checksum Verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            await send('progress', { percent: 100, status: 'Verifying integrity...' });

            const actualChecksum = `sha256:${hash.digest('hex')}`;
            if (checksumExpected && checksumExpected !== 'sha256:' && checksumExpected !== actualChecksum) {
                // Delete the corrupt file
                try { fs.unlinkSync(destPath); } catch { /* ignore */ }
                await send('error', {
                    message: `Checksum mismatch - the download may be corrupted. Please try again or download manually from handsfree.app`,
                    expected: checksumExpected,
                    actual: actualChecksum,
                });
                return;
            }

            await send('done', {
                filePath: destPath,
                filename: safeFilename,
                checksumVerified: !!(checksumExpected && checksumExpected !== 'sha256:'),
                checksum: actualChecksum,
                totalSize: downloadedSize,
            });

        } catch (e: any) {
            await send('error', { message: e.message || 'Unknown error during download' });
        } finally {
            try { await writer.close(); } catch { /* ignore */ }
        }
    })();

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // disable nginx buffering
        },
    });
}
