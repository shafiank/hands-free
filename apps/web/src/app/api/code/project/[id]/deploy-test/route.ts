export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/actions/code-builder';
import { ftpTestConnection } from '@/lib/ftp-client';

/**
 * POST /api/code/project/[id]/deploy-test
 * Test FTP connection for a Hands Free Studio project.
 * Hands Free v7 â€” Session 15
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const project = await getProject(params.id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    try {
        const message = await ftpTestConnection({
            host: body.host,
            port: body.port || 21,
            username: body.username,
            password: body.password,
            protocol: body.protocol || 'ftp',
            remotePath: body.remotePath || '/',
            secure: body.secure || false,
        });
        return NextResponse.json({ success: true, message });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
