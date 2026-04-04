/**
 * POST /api/bug-report
 *
 * Receives a bug report from the client (BugReportModal) and proxies it
 * to https://handsfree.app/api/collect.php server-side.
 *
 * WHY a proxy route?
 * The modal is a 'use client' component.  Direct cross-origin fetches from
 * Electron's renderer process are blocked by CORS/CSP.  By routing through
 * a Next.js API endpoint (same origin), we avoid CORS entirely and the
 * outbound call to collect.php happens server-to-server â€” identical to how
 * /api/handsfree-plus/waitlist works (which already reaches collect.php fine).
 *
 * Accepts: { type, version, description, os? }
 * Returns: { success: true } always â€” never surfaces remote errors to the UI.
 *
 * Fallback: if the remote POST fails, the payload is appended locally to
 * <DATA_DIR>/bugreports.jsonl so the user's report is never fully lost.
 */

import { NextRequest, NextResponse }    from 'next/server';
import { unstable_noStore as noStore }  from 'next/cache';
import fs                               from 'fs';
import path                             from 'path';
import { DATA_DIR }                     from '@/lib/paths';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

const COLLECT_ENDPOINT  = 'https://handsfree.app/api/collect.php';
const BUGREPORTS_FILE   = path.join(DATA_DIR, 'bugreports.jsonl');

/** Append the report to a local JSONL file as a fallback. */
function saveLocally(payload: Record<string, string>): void {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        const line = JSON.stringify({ ...payload, savedAt: new Date().toISOString() }) + '\n';
        fs.appendFileSync(BUGREPORTS_FILE, line, 'utf8');
    } catch {
        // Non-fatal â€” if local save also fails, nothing we can do
    }
}

export async function POST(req: NextRequest) {
    noStore();

    let payload: Record<string, string> = {};
    try {
        payload = (await req.json()) as Record<string, string>;
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    // Sanitise: only forward expected keys, never proxy unexpected data
    const safe: Record<string, string> = {
        type:    'bugreport',
        version: String(payload.version ?? ''),
        description: String(payload.description ?? '').slice(0, 2000),
    };
    if (payload.os) safe.os = String(payload.os).slice(0, 64);

    // Basic validation
    if (!safe.description || safe.description.length < 10) {
        return NextResponse.json({ success: false, error: 'Description too short' }, { status: 400 });
    }

    // POST to collect.php server-side (same pattern as /api/handsfree-plus/waitlist)
    let remoteFailed = false;
    try {
        console.log('[bug-report] Sending to collect.phpâ€¦');
        const res = await fetch(COLLECT_ENDPOINT, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(safe),
            cache:   'no-store',
            // @ts-ignore â€” AbortSignal.timeout is Node 17.3+ / available in Next.js 14
            signal:  AbortSignal.timeout(8_000),
        });
        if (!res.ok) {
            console.error('[bug-report] collect.php returned', res.status);
            remoteFailed = true;
        } else {
            console.log('[bug-report] collect.php accepted the report âœ“');
        }
    } catch (err: any) {
        console.error('[bug-report] fetch to collect.php failed:', err?.message);
        remoteFailed = true;
    }

    // Local fallback if remote failed
    if (remoteFailed) {
        saveLocally(safe);
    }

    // Always return success â€” the UI shows "Thanks!" either way
    return NextResponse.json({ success: true, remote: !remoteFailed });
}
