export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getProject } from '@/actions/code-builder';
import path from 'path';
import fs from 'fs';

const MIME_TYPES: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm:  'text/html; charset=utf-8',
    css:  'text/css',
    js:   'text/javascript',
    mjs:  'text/javascript',
    json: 'application/json',
    png:  'image/png',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    gif:  'image/gif',
    svg:  'image/svg+xml',
    ico:  'image/x-icon',
    txt:  'text/plain',
    md:   'text/plain',
};

export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string; filepath: string[] } },
) {
    const project = await getProject(params.id);
    if (!project) {
        return new Response('Project not found', { status: 404 });
    }

    // Build absolute file path and resolve it to prevent path traversal
    const filePath = path.join(project.projectDir, ...params.filepath);
    const resolved = path.resolve(filePath);
    const projectDirResolved = path.resolve(project.projectDir);

    if (!resolved.startsWith(projectDirResolved + path.sep) && resolved !== projectDirResolved) {
        return new Response('Forbidden', { status: 403 });
    }

    if (!fs.existsSync(resolved)) {
        return new Response('File not found', { status: 404 });
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
        // Try index.html inside directory
        const indexPath = path.join(resolved, 'index.html');
        if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath);
            return new Response(content, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        return new Response('Directory listing not supported', { status: 403 });
    }

    const content = fs.readFileSync(resolved);
    const ext = path.extname(resolved).slice(1).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new Response(content, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
        },
    });
}
