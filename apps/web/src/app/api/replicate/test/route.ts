/**
 * GET /api/replicate/test
 *
 * Validates the stored Replicate API token by making a lightweight
 * request to the Replicate account endpoint.
 *
 * Response: { success: true }  |  { success: false, error: string }
 */

import { NextResponse }             from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { loadSettings }              from '@/actions/chat';
import { serverT }                   from '@/lib/server-i18n';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    noStore();
    try {
        const settings = await loadSettings();
        const token = (settings as any).replicate_api_token as string | undefined;

        if (!token?.trim()) {
            return NextResponse.json(
                { success: false, error: serverT('settings.integrations.replicate.notConfigured') },
                { status: 400 }
            );
        }

        // Use the account endpoint — lightweight, always available with any valid token
        const res = await fetch('https://api.replicate.com/v1/account', {
            headers: {
                Authorization: `Bearer ${token.trim()}`,
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            let errMsg = `HTTP ${res.status}`;
            try { errMsg = JSON.parse(body)?.detail || errMsg; } catch { /* ignore */ }
            return NextResponse.json(
                { success: false, error: serverT('settings.integrations.replicate.testFailed') + ` (${errMsg})` },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err?.message ?? serverT('system.errors.generic') },
            { status: 500 }
        );
    }
}
