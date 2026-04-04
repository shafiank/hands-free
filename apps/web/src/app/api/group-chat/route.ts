// POST /api/group-chat
// Starts a Group Chat discussion and streams events as Server-Sent Events (SSE).
//
// Request body: { question: string, config: GroupChatConfig }
// Response:     text/event-stream — one JSON object per line: data: {...}\n\n
//
// The client reads the stream via fetch + response.body.getReader()
// and renders each event as it arrives.

import { NextRequest } from 'next/server';
import { runGroupDiscussion } from '@/skills/group-chat/group-chat-engine';

// Never cache — SSE streaming response
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import type { GroupChatEvent } from '@/skills/group-chat/group-chat-engine';
import type { GroupChatConfig } from '@/actions/skills';

export async function POST(req: NextRequest) {
    let question = '';
    let config: GroupChatConfig | undefined;

    try {
        const body = await req.json();
        question = body.question || '';
        config = body.config as GroupChatConfig;
    } catch {
        return new Response('Invalid request body', { status: 400 });
    }

    if (!question.trim()) {
        return new Response('question is required', { status: 400 });
    }

    if (!config || !config.participants || config.participants.length < 2) {
        return new Response('config with at least 2 participants is required', { status: 400 });
    }

    // AbortController chained to the HTTP connection so the discussion stops
    // if the client disconnects (browser tab closed, Stop button, etc.)
    const controller = new AbortController();
    req.signal.addEventListener('abort', () => controller.abort(), { once: true });

    const stream = new ReadableStream({
        async start(streamController) {
            const encoder = new TextEncoder();

            const emit = (event: GroupChatEvent) => {
                try {
                    streamController.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                } catch {
                    // Client may have disconnected — ignore enqueue errors
                }
            };

            try {
                await runGroupDiscussion(question, config!, emit, controller.signal);
            } catch (err: any) {
                emit({ type: 'error', error: err?.message || 'Unexpected engine error' });
                emit({ type: 'done' });
            } finally {
                try { streamController.close(); } catch { /* already closed */ }
            }
        },
        cancel() {
            controller.abort();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
    });
}
