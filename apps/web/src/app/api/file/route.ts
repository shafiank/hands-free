export const dynamic = 'force-dynamic';

import { DATA_DIR } from '@/lib/paths';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Maps file extensions to MIME types
const MIME_TYPES: Record<string, string> = {
    // Images
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    // Video
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    // Audio
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    // Documents
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text / Code
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.ts': 'text/typescript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8',
};

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const relPath = searchParams.get('path');
    if (!relPath) return new NextResponse('Missing path', { status: 400 });

    try {
        // Primary: workspace/ inside DATA_DIR (~/.handsfree-data/workspace/)
        const WORKSPACE_FILES = path.join(DATA_DIR, 'workspace');
        // Legacy fallback: old hidden .handsfree-data/workspace/files/ location
        const LEGACY_WORKSPACE = path.join(DATA_DIR, 'workspace', 'files');

        // Prevent directory traversal: strip leading ../ sequences and normalize
        const safePath = relPath.replace(/^(\.\.[/\\])+/, '').replace(/\\/g, '/');
        let fullPath = path.join(WORKSPACE_FILES, safePath);

        // Double-check resolved path stays within WORKSPACE_FILES
        if (!path.resolve(fullPath).startsWith(path.resolve(WORKSPACE_FILES))) {
            return new NextResponse('Access denied', { status: 403 });
        }

        // If not found in new Workspace/, check legacy location for backward compatibility
        if (!fs.existsSync(fullPath)) {
            const legacyPath = path.join(LEGACY_WORKSPACE, safePath);
            if (fs.existsSync(legacyPath) && path.resolve(legacyPath).startsWith(path.resolve(LEGACY_WORKSPACE))) {
                fullPath = legacyPath;
            }
        }

        if (!fs.existsSync(fullPath)) {
            return new NextResponse('File not found', { status: 404 });
        }

        // Reject directory access
        if (fs.statSync(fullPath).isDirectory()) {
            return new NextResponse('Path is a directory', { status: 400 });
        }

        const fileBuffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (e) {
        return new NextResponse('Error loading file', { status: 500 });
    }
}
