/**
 * POST /api/handsfree-plus/waitlist
 *
 * Accepts:  { email: string; tier: 'personal' | 'business' }
 * Returns:  { success: true }  (always, even if remote call fails)
 *
 * Behaviour:
 *  1. Validate the email format.
 *  2. Append the entry to ~/.handsfree-data/waitlist.json (local backup).
 *  3. Also save the email to settings.json as `handsfreeplus_waitlist_email`.
 *  4. Fire-and-forget POST to https://handsfree.app/api/collect.php â€” if the
 *     remote server is unreachable, the error is silently swallowed.
 */

import { NextRequest, NextResponse }    from 'next/server';
import { unstable_noStore as noStore }  from 'next/cache';
import fs                               from 'fs';
import path                             from 'path';
import { DATA_DIR }                     from '@/lib/paths';
import { loadSettings, saveAllSettings } from '@/actions/chat';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

const WAITLIST_FILE = path.join(DATA_DIR, 'waitlist.json');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Read the local waitlist JSON (creates it if missing) */
function readWaitlist(): Array<{ email: string; tier: string; addedAt: string }> {
    try {
        if (!fs.existsSync(WAITLIST_FILE)) return [];
        return JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf8'));
    } catch {
        return [];
    }
}

/** Persist the waitlist back to disk */
function writeWaitlist(list: Array<{ email: string; tier: string; addedAt: string }>) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(WAITLIST_FILE, JSON.stringify(list, null, 2), 'utf8');
}

export async function POST(req: NextRequest) {
    noStore();
    try {
        const body = await req.json().catch(() => ({}));
        const email: string = (body.email ?? '').toString().trim();
        const tier:  string = (body.tier  ?? 'personal').toString().trim();

        // 1. Validate email
        if (!email || !EMAIL_RE.test(email)) {
            return NextResponse.json(
                { success: false, error: 'Please enter a valid email address.' },
                { status: 400 }
            );
        }

        // 2. Save to local waitlist.json
        const list = readWaitlist();
        const alreadyExists = list.some(e => e.email.toLowerCase() === email.toLowerCase());
        if (!alreadyExists) {
            list.push({ email, tier, addedAt: new Date().toISOString() });
            writeWaitlist(list);
        }

        // 3. Also persist email into settings.json for the Settings page teaser
        try {
            await saveAllSettings({ handsfreeplus_waitlist_email: email } as any);
        } catch { /* best-effort */ }

        // 4. Fire-and-forget remote collection â€” no error surfaced to user
        //    The endpoint is public (like Google Analytics). No auth needed.
        Promise.resolve().then(async () => {
            try {
                await fetch('https://handsfree.app/api/collect.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'waitlist', email, tier }),
                    signal: AbortSignal.timeout(8_000),
                });
            } catch {
                // Remote unreachable â€” local save is enough, no error shown
            }
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        // Internal error â€” still return success so the UI stays friendly
        console.error('[Hands Free Plus] Waitlist error:', err?.message);
        return NextResponse.json({ success: true });
    }
}
