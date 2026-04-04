import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { caldavUrl, username, password } = await req.json();
        if (!caldavUrl || !username || !password) {
            return NextResponse.json({ success: false, error: 'Missing caldavUrl, username, or password' }, { status: 400 });
        }
        const { AppleCalendarProvider } = await import('@/lib/calendar-apple');
        const provider = new AppleCalendarProvider({ caldavUrl, username, password });
        const today = new Date().toISOString().split('T')[0];
        const events = await provider.getEvents(today);
        return NextResponse.json({ success: true, eventsFound: events.length });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
