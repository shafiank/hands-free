/**
 * /api/buddy-memory  — Desktop Buddy short-term session memory
 *
 * POST { role: 'user' | 'assistant', content: string }
 *   → Appends a message to the current day's buddy session JSON.
 *      Files are stored at:  DATA_DIR/buddy/YYYY-MM-DD.json
 *      Each file is a JSON array of { role, content, ts } objects.
 *
 * GET
 *   → Returns today's session array (for optional display in the buddy UI).
 *
 * Silent by design — errors are swallowed so the buddy UI is never affected.
 */

import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '@/lib/paths';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

interface BuddyEntry {
    role:    'user' | 'assistant';
    content: string;
    ts:      number;
}

function todayFile(): string {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dir  = path.join(DATA_DIR, 'buddy');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${date}.json`);
}

function readSession(): BuddyEntry[] {
    try {
        return JSON.parse(fs.readFileSync(todayFile(), 'utf-8')) as BuddyEntry[];
    } catch {
        return [];
    }
}

function appendEntry(entry: BuddyEntry): void {
    const file    = todayFile();
    const session = readSession();
    session.push(entry);
    fs.writeFileSync(file, JSON.stringify(session, null, 2), 'utf-8');
}

export async function POST(req: Request) {
    noStore();
    try {
        const { role, content } = await req.json() as { role: string; content: string };
        if (!role || !content) return NextResponse.json({ ok: false }, { status: 400 });
        appendEntry({ role: role as 'user' | 'assistant', content, ts: Date.now() });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

export async function GET() {
    noStore();
    try {
        return NextResponse.json({ ok: true, session: readSession() });
    } catch {
        return NextResponse.json({ ok: true, session: [] });
    }
}
