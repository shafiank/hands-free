/**
 * GET /api/custom-endpoint/test
 *
 * Validates the stored custom endpoint configuration by sending a
 * minimal chat-completion request and checking for a valid response.
 *
 * Tries both /chat/completions and /v1/chat/completions so it works
 * regardless of whether the user typed the /v1 suffix or not.
 *
 * Response: { success: true }  |  { success: false, error: string }
 */

import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { loadSettings }               from '@/actions/chat';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

/** Normalise a user-supplied base URL — strip trailing slash, append /v1 if absent */
function normaliseBaseUrl(raw: string): string {
    const trimmed = raw.trim().replace(/\/$/, '');
    return trimmed.endsWith('/v1') ? trimmed : trimmed + '/v1';
}

export async function GET() {
    noStore();
    try {
        const settings  = await loadSettings().catch(() => ({} as any));
        const rawBase   = (settings.providers?.custom?.baseUrl  as string | undefined) || '';
        const apiKey    = (settings.providers?.custom?.apiKey   as string | undefined) || '';
        const model     = (settings.providers?.custom?.model    as string | undefined) || 'default';

        if (!rawBase.trim()) {
            return NextResponse.json(
                { success: false, error: 'No custom endpoint URL configured. Add it in Settings.' },
                { status: 400 }
            );
        }

        if (!model.trim()) {
            return NextResponse.json(
                { success: false, error: 'No model configured for custom endpoint.' },
                { status: 400 }
            );
        }

        const baseUrl  = normaliseBaseUrl(rawBase);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`;

        const payload = JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 5,
            temperature: 0,
        });

        // Try primary URL first, then fall back to the raw base without /v1
        const urls = [`${baseUrl}/chat/completions`];
        if (baseUrl.endsWith('/v1')) {
            urls.push(baseUrl.replace(/\/v1$/, '') + '/chat/completions');
        }

        let lastError = 'Connection failed';
        for (const url of urls) {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: payload,
                    signal: AbortSignal.timeout(15_000),
                });

                if (res.ok) {
                    return NextResponse.json({ success: true });
                }

                const errText  = await res.text().catch(() => '');
                let   errMsg   = `HTTP ${res.status}`;
                try { errMsg = JSON.parse(errText)?.error?.message || JSON.parse(errText)?.detail || errMsg; } catch { /* ignore */ }
                lastError = errMsg;

                // 401 / 403 → definitive auth failure, no need to retry
                if (res.status === 401 || res.status === 403) {
                    return NextResponse.json(
                        { success: false, error: `Authentication failed (${res.status}). Check your API key.` },
                        { status: 400 }
                    );
                }
            } catch (err: any) {
                lastError = err?.name === 'AbortError'
                    ? 'Request timed out - endpoint not responding'
                    : err?.message || lastError;
            }
        }

        return NextResponse.json({ success: false, error: lastError }, { status: 502 });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err?.message || 'Unexpected error' },
            { status: 500 }
        );
    }
}
