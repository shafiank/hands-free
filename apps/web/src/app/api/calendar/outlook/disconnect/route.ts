import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const { deleteOutlookConfig } = await import('@/lib/calendar-outlook');
        await deleteOutlookConfig();
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
