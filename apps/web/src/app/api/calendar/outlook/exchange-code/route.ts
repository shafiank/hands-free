import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { code, clientId, clientSecret } = await req.json();
        if (!code || !clientId) {
            return NextResponse.json({ success: false, error: 'Missing code or clientId' }, { status: 400 });
        }
        const { exchangeOutlookAuthCode } = await import('@/lib/calendar-outlook');
        const result = await exchangeOutlookAuthCode(code, clientId, clientSecret || undefined);
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
