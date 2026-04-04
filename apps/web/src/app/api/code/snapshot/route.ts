export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/code/snapshot
 * Creates a snapshot of the current project files before an iteration.
 * Stored in {projectDir}/_backups/{timestamp}/ for rollback.
 */
export async function POST(req: NextRequest) {
    try {
        const { projectId, projectDir } = await req.json();
        if (!projectDir || !fs.existsSync(projectDir)) {
            return NextResponse.json({ ok: false, error: 'projectDir not found' });
        }

        const timestamp = Date.now();
        const backupDir = path.join(projectDir, '_backups', String(timestamp));
        fs.mkdirSync(backupDir, { recursive: true });

        // Copy all non-backup, non-hidden files
        const files = fs.readdirSync(projectDir).filter(f => !f.startsWith('_') && !f.startsWith('.'));
        for (const file of files) {
            try {
                const src = path.join(projectDir, file);
                const dst = path.join(backupDir, file);
                if (fs.statSync(src).isFile()) {
                    fs.copyFileSync(src, dst);
                }
            } catch { /* skip unreadable files */ }
        }

        // Write snapshot metadata
        fs.writeFileSync(path.join(backupDir, '.snapshot-meta.json'), JSON.stringify({
            projectId,
            projectDir,
            createdAt: new Date().toISOString(),
            fileCount: files.length,
        }, null, 2));

        return NextResponse.json({ ok: true, backupDir, timestamp });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message });
    }
}
