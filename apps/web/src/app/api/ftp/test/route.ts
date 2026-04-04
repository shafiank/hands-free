/**
 * POST /api/ftp/test
 *
 * Test an FTP connection using provided credentials.
 * Does not require an existing profile - works with ad-hoc credentials.
 *
 * Hands Free v7 - Session 17
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ftpTestConnection } from '@/lib/ftp-client';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        if (!body.host) {
            return NextResponse.json({ success: false, error: 'Host is required' }, { status: 400 });
        }

        const message = await ftpTestConnection({
            host: body.host,
            port: body.port || 21,
            username: body.username || '',
            password: body.password || '',
            protocol: body.protocol || 'ftp',
            remotePath: body.remotePath || '/',
            secure: false,
        });

        return NextResponse.json({ success: true, message });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
