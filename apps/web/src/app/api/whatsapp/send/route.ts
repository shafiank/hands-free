import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/actions/whatsapp';

// Never cache — live message delivery
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
    try {
        // Security: only allow requests from localhost (this is a local desktop app service)
        const host = req.headers.get('host') || '';
        const forwarded = req.headers.get('x-forwarded-for') || '';
        const isLocalhost =
            host.startsWith('localhost') ||
            host.startsWith('127.0.0.1') ||
            host.startsWith('[::1]') ||
            forwarded.startsWith('127.0.0.1') ||
            forwarded.startsWith('::1');

        if (!isLocalhost) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { to, message, addSignature } = await req.json();
        if (!to || !message) {
            return NextResponse.json({ error: 'Missing required fields: to, message' }, { status: 400 });
        }

        // Basic phone number validation (7–15 digits)
        const phone = String(to).replace(/[^0-9]/g, '');
        if (phone.length < 7 || phone.length > 15) {
            return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
        }

        const result = await sendWhatsAppMessage(to, message, addSignature !== false);
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
