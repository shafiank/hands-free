export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

const DATA_DIR      = process.env.HANDSFREE_DATA_DIR || path.join(os.homedir(), '.handsfree-data');
const WORKSPACE_DIR = path.join(DATA_DIR, 'workspace');

function resolveOpenPath(raw: string): string {
    // Special sentinel: open the Hands Free data directory
    if (raw === '__DATA_DIR__')  return DATA_DIR;
    if (raw === '__WORKSPACE__') return WORKSPACE_DIR;

    // Relative workspace/ or files/ paths â†’ resolve to workspace dir
    if (/^workspace[\\/]/i.test(raw)) {
        return path.join(DATA_DIR, raw);
    }
    if (/^files[\\/]/i.test(raw)) {
        return path.join(WORKSPACE_DIR, raw);
    }

    // Tilde expansion
    if (raw.startsWith('~/')) {
        return path.join(os.homedir(), raw.slice(2));
    }

    // Absolute path â€” use as-is
    return raw;
}

export async function POST(req: NextRequest) {
    try {
        const { path: folderPath } = await req.json();
        if (!folderPath) {
            return NextResponse.json({ error: 'path required' }, { status: 400 });
        }

        const resolved = resolveOpenPath(folderPath);

        if (process.platform === 'win32') {
            // On Windows: use /select to highlight a file, or open the folder directly
            spawn('explorer', [resolved], { detached: true, stdio: 'ignore' }).unref();
        } else if (process.platform === 'darwin') {
            spawn('open', [resolved], { detached: true, stdio: 'ignore' }).unref();
        } else {
            spawn('xdg-open', [resolved], { detached: true, stdio: 'ignore' }).unref();
        }

        return NextResponse.json({ success: true, resolved });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Failed to open folder' }, { status: 500 });
    }
}
