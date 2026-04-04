import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Never cache â€” live webhook event handler
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { DATA_DIR } from '@/lib/paths';
const WEBHOOK_FILE = path.join(DATA_DIR, 'integrations', 'webhook.json');
const INBOX_FILE = path.join(DATA_DIR, 'integrations', 'webhook-inbox.json');

function loadConfig() {
    try {
        if (fs.existsSync(WEBHOOK_FILE)) return JSON.parse(fs.readFileSync(WEBHOOK_FILE, 'utf-8'));
    } catch { }
    return null;
}

export async function GET(_req: NextRequest) {
    const config = loadConfig();
    if (!config?.enabled) return NextResponse.json({ status: 'disabled', message: 'Webhook not enabled. Configure in Settings â†’ Skills â†’ Webhooks.' });
    return NextResponse.json({
        status: 'active',
        message: 'Hands Free Webhook is active. POST JSON with {"secret":"...", "message":"..."} or use header X-Webhook-Secret.',
    });
}

export async function POST(req: NextRequest) {
    try {
        const config = loadConfig();
        if (!config?.enabled) {
            return NextResponse.json({ error: 'Webhook not enabled' }, { status: 403 });
        }

        let body: Record<string, unknown> = {};
        try { body = await req.json(); } catch { }

        const providedSecret = req.headers.get('x-webhook-secret') || (body.secret as string);
        if (providedSecret !== config.secret) {
            return NextResponse.json({ error: 'Invalid or missing secret' }, { status: 401 });
        }

        const message = (body.message || body.text || body.content || 'Webhook triggered') as string;
        const source = (body.source as string) || 'webhook';

        // Write to inbox
        let inbox: unknown[] = [];
        try {
            if (fs.existsSync(INBOX_FILE)) {
                const existing = JSON.parse(fs.readFileSync(INBOX_FILE, 'utf-8'));
                inbox = Array.isArray(existing) ? existing : [];
            }
        } catch { }
        inbox.push({ id: Date.now().toString(), message, source, timestamp: new Date().toISOString(), processed: false });
        fs.mkdirSync(path.dirname(INBOX_FILE), { recursive: true });
        fs.writeFileSync(INBOX_FILE, JSON.stringify(inbox.slice(-100), null, 2));

        // Fire-and-forget: forward to Hands Free brain via chat API
        const host = req.headers.get('host') || 'localhost:3000';
        fetch(`http://${host}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: `[WEBHOOK von ${source}]: ${message}` }],
                sessionId: `webhook-${Date.now()}`,
            }),
        }).catch(() => { /* ignore */ });

        return NextResponse.json({ success: true, received: message });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
