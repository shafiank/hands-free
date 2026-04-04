import { NextResponse } from 'next/server';
import { pollEmailInbox, clearEmailNotifications } from '@/actions/email';

export const dynamic = 'force-dynamic';

// GET /api/email/poll
// Called periodically by AppShell (client-side setInterval).
// The server action itself decides whether enough time has passed to
// actually connect to IMAP — so the client can safely call every 60s.
export async function GET() {
    try {
        const result = await pollEmailInbox();
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ checked: false, newCount: 0, notifications: [], error: e.message });
    }
}

// DELETE /api/email/poll
// Clears pending notification list (called when user dismisses the banner).
export async function DELETE() {
    try {
        await clearEmailNotifications();
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false });
    }
}
