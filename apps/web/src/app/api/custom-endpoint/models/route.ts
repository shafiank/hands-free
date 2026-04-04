/**
 * GET /api/custom-endpoint/models
 *
 * Fetches the list of available models from the user's custom
 * OpenAI-compatible endpoint by calling GET {baseUrl}/models
 * (with automatic /v1 normalisation as a fallback).
 *
 * Response (success):
 *   { success: true, models: { id: string; name: string }[] }
 *
 * Response (failure):
 *   { success: false, error: string }
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
        const rawBase   = (settings.providers?.custom?.baseUrl as string | undefined) || '';
        const apiKey    = (settings.providers?.custom?.apiKey  as string | undefined) || '';

        if (!rawBase.trim()) {
            return NextResponse.json(
                { success: false, error: 'No custom endpoint URL configured. Add it in Settings.' },
                { status: 400 }
            );
        }

        const baseUrl = normaliseBaseUrl(rawBase);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`;

        // Try the /models endpoint (some servers don't prefix /v1, try both)
        const urls = [`${baseUrl}/models`];
        // If baseUrl already ends with /v1, also try without it as a fallback
        if (baseUrl.endsWith('/v1')) {
            urls.push(baseUrl.replace(/\/v1$/, '') + '/models');
        }

        let lastError = 'Could not fetch models from endpoint';
        for (const url of urls) {
            try {
                const res = await fetch(url, {
                    headers,
                    signal: AbortSignal.timeout(10_000),
                });
                if (!res.ok) {
                    lastError = `HTTP ${res.status} from ${url}`;
                    continue;
                }
                const data = await res.json();

                // OpenAI format: { data: [{ id, object, ... }] }
                const rawList: any[] = Array.isArray(data.data)
                    ? data.data
                    : Array.isArray(data.models)
                        ? data.models      // some servers use { models: [] }
                        : Array.isArray(data)
                            ? data         // bare array
                            : [];

                const models = rawList
                    .filter((m: any) => typeof m === 'object' && (m.id || m.name))
                    .map((m: any) => ({
                        id:   m.id   || m.name || '',
                        name: m.name || m.id   || '',
                    }))
                    .filter(m => m.id);

                return NextResponse.json({ success: true, models });
            } catch (err: any) {
                lastError = err?.message || lastError;
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
