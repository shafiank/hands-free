/**
 * POST /api/feedback
 *
 * Receives feedback (ratings + feature requests) from the client and proxies
 * to https://handsfree.app/api/collect.php server-side.
 *
 * GDPR / DSGVO: checks telemetry_enabled in settings.json BEFORE forwarding.
 * If opt-in is false, returns { success: false, reason: 'opt_in_disabled' }.
 *
 * Same proxy pattern as /api/bug-report and /api/telemetry/ping.
 */

import { NextRequest, NextResponse }    from 'next/server';
import { unstable_noStore as noStore }  from 'next/cache';
import fs                               from 'fs';
import path                             from 'path';
import { DATA_DIR }                     from '@/lib/paths';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

const COLLECT_ENDPOINT = 'https://handsfree.app/api/collect.php';
const FEEDBACK_FILE    = path.join(DATA_DIR, 'feedback.jsonl');

/** Append feedback locally as a fallback. */
function saveLocally(payload: Record<string, string>): void {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        const line = JSON.stringify({ ...payload, savedAt: new Date().toISOString() }) + '\n';
        fs.appendFileSync(FEEDBACK_FILE, line, 'utf8');
    } catch {
        // Non-fatal
    }
}

export async function POST(req: NextRequest) {
    noStore();

    // â”€â”€ GDPR: Server-side opt-in check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
        const settingsPath = path.join(DATA_DIR, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            if (!settings.telemetry_enabled) {
                return NextResponse.json(
                    { success: false, reason: 'opt_in_disabled' },
                    { status: 403 }
                );
            }
        } else {
            // No settings file â†’ telemetry not enabled
            return NextResponse.json(
                { success: false, reason: 'opt_in_disabled' },
                { status: 403 }
            );
        }
    } catch {
        return NextResponse.json(
            { success: false, reason: 'settings_read_error' },
            { status: 500 }
        );
    }

    // â”€â”€ Parse payload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let payload: Record<string, string> = {};
    try {
        payload = (await req.json()) as Record<string, string>;
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    // â”€â”€ Sanitise: only forward expected keys â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const subtype = String(payload.subtype ?? '').slice(0, 32);
    if (subtype !== 'rating' && subtype !== 'feature_request') {
        return NextResponse.json({ success: false, error: 'Invalid subtype' }, { status: 400 });
    }

    const safe: Record<string, string> = {
        type:         'feedback',
        subtype,
        version:      String(payload.version ?? '').slice(0, 16),
        os:           String(payload.os ?? '').slice(0, 64),
        anonymous_id: String(payload.anonymous_id ?? '').slice(0, 64),
        timestamp:    String(payload.timestamp ?? new Date().toISOString()).slice(0, 64),
    };

    if (subtype === 'rating') {
        const validRatings = ['love_it', 'great', 'needs_improvement', 'unnecessary'];
        const rating = String(payload.rating ?? '');
        if (!validRatings.includes(rating)) {
            return NextResponse.json({ success: false, error: 'Invalid rating' }, { status: 400 });
        }
        safe.rating = rating;
        if (payload.message) safe.message = String(payload.message).slice(0, 500);
    } else {
        // feature_request
        const validCategories = ['performance', 'new_integration', 'ui_ux', 'other'];
        const category = String(payload.category ?? '');
        if (!validCategories.includes(category)) {
            return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 });
        }
        safe.category = category;
        safe.message = String(payload.message ?? '').slice(0, 2000);
        if (!safe.message || safe.message.length < 10) {
            return NextResponse.json({ success: false, error: 'Description too short' }, { status: 400 });
        }
    }

    // â”€â”€ POST to collect.php â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let remoteFailed = false;
    try {
        console.log('[feedback] Sending to collect.phpâ€¦', subtype);
        const res = await fetch(COLLECT_ENDPOINT, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(safe),
            cache:   'no-store',
            // @ts-ignore â€” AbortSignal.timeout is Node 17.3+
            signal:  AbortSignal.timeout(8_000),
        });
        if (!res.ok) {
            console.error('[feedback] collect.php returned', res.status);
            remoteFailed = true;
        } else {
            console.log('[feedback] collect.php accepted âœ“');
        }
    } catch (err: any) {
        console.error('[feedback] fetch failed:', err?.message);
        remoteFailed = true;
    }

    if (remoteFailed) {
        saveLocally(safe);
    }

    return NextResponse.json({ success: true, remote: !remoteFailed });
}
