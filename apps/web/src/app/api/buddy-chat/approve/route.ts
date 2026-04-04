/**
 * POST /api/buddy-chat/approve
 *
 * Handles user approval/decline of pending tool calls initiated by the buddy.
 *
 * Request body:
 *   { sessionId: string, toolCallIds: string[], approved: boolean }
 *
 * Response:
 *   { type: 'executed', content: string }  â€” tools ran successfully
 *   { type: 'cancelled' }                  â€” user declined
 *   { error: string }                      â€” failure
 */

import { NextResponse }                  from 'next/server';
import { unstable_noStore as noStore }   from 'next/cache';
import { loadSession, saveSession }      from '@/actions/chat';
import { agentExecute }                  from '@/actions/orchestrator';
import { serverT }                       from '@/lib/server-i18n';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
    noStore();

    let sessionId: string;
    let toolCallIds: string[];
    let approved: boolean;

    try {
        const body = await req.json() as {
            sessionId?: string;
            toolCallIds?: string[];
            approved?: boolean;
        };
        sessionId  = (body.sessionId ?? '').trim();
        toolCallIds = Array.isArray(body.toolCallIds) ? body.toolCallIds : [];
        approved   = body.approved === true;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // User declined â€” just clear pending and return
    if (!approved) {
        if (sessionId) {
            const session = await loadSession(sessionId);
            if (session) {
                delete (session as any).buddyPendingToolCalls;
                await saveSession(session);
            }
        }
        return NextResponse.json({ type: 'cancelled' });
    }

    try {
        // Load pending tool calls from session
        const session = await loadSession(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const pendingCalls: any[] = (session as any).buddyPendingToolCalls ?? [];
        if (pendingCalls.length === 0) {
            return NextResponse.json({ error: 'No pending tool calls' }, { status: 404 });
        }

        // Execute only the approved calls (pass confirmedToolCallIds to bypass gate)
        const results = await agentExecute(pendingCalls, toolCallIds);

        // Build summary
        const summaryParts = results.map(r => {
            const msg = r.displayMessage || (r.success ? 'Done.' : 'Failed.');
            return msg.length > 150 ? msg.slice(0, 147) + '...' : msg;
        });
        const summary = summaryParts.join(' ');

        // Clear pending and save result to session
        delete (session as any).buddyPendingToolCalls;
        session.messages.push({
            role: 'assistant',
            content: summary,
            timestamp: Date.now(),
            source: 'buddy',
        });
        await saveSession(session);

        return NextResponse.json({
            type: 'executed',
            content: summary,
            wasLong: summary.length > 200,
        });

    } catch (err: any) {
        console.error('[Hands Free Buddy] /api/buddy-chat/approve error:', err?.message ?? err);
        return NextResponse.json(
            { error: err?.message ?? serverT('system.errors.generic') },
            { status: 500 }
        );
    }
}
