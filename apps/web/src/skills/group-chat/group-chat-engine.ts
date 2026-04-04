// ============================================================
// Group Chat Engine â€” Sequential Multi-Persona Discussion
// ============================================================
// Runs a structured group discussion where multiple AI personas
// respond to a question in sequence, each "hearing" all previous
// responses before their turn.
//
// Architecture:
//   for each round (1..N):
//     for each participant (A, B, C, ...):
//       build context from history â†’ call agentDecide â†’ emit event
//   then: summarize discussion via first participant's provider
//
// Design decisions:
//   - Sequential (not parallel) so each LLM reads prior responses
//   - Configurable per-participant timeout (default 120s) via chained AbortController
//   - If a participant times out, skip them for that round with a "[Name] timed out" notice
//   - No tool calls â€” strong system prompt instruction + skip if LLM insists
//   - History is plain text, not stored in Hands Free memory
// ============================================================

import { agentDecide } from '@/actions/orchestrator';
import type { GroupChatConfig, GroupChatParticipant } from '@/actions/skills';
import type { Provider } from '@/actions/chat';

// â”€â”€â”€ Event Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type GroupChatEventType =
    | 'start'
    | 'thinking'
    | 'response'
    | 'error'
    | 'round_complete'
    | 'summary_thinking'
    | 'summary'
    | 'done'
    | 'abort';

export interface GroupChatEvent {
    type: GroupChatEventType;
    round?: number;
    totalRounds?: number;
    participantIndex?: number;
    participantName?: string;
    content?: string;
    model?: string;
    provider?: string;
    error?: string;
}

export type GroupChatEventCallback = (event: GroupChatEvent) => void;

// â”€â”€â”€ History Entry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface HistoryEntry {
    round: number;
    participantName: string;
    content: string;
}

// â”€â”€â”€ Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function runGroupDiscussion(
    question: string,
    config: GroupChatConfig,
    onEvent: GroupChatEventCallback,
    signal?: AbortSignal,
): Promise<void> {
    const history: HistoryEntry[] = [];

    onEvent({ type: 'start', totalRounds: config.rounds });

    for (let round = 1; round <= config.rounds; round++) {
        if (signal?.aborted) {
            onEvent({ type: 'abort' });
            return;
        }

        for (let pIdx = 0; pIdx < config.participants.length; pIdx++) {
            if (signal?.aborted) {
                onEvent({ type: 'abort' });
                return;
            }

            const participant = config.participants[pIdx];

            onEvent({
                type: 'thinking',
                round,
                totalRounds: config.rounds,
                participantIndex: pIdx,
                participantName: participant.name,
            });

            try {
                const timeoutMs = (config.participantTimeoutSeconds ?? 120) * 1000;
                const response = await callParticipant(question, participant, history, round, config.language, signal, timeoutMs);

                if (signal?.aborted) {
                    onEvent({ type: 'abort' });
                    return;
                }

                history.push({ round, participantName: participant.name, content: response.content });

                onEvent({
                    type: 'response',
                    round,
                    totalRounds: config.rounds,
                    participantIndex: pIdx,
                    participantName: participant.name,
                    content: response.content,
                    model: response.model,
                    provider: response.provider,
                });
            } catch (err: any) {
                const isTimeout = err?.name === 'AbortError' || /abort|timeout/i.test(err?.message || '');
                const errMsg = isTimeout
                    ? `${participant.name} timed out â€” skipping to next`
                    : (err?.message || 'Unknown error');
                onEvent({
                    type: 'error',
                    round,
                    participantIndex: pIdx,
                    participantName: participant.name,
                    error: errMsg,
                });
                // Continue with next participant â€” don't halt the whole discussion
            }
        }

        onEvent({ type: 'round_complete', round, totalRounds: config.rounds });
    }

    if (signal?.aborted) {
        onEvent({ type: 'abort' });
        return;
    }

    // â”€â”€ Final Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (history.length > 0) {
        onEvent({ type: 'summary_thinking' });
        try {
            const summary = await generateSummary(question, history, config, signal);
            if (!signal?.aborted) {
                onEvent({
                    type: 'summary',
                    content: summary.content,
                    model: summary.model,
                    provider: summary.provider,
                });
            }
        } catch (err: any) {
            onEvent({ type: 'error', error: `Summary failed: ${err?.message || 'Unknown error'}` });
        }
    }

    onEvent({ type: 'done' });
}

// â”€â”€â”€ Participant Call â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function callParticipant(
    question: string,
    participant: GroupChatParticipant,
    history: HistoryEntry[],
    currentRound: number,
    language: string,
    signal?: AbortSignal,
    timeoutMs: number = 120_000,
): Promise<{ content: string; model: string; provider: string }> {
    // Build discussion context from history so far
    const historyText = history.length > 0
        ? '\n\n--- Discussion so far ---\n' +
          history.map(h => `[${h.participantName}]: ${h.content}`).join('\n\n') +
          '\n--- End of discussion so far ---'
        : '';

    // Build system prompt: persona + no-tools instruction
    const systemPrompt = buildParticipantSystemPrompt(participant, language);

    // User message: question + accumulated context
    const userMessage = history.length === 0
        ? `The discussion topic is:\n\n"${question}"\n\nPlease share your perspective on this topic. Be direct and substantive.`
        : `The discussion topic is:\n\n"${question}"${historyText}\n\nIt is now your turn (Round ${currentRound}). Respond to the topic and engage with the previous responses above. Build on, challenge, or synthesize the ideas shared so far.`;

    // Per-participant timeout (default 120s, configurable), chained to main signal
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const participantSignal = chainSignals(signal, timeoutController.signal);

    try {
        const decision = await agentDecide(
            [{ role: 'user', content: userMessage }],
            {
                provider: participant.provider as Provider,
                model: participant.model,
                systemPrompt,
                signal: participantSignal,
            },
        );

        if (decision.decision === 'error') {
            throw new Error(decision.error || 'Agent returned an error');
        }

        if (decision.decision === 'tool') {
            // LLM tried to use tools despite instructions â€” return a skip notice
            return {
                content: '[This participant attempted to use tools, which is not supported in Group Chat. Response skipped.]',
                model: decision.model,
                provider: decision.provider,
            };
        }

        return {
            content: decision.response || '',
            model: decision.model,
            provider: decision.provider,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

// â”€â”€â”€ Summary Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function generateSummary(
    question: string,
    history: HistoryEntry[],
    config: GroupChatConfig,
    signal?: AbortSignal,
): Promise<{ content: string; model: string; provider: string }> {
    const firstParticipant = config.participants[0];

    const historyText = history
        .map(h => `[${h.participantName} â€” Round ${h.round}]: ${h.content}`)
        .join('\n\n');

    const summaryPrompt = `You are a neutral moderator summarizing a group discussion. Be concise and insightful.

The discussion topic was:
"${question}"

The participants discussed this topic over ${config.rounds} round(s). Here is the full discussion:

${historyText}

Please provide a concise synthesis of the key points raised, areas of agreement, notable disagreements or tensions, and any conclusions that emerged. Write in ${config.language}. Keep your summary to 3-5 paragraphs.`;

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 90_000);
    const summarySignal = chainSignals(signal, timeoutController.signal);

    try {
        const decision = await agentDecide(
            [{ role: 'user', content: 'Please provide the summary as instructed.' }],
            {
                provider: firstParticipant.provider as Provider,
                model: firstParticipant.model,
                systemPrompt: summaryPrompt,
                signal: summarySignal,
            },
        );

        if (decision.decision === 'error') {
            throw new Error(decision.error || 'Summary generation failed');
        }

        return {
            content: decision.response || 'Summary unavailable.',
            model: decision.model,
            provider: decision.provider,
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildParticipantSystemPrompt(participant: GroupChatParticipant, language: string): string {
    return [
        `You are ${participant.name}, a participant in a structured group discussion.`,
        '',
        'YOUR PERSONA:',
        participant.persona,
        '',
        `LANGUAGE: You must respond exclusively in ${language}.`,
        '',
        'CRITICAL RULES:',
        '- DO NOT use any tools, functions, or external capabilities. You have none available.',
        '- DO NOT make tool calls under any circumstances.',
        '- Respond directly as a discussion participant with your own perspective.',
        '- Keep your response focused and substantive (2-4 paragraphs).',
        '- Engage with other participants\' points when they are available.',
        '- Stay in character as described in your persona.',
    ].join('\n');
}

/**
 * Returns an AbortSignal that aborts when EITHER input signal aborts.
 */
function chainSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController();
    for (const s of signals) {
        if (!s) continue;
        if (s.aborted) {
            controller.abort();
            break;
        }
        s.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
}
