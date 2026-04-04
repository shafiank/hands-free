export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getProject } from '@/actions/code-builder';

/**
 * GET/POST /api/code/project/[id]/deploy-config
 * Read or save deploy configuration for a Hands Free Studio project.
 * Config stored per-project in deploy-config.json (excluded from ZIP).
 * Hands Free v7 â€” Session 15
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } },
) {
    const project = await getProject(params.id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const configPath = path.join(project.projectDir, 'deploy-config.json');
    if (!fs.existsSync(configPath)) {
        return NextResponse.json({ configured: false });
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    // Never return password in GET response
    return NextResponse.json({
        configured: true,
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password ? 'â€¢â€¢â€¢â€¢â€¢â€¢' : '',
        protocol: config.protocol,
        remotePath: config.remotePath,
        secure: config.secure,
        lastDeployedAt: config.lastDeployedAt,
    });
}

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const project = await getProject(params.id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const config = {
        host: body.host,
        port: body.port || 21,
        username: body.username,
        password: body.password,
        protocol: body.protocol || 'ftp',
        remotePath: body.remotePath || '/',
        secure: body.secure || false,
        lastDeployedAt: null as number | null,
        lastDeployedFiles: [] as string[],
    };

    const configPath = path.join(project.projectDir, 'deploy-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ success: true });
}
