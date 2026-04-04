import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const { testOutlookConnection } = await import('@/lib/calendar-outlook');
        const result = await testOutlookConnection();
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
