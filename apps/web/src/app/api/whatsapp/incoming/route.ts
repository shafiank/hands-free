import { NextRequest, NextResponse } from 'next/server';
import { createSession, loadSession, saveSession, loadSettings, type ChatMessage } from '@/actions/chat';
import { agentDecide, agentExecute } from '@/actions/orchestrator';
import { getWhatsAppMode } from '@/actions/whatsapp';
import fs from 'fs';
import path from 'path';

// Never cache â€” live incoming message handler
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { DATA_DIR } from '@/lib/paths';
const ACTIVE_SESSION_FILE = path.join(DATA_DIR, 'active-session.json');
const WA_SESSION_FILE = path.join(DATA_DIR, 'integrations', 'whatsapp-session-id.json');

const BOT_PORT = 3009;
const BOT_URL = `http://127.0.0.1:${BOT_PORT}`;

async function sendBotMessage(to: string, text: string) {
    try {
        await fetch(`${BOT_URL}/send`, {
            method: 'POST',
            signal: AbortSignal.timeout(10_000),
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, message: text }),
        });
    } catch (e) {
        console.warn('[WhatsApp Incoming] Failed to send reply via bot:', e);
    }
}

function getActiveSessionId(): string | null {
    try {
        if (fs.existsSync(ACTIVE_SESSION_FILE)) {
            const data = JSON.parse(fs.readFileSync(ACTIVE_SESSION_FILE, 'utf-8'));
            if (data.sessionId) return data.sessionId;
        }
    } catch { }
    try {
        if (fs.existsSync(WA_SESSION_FILE)) {
            const data = JSON.parse(fs.readFileSync(WA_SESSION_FILE, 'utf-8'));
            return data.sessionId || null;
        }
    } catch { }
    return null;
}

function setActiveSessionId(sessionId: string) {
    try {
        const dir = path.dirname(WA_SESSION_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(WA_SESSION_FILE, JSON.stringify({ sessionId, updatedAt: Date.now() }));
    } catch { }
}

// â”€â”€â”€ POST /api/whatsapp/incoming â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Called by whatsapp-bot.js when a message is received in Read & Write mode.

export async function POST(req: NextRequest) {
    try {
        // Verify Read & Write mode is enabled â€” security gate
        const mode = await getWhatsAppMode();
        if (mode !== 'readWrite') {
            return NextResponse.json({ success: false, error: 'Read & Write mode is not enabled' }, { status: 403 });
        }

        const body = await req.json();
        const { message, from, senderName } = body;

        if (!message || !from) {
            return NextResponse.json({ success: false, error: 'Missing message or from' }, { status: 400 });
        }

        const settings = await loadSettings();

        // Get or create session
        let sessionId = getActiveSessionId();
        let session: any = sessionId ? await loadSession(sessionId) : null;

        if (!session) {
            session = await createSession(`WhatsApp Chat with ${senderName || from}`, 'handsfree');
            sessionId = session.id;
            setActiveSessionId(sessionId!);
        }

        // Build persona + system prompt (same logic as Telegram)
        const { buildContext } = await import('@/actions/identity');
        const identityContext = await buildContext();
        const persona = settings.persona || 'default';
        const nativeLanguage = (settings as any).nativeLanguage || null;
        const langInstruction = nativeLanguage
            ? `Always reply in ${nativeLanguage} unless the user explicitly writes in another language.`
            : `Reply in the same language the user writes in.`;

        const PERSONA_PROMPTS: Record<string, string> = {
            default: `You are Hands Free, a friendly and capable AI assistant. ${langInstruction}`,
            entrepreneur: `You are Hands Free in Entrepreneur mode. Sharp business advisor.`,
            family: `You are Hands Free in Family mode. Warm, patient helper for everyday tasks.`,
            coder: `You are Hands Free in Coder mode. Senior software engineer.`,
            student: `You are Hands Free in Student mode. Patient tutor.`,
        };
        const basePersona = settings.systemPrompt || PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.default;

        const systemPrompt = `${basePersona}

${identityContext}

## You are operating via WhatsApp (Read & Write mode)
The contact "${senderName || from}" is messaging you through WhatsApp. You have all Hands Free agent capabilities available.
Keep responses concise â€” WhatsApp users prefer short, clear replies.
${langInstruction}`;

        // Add user message
        const userMsg: ChatMessage = {
            role: 'user',
            content: message,
            timestamp: Date.now(),
        };
        (userMsg as any).source = 'whatsapp';
        (userMsg as any).whatsappFrom = from;
        (userMsg as any).senderName = senderName;
        session.messages.push(userMsg);
        await saveSession(session);

        // Run agent loop (max 4 iterations)
        const MAX_LOOPS = 4;
        let loopCount = 0;
        let finalResponse = '';
        const sessionHistory = session.messages.filter((m: ChatMessage) => m.role !== 'system').slice(-20);
        let currentMessages = [...sessionHistory];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180_000); // 3-minute timeout

        try {
            while (loopCount < MAX_LOOPS) {
                if (controller.signal.aborted) break;
                loopCount++;

                const apiMessages = [
                    { role: 'system', content: systemPrompt },
                    ...currentMessages.map((m: ChatMessage) => ({
                        role: m.role, content: m.content,
                        tool_calls: m.tool_calls, tool_call_id: m.tool_call_id, name: m.name,
                    })),
                ];

                const decision = await agentDecide(apiMessages as any, {
                    provider: settings.activeProvider,
                    model: settings.providers[settings.activeProvider].model,
                    signal: controller.signal,
                });

                if (decision.decision === 'error') {
                    finalResponse = `âš ï¸ ${decision.error || 'An error occurred.'}`;
                    break;
                }

                if (decision.decision === 'response') {
                    finalResponse = decision.response || '';
                    const assistantMsg: ChatMessage = { role: 'assistant', content: finalResponse, timestamp: Date.now() };
                    (assistantMsg as any).source = 'whatsapp';
                    session.messages.push(assistantMsg);
                    await saveSession(session);
                    break;
                }

                if (decision.decision === 'tool') {
                    const toolCalls = decision.toolCalls!;
                    const thoughtMsg: ChatMessage = {
                        role: 'assistant', content: decision.response || '',
                        tool_calls: toolCalls, timestamp: Date.now(),
                    };
                    (thoughtMsg as any).source = 'whatsapp';
                    session.messages.push(thoughtMsg);
                    currentMessages.push(thoughtMsg);
                    await saveSession(session);

                    const results = await agentExecute(toolCalls);
                    for (let i = 0; i < results.length; i++) {
                        const toolMsg: ChatMessage = {
                            role: 'tool', content: JSON.stringify(results[i].result),
                            tool_call_id: toolCalls[i].id, name: toolCalls[i].function.name,
                            display_message: results[i].displayMessage, timestamp: Date.now(),
                        };
                        session.messages.push(toolMsg);
                        currentMessages.push(toolMsg);
                    }
                    await saveSession(session);
                }
            }
        } finally {
            clearTimeout(timeoutId);
        }

        if (!finalResponse) {
            finalResponse = 'âš ï¸ No response generated. Please try again.';
        }

        // Send reply via bot
        await sendBotMessage(from, finalResponse);

        return NextResponse.json({ success: true, response: finalResponse });

    } catch (error: any) {
        console.error('[WhatsApp Incoming API] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
