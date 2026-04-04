/**
 * GET /api/buddy-notifications
 *
 * Drains the buddy notification queue and returns pending messages.
 * Called by the Desktop Buddy widget every 5 seconds.
 *
 * Response: { notifications: Array<{ text: string; ts: number }> }
 *
 * POST /api/buddy-notifications
 * Body: { text: string }
 * Pushes a notification programmatically (e.g. from server-side task hooks).
 */

import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { drainBuddyNotifications, pushBuddyNotification } from '@/lib/buddy-notify';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    noStore();
    try {
        const notifications = drainBuddyNotifications();
        return NextResponse.json({ notifications });
    } catch (err: any) {
        return NextResponse.json({ notifications: [] });
    }
}

export async function POST(req: Request) {
    noStore();
    try {
        const { text } = await req.json() as { text?: string };
        if (!text?.trim()) {
            return NextResponse.json({ error: 'text is required' }, { status: 400 });
        }
        pushBuddyNotification(text.trim());
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
