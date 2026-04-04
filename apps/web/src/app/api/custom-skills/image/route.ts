/**
 * GET /api/custom-skills/image?path=<encoded-absolute-path>
 *
 * Serves local image files for Custom UI Gallery skills.
 * Only serves files from inside DATA_DIR to prevent path traversal.
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import fs                              from 'fs';
import path                            from 'path';
import { DATA_DIR }                    from '@/lib/paths';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.ico']);

export async function GET(req: Request) {
    noStore();

    const { searchParams } = new URL(req.url);
    const rawPath = searchParams.get('path');

    if (!rawPath) {
        return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const absPath = path.resolve(rawPath);

    // Security: only serve files inside DATA_DIR or WORKSPACE_DIR
    // WORKSPACE_DIR is already inside DATA_DIR on default setups, but users can
    // configure a custom workspacePath (e.g. ~/Pictures) — allow that too.
    const { WORKSPACE_DIR } = await import('@/lib/paths');
    const { loadSettings }  = await import('@/actions/chat');
    let allowedRoots = [path.resolve(DATA_DIR), path.resolve(WORKSPACE_DIR)];
    try {
        const settings = await loadSettings();
        const custom = (settings as any)?.workspacePath as string | undefined;
        if (custom && custom.trim()) allowedRoots.push(path.resolve(custom.trim()));
    } catch { /* settings load failed — fall back to DATA_DIR only */ }

    const isAllowed = allowedRoots.some(root => absPath.startsWith(root));
    if (!isAllowed) {
        return NextResponse.json({ error: 'Access denied: path outside allowed directories' }, { status: 403 });
    }

    const ext = path.extname(absPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });
    }

    if (!fs.existsSync(absPath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    try {
        const buffer = fs.readFileSync(absPath);
        const mimeMap: Record<string, string> = {
            '.png':  'image/png',
            '.jpg':  'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif':  'image/gif',
            '.bmp':  'image/bmp',
            '.svg':  'image/svg+xml',
            '.ico':  'image/x-icon',
        };
        const mime = mimeMap[ext] ?? 'application/octet-stream';

        return new NextResponse(buffer, {
            status:  200,
            headers: {
                'Content-Type':  mime,
                'Cache-Control': 'public, max-age=60',
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
