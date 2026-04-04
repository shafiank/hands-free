import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/actions/code-builder';
import path from 'path';
import fs from 'fs';
import os from 'os';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const archiver: any = require('archiver');

// Never cache â€” returns a freshly built ZIP of live project files
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } },
) {
    const project = await getProject(params.id);
    if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectDir = project.projectDir;
    if (!fs.existsSync(projectDir)) {
        return NextResponse.json({ error: 'Project directory not found' }, { status: 404 });
    }

    const safeName = project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
    const zipName = `${safeName}.zip`;
    const tmpZip = path.join(os.tmpdir(), `handsfreeStudio-${project.id}-${Date.now()}.zip`);

    try {
        if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip);

        // Pure Node.js ZIP creation via archiver â€” no shell, no powershell, no zip binary
        await new Promise<void>((resolve, reject) => {
            const output = fs.createWriteStream(tmpZip);
            const archive = archiver('zip', { zlib: { level: 6 } });

            output.on('close', resolve);
            output.on('error', reject);
            archive.on('error', (err: Error) => reject(err));
            archive.pipe(output);

            // Add all project files, excluding project.json (metadata-only)
            archive.glob('**/*', {
                cwd: projectDir,
                ignore: ['project.json', 'deploy-config.json'],
                dot: true,
            });

            archive.finalize();
        });

        if (!fs.existsSync(tmpZip)) throw new Error('ZIP creation failed â€” file not found after archiving');

        const zipBuffer = fs.readFileSync(tmpZip);
        try { fs.unlinkSync(tmpZip); } catch { /* best-effort cleanup */ }

        return new Response(zipBuffer, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${zipName}"`,
                'Content-Length': zipBuffer.byteLength.toString(),
            },
        });
    } catch (err: any) {
        try { if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip); } catch { }
        return NextResponse.json({ error: err?.message || 'ZIP creation failed' }, { status: 500 });
    }
}
