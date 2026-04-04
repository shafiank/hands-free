/**
 * Hands Free â€” Autonomous Runner (Phase 5: Full Autopilot Edition)
 *
 * Singleton background heartbeat with:
 *   - Real LLM execution + skill dispatch via skill-dispatcher.ts
 *   - Anti-Loop Protocol (max_retries â†’ blocked)
 *   - Human-in-the-Loop (requires_approval gate)
 *   - API Cost Control (maxCallsPerHour rate limiter)
 *   - OODA self-correction (tasks can rewrite pending plan)
 *   - Full autopilot_logs.json logging
 *   - STRICT ISOLATION: never touches user's foreground UI/sessions
 */

import {
    updateTask, getExecutablePendingTasks, getTasksAwaitingApproval,
    incrementRetryAndRequeue, AgentTask, getTaskStats,
} from '@/lib/agent-tasks';
import { log } from '@/lib/autopilot-logger';
import { dispatchSkill, parseSkillFromTask, detectCriticalAction } from '@/lib/skill-dispatcher';

// â”€â”€ Cron dedup map: cronId â†’ last execution timestamp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Prevents the same cron job from firing twice within its own interval window.
const cronLastRanAt: Map<string, number> = new Map();

// â”€â”€â”€ Module-level singleton state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let isProcessingTask = false;
let runnerEnabled    = false;

// â”€â”€ Cost Control: rolling API call counter (per hour) â”€â”€â”€â”€â”€â”€â”€â”€â”€
let apiCallsThisHour    = 0;
let hourWindowStartMs   = Date.now();
const HOUR_MS           = 60 * 60 * 1000;

// â”€â”€ Configurable limits (overridden at runtime from settings) â”€â”€
let MAX_CALLS_PER_HOUR  = 20;   // default: 20 LLM calls/hour max
let PAUSE_AFTER_TASKS   = 0;    // 0 = unlimited; >0 = pause after N tasks
let tasksCompletedThisSession = 0;
let autopilotPausedForCost    = false;

// â”€â”€ Cost-pause persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Persist the cost-pause flag and counters to disk so a server restart
// doesn't reset rate limits mid-hour.
import { DATA_DIR } from '@/lib/paths';
import fsMod from 'fs';
import pathMod from 'path';

const COST_STATE_FILE = pathMod.join(DATA_DIR, 'autopilot-cost-state.json');

interface CostState {
    paused: boolean;
    apiCallsThisHour: number;
    hourWindowStartMs: number;
    tasksCompletedThisSession: number;
}

function loadCostState(): void {
    try {
        if (!fsMod.existsSync(COST_STATE_FILE)) return;
        const data: CostState = JSON.parse(fsMod.readFileSync(COST_STATE_FILE, 'utf8'));
        // Only restore if we're still within the same hour window
        if (Date.now() - data.hourWindowStartMs < HOUR_MS) {
            apiCallsThisHour           = data.apiCallsThisHour;
            hourWindowStartMs          = data.hourWindowStartMs;
            tasksCompletedThisSession  = data.tasksCompletedThisSession;
            autopilotPausedForCost     = data.paused;
        }
    } catch { /* corrupt file â€” start fresh */ }
}

function saveCostState(): void {
    try {
        if (!fsMod.existsSync(DATA_DIR)) fsMod.mkdirSync(DATA_DIR, { recursive: true });
        const state: CostState = {
            paused: autopilotPausedForCost,
            apiCallsThisHour,
            hourWindowStartMs,
            tasksCompletedThisSession,
        };
        fsMod.writeFileSync(COST_STATE_FILE, JSON.stringify(state), 'utf8');
    } catch { /* non-fatal */ }
}

// Restore on module load
loadCostState();

const HEARTBEAT_INTERVAL_MS   = 5 * 60 * 1000; // 5 minutes
const DEFAULT_TIMEOUT_SECONDS = 300;

// â”€â”€â”€ Rate Limiter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function checkRateLimit(): { allowed: boolean; reason?: string } {
    const now = Date.now();
    // Reset hourly window
    if (now - hourWindowStartMs > HOUR_MS) {
        apiCallsThisHour  = 0;
        hourWindowStartMs = now;
    }

    if (MAX_CALLS_PER_HOUR > 0 && apiCallsThisHour >= MAX_CALLS_PER_HOUR) {
        return { allowed: false, reason: `API rate limit reached: ${apiCallsThisHour}/${MAX_CALLS_PER_HOUR} calls this hour.` };
    }

    if (PAUSE_AFTER_TASKS > 0 && tasksCompletedThisSession >= PAUSE_AFTER_TASKS) {
        return { allowed: false, reason: `Paused after completing ${PAUSE_AFTER_TASKS} tasks. Awaiting user acknowledgment.` };
    }

    return { allowed: true };
}

function incrementApiCalls(count: number = 1) {
    apiCallsThisHour += count;
    saveCostState();
}

// â”€â”€â”€ Telegram approval notifier â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Non-fatal â€” called after a task is flagged for approval so the user
// can approve/reject directly from Telegram without opening the dashboard.
async function notifyTelegramApprovalRequired(task: AgentTask, reason: string): Promise<void> {
    try {
        const { loadTelegramConfig, sendMessage } = await import('@/actions/telegram');
        const tgCfg = await loadTelegramConfig();
        if (!tgCfg?.enabled || !tgCfg?.botToken || !tgCfg?.pairedChatId) return;
        const msg =
            `ðŸ” *Autopilot Approval Required*\n\n` +
            `Task: *${task.title}*\n` +
            `Reason: ${reason}\n\n` +
            `Reply with:\n` +
            `â€¢ \`approve ${task.id}\` â€” run the task\n` +
            `â€¢ \`reject ${task.id}\` â€” cancel the task`;
        await sendMessage(tgCfg.botToken, String(tgCfg.pairedChatId), msg);
    } catch { /* non-fatal â€” Telegram may not be configured */ }
}

// â”€â”€â”€ LLM direct caller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ ReAct Task Executor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Replaces the old single-shot LLM call with a full agentic execution via the
// orchestrator. The orchestrator provides:
//   â€¢ All configured tools (web_search, write_file, send_email, execute, â€¦)
//   â€¢ A ReAct loop: Reason â†’ choose tool â†’ Act â†’ Observe result â†’ reason again
//   â€¢ Automatic capability detection (the agent picks the right tools itself)
//
// The agent is instructed to actually complete the task, not describe it.
// This is the difference between a REACTIVE assistant and an AUTONOMOUS agent.
//
async function _callLlmForTask(task: AgentTask, settings: any): Promise<string> {
    // Build the autonomous execution message.
    // The orchestrator's own system prompt (identity + capabilities) is injected
    // automatically by agentDecide â€” we only need to supply the task context.
    const taskMessage = [
        `[AUTONOMOUS BACKGROUND TASK â€” no user present, execute independently]`,
        ``,
        `TASK: ${task.title}`,
        `INSTRUCTIONS:\n${task.description}`,
        `PRIORITY: ${task.priority}`,
        task.planTitle ? `PROJECT: ${task.planTitle}` : '',
        task.tags?.length ? `TAGS: ${task.tags.join(', ')}` : '',
        ``,
        `EXECUTION RULES:`,
        `- Use your tools to ACTUALLY complete this task, do NOT just describe how you would do it.`,
        `- Reason step by step: What do I need? â†’ Call the right tool â†’ Observe the result â†’ Continue.`,
        `- If a tool fails, try an alternative approach â€” do not give up on first error.`,
        `- When done, write a short factual summary of exactly what was accomplished.`,
        `- If the task is genuinely impossible (e.g. requires physical hardware), say so in one sentence.`,
    ].filter(Boolean).join('\n');

    try {
        // Route through the full orchestrator â€” identical to interactive chat but
        // with an autonomous-task framing. The orchestrator handles:
        //   1. agentDecide  â€” LLM reasons and picks tools
        //   2. agentExecute â€” tools run for real (web search, file write, email, â€¦)
        //   3. agentFinalizeâ€” LLM synthesizes tool results into a conclusion
        const { processMessageWithTools } = await import('@/actions/orchestrator');
        // Fix 20: count actual LLM reasoning steps (each 'thinking' = one agentDecide call)
        let stepCount = 0;
        const result = await processMessageWithTools(taskMessage, [], {
            provider: task.assignedProvider as any,
            model:    task.assignedModel,
            onStep: (step) => {
                try {
                    if (step.type === 'thinking') {
                        stepCount++;
                        log.info('task_thinking', `ðŸ§  ${step.content.substring(0, 200)}`, { taskId: task.id, taskTitle: task.title });
                    } else if (step.type === 'tool_call') {
                        log.info('task_tool_call', `ðŸ”§ ${step.toolName}(${step.content.substring(0, 150)})`, { taskId: task.id, taskTitle: task.title, detail: { tool: step.toolName } });
                    } else if (step.type === 'tool_result') {
                        log.info('task_tool_result', `ðŸ“Ž ${step.toolName}: ${step.content.substring(0, 200)}`, { taskId: task.id, taskTitle: task.title, detail: { tool: step.toolName } });
                    }
                } catch { /* non-fatal â€” logging should never break execution */ }
            },
        });
        // Count the actual number of LLM calls made (min 1 to always charge something)
        incrementApiCalls(stepCount || 1);

        const summary = (result.response ?? '').trim();
        const toolsUsed = result.toolResults?.map((r: any) => r.toolName).filter(Boolean) ?? [];

        // If the orchestrator returned an error response (starts with âš ï¸ or contains abort/timeout
        // keywords), treat it as a failure so the task is retried/blocked rather than completed.
        const isErrorResponse = summary.startsWith('âš ï¸') ||
            /aborted|timed?\s?out|operation\s+was\s+aborted/i.test(summary);
        if (isErrorResponse) {
            throw new Error(summary.replace(/^âš ï¸\s*/, ''));
        }

        // Append a compact tool-use log so the result card in the UI is informative.
        if (toolsUsed.length > 0) {
            return `${summary}\n\nâ”€â”€â”€ Tools used: ${toolsUsed.join(', ')}`;
        }
        return summary || 'Task executed â€” no text output produced.';

    } catch (orchErr: any) {
        // Orchestrator unavailable (e.g. missing API key for this provider) â€”
        // fall back to a bare minimum single-shot call so the task isn't just blocked.
        console.warn(`[AutonomousRunner] Orchestrator failed for "${task.title}": ${orchErr?.message}. Falling back to direct call.`);

        const provider = task.assignedProvider ?? settings?.activeProvider ?? 'openrouter';
        const provCfg  = settings?.providers?.[provider] ?? {};
        const model    = task.assignedModel ?? provCfg.model ?? 'gpt-4o-mini';
        const apiKey   = provCfg.apiKey ?? '';
        if (!apiKey) throw new Error(`No API key for provider "${provider}".`);

        const fallbackSystem = `You are Hands Free Autopilot executing: "${task.title}". Instructions: ${task.description}. Be concise.`;
        const fallbackMsg    = `Complete this task and summarize what you did: ${task.title}`;

        if (provider === 'anthropic') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model, max_tokens: 1024, system: fallbackSystem, messages: [{ role: 'user', content: fallbackMsg }] }),
            });
            if (!res.ok) throw new Error(`Anthropic ${res.status}`);
            return (await res.json()).content?.[0]?.text?.trim() ?? '';
        }

        const endpointMap: Record<string, string> = {
            openrouter: 'https://openrouter.ai/api/v1/chat/completions',
            openai:     'https://api.openai.com/v1/chat/completions',
            groq:       'https://api.groq.com/openai/v1/chat/completions',
        };
        const ep = endpointMap[provider] ?? 'https://openrouter.ai/api/v1/chat/completions';

        const res = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: fallbackSystem }, { role: 'user', content: fallbackMsg }], max_tokens: 1024 }),
        });
        if (!res.ok) throw new Error(`${provider} ${res.status}`);
        return (await res.json()).choices?.[0]?.message?.content?.trim() ?? '';
    }
}

// â”€â”€â”€ Core Task Executor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function executeTask(task: AgentTask, timeoutMs: number, settings: any): Promise<string> {
    log.info('task_started', `Starting: "${task.title}"`, {
        taskId: task.id, taskTitle: task.title,
        detail: { priority: task.priority, attempt: (task.retryCount ?? 0) + 1, provider: task.assignedProvider },
    });
    console.log(`[AutonomousRunner] â–¶  "${task.title}" (attempt ${(task.retryCount ?? 0) + 1})`);

    // â”€â”€ [STANDUP] handler: generate stand-up report + deliver via Telegram â”€â”€
    if (task.description?.includes('[STANDUP]') || task.title?.includes('Stand-up')) {
        incrementApiCalls();
        const { generateStandupReport } = await import('@/actions/autopilot');
        const standupResult = await generateStandupReport();
        if (!standupResult.success) throw new Error(standupResult.error ?? 'Stand-up generation failed');

        const report = standupResult.report ?? 'No report generated.';

        // Deliver via Telegram if configured
        try {
            const { loadTelegramConfig, sendMessage } = await import('@/actions/telegram');
            const tgCfg = await loadTelegramConfig();
            if (tgCfg?.enabled && tgCfg?.botToken && tgCfg?.pairedChatId) {
                await sendMessage(
                    tgCfg.botToken,
                    String(tgCfg.pairedChatId),
                    `ðŸ“‹ *Daily Stand-up Report*\n\n${report.slice(0, 3500)}`,
                );
                log.success('standup_generated', `ðŸ“‹ Stand-up report delivered via Telegram.`);
            }
        } catch (tgErr: any) {
            console.warn('[AutonomousRunner] Telegram standup delivery failed:', tgErr?.message);
        }

        return report;
    }

    // Check if the task has a [SKILL:xxx] tag â†’ dispatch to skill handler
    const skillCall = parseSkillFromTask(task);
    if (skillCall) {
        incrementApiCalls(); // skill dispatch also counts as API call
        const skillResult = await dispatchSkill(skillCall.skillId, task, settings, skillCall.params);
        if (!skillResult.success) throw new Error(skillResult.error ?? `Skill "${skillCall.skillId}" failed.`);
        return skillResult.output ?? `Skill "${skillCall.skillId}" executed successfully.`;
    }

    // No skill tag â†’ generic LLM execution
    // (incrementApiCalls is called inside _callLlmForTask with the actual step count â€” Fix 20)
    const workPromise    = _callLlmForTask(task, settings);
    const timeoutPromise = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs),
    );
    return Promise.race([workPromise, timeoutPromise]);
}

// â”€â”€â”€ Cron Job Tick â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Checks stored cron jobs for due schedules and queues them as tasks.
// Guards: dedup by cronId (cronLastRanAt) prevents back-to-back firings.

async function tickCronJobs(): Promise<void> {
    try {
        const { listCronJobs, createTask } = await import('@/actions/tasks');
        const jobs = await listCronJobs();
        if (!jobs || jobs.length === 0) return;

        const now = Date.now();

        for (const job of jobs) {
            if (!job.enabled) continue;

            // Parse cron expression to determine minimum interval in ms.
            // We use a simple approach: track lastRanAt and require at least
            // the cron's shortest possible interval to have elapsed.
            // For daily (0 3 * * *) â†’ 24h; for hourly â†’ 1h; for weekly â†’ 7d.
            // Minimum enforced gap: 55 minutes (prevents double-fire within same hour slot).
            const MIN_GAP_MS = 55 * 60 * 1000; // 55 minutes
            const lastRan = cronLastRanAt.get(job.id) ?? (job.lastRun ?? 0);
            if (now - lastRan < MIN_GAP_MS) continue;

            // Full 5-field cron due-check: minute hour dayOfMonth month dayOfWeek
            const parts = (job.schedule ?? '').split(/\s+/);
            if (parts.length < 5) continue;

            const [minPart, hourPart, domPart, monthPart, dowPart] = parts;
            const nowDate = new Date();
            const nowMin  = nowDate.getMinutes();
            const nowHour = nowDate.getHours();
            const nowDom  = nowDate.getDate();        // 1-31
            const nowMon  = nowDate.getMonth() + 1;   // 1-12
            const nowDow  = nowDate.getDay();          // 0=Sun, 6=Sat

            // Match a single cron field against a current value.
            // Supports: '*', exact number, comma-separated list, ranges (e.g. '1-5'),
            // and step values (e.g. '*/5', '1-10/2').
            const cronFieldMatch = (field: string, current: number): boolean => {
                if (field === '*') return true;
                // Handle comma-separated values
                return field.split(',').some(part => {
                    // Handle step: */N or range/N
                    const [rangePart, stepStr] = part.split('/');
                    const step = stepStr ? parseInt(stepStr, 10) : 0;
                    if (rangePart === '*' && step > 0) {
                        return current % step === 0;
                    }
                    // Handle range: A-B
                    const dashIdx = rangePart.indexOf('-');
                    if (dashIdx !== -1) {
                        const lo = parseInt(rangePart.slice(0, dashIdx), 10);
                        const hi = parseInt(rangePart.slice(dashIdx + 1), 10);
                        if (current < lo || current > hi) return false;
                        return step > 0 ? (current - lo) % step === 0 : true;
                    }
                    // Exact value
                    return parseInt(rangePart, 10) === current;
                });
            };

            if (!cronFieldMatch(minPart,   nowMin))  continue;
            if (!cronFieldMatch(hourPart,  nowHour)) continue;
            if (!cronFieldMatch(monthPart, nowMon))  continue;

            // Day matching: standard cron uses OR logic when both dom and dow are specified
            // (i.e. fire if EITHER day-of-month OR day-of-week matches).
            // When only one is specified (the other is '*'), match that one alone.
            const domIsWild = domPart === '*';
            const dowIsWild = dowPart === '*';
            if (domIsWild && dowIsWild) {
                // Both wildcard â€” always matches
            } else if (!domIsWild && dowIsWild) {
                if (!cronFieldMatch(domPart, nowDom)) continue;
            } else if (domIsWild && !dowIsWild) {
                if (!cronFieldMatch(dowPart, nowDow)) continue;
            } else {
                // Both specified â€” OR logic (standard cron behavior)
                if (!cronFieldMatch(domPart, nowDom) && !cronFieldMatch(dowPart, nowDow)) continue;
            }

            // Mark as running immediately to prevent double-dispatch
            cronLastRanAt.set(job.id, now);
            log.info('heartbeat_tick', `â° Cron "${job.name}" is due â€” queuing task.`);
            console.log(`[AutonomousRunner] â° Cron due: "${job.name}"`);

            try {
                await createTask({
                    title:       job.name,
                    description: `[CRON] ${job.task}`,
                    priority:    'normal',
                });
            } catch (err: any) {
                log.error('heartbeat_tick', `Failed to queue cron task "${job.name}": ${err?.message}`);
            }
        }
    } catch (err) {
        console.error('[AutonomousRunner] Cron tick error:', err);
    }
}

// â”€â”€â”€ Friend Mode heartbeat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Reads activeUserBehavior settings, checks quiet hours and cooldown,
// reads recent conversation context, then sends ONE context-aware message
// via Telegram (and/or dashboard bubble). Runs silently â€” no session writes,
// no visible user/assistant messages, no tool-call reasoning leaked to chat.

// Track last Friend Mode message timestamps (cronId â†’ ms)
const friendModeLastSentAt: Map<string, number> = new Map();

// Cooldown in ms per frequency setting
const FRIEND_MODE_COOLDOWN: Record<string, number> = {
    low:    24 * 60 * 60 * 1000,  // ~once/day
    medium:  6 * 60 * 60 * 1000,  // ~few/day (every 6 hours)
    high:    1 * 60 * 60 * 1000,  // ~hourly
};

async function tickFriendMode(settings: any): Promise<void> {
    const behavior = settings?.activeUserBehavior;
    if (!behavior?.enabled) return;

    // Quiet hours check
    const nowHour = new Date().getHours();
    const qStart = behavior.quietHoursStart ?? 22;
    const qEnd   = behavior.quietHoursEnd   ?? 7;
    const inQuiet = qStart < qEnd
        ? (nowHour >= qStart && nowHour < qEnd)
        : (nowHour >= qStart || nowHour < qEnd);
    if (inQuiet) return;

    // Cooldown check
    const cooldown  = FRIEND_MODE_COOLDOWN[behavior.frequency ?? 'medium'] ?? FRIEND_MODE_COOLDOWN.medium;
    const lastSent  = friendModeLastSentAt.get('friend_mode') ?? 0;
    if (Date.now() - lastSent < cooldown) return;

    // Check at least one channel is configured
    // 'dashboard' = show in Dashboard Chat when app is open (pushDashboardMessage queue)
    // 'browser'   = show as Desktop Buddy bubble when app is minimized (pushBuddyNotification)
    const wantsTelegram = behavior.channels?.telegram  !== false;
    const wantsBrowser  = behavior.channels?.browser   !== false;
    const wantsDashboard = behavior.channels?.dashboard === true;
    if (!wantsTelegram && !wantsBrowser && !wantsDashboard) return;

    // Verify Telegram is usable if needed
    let tgCfg: any = null;
    if (wantsTelegram) {
        try {
            const { loadTelegramConfig } = await import('@/actions/telegram');
            tgCfg = await loadTelegramConfig();
            if (!tgCfg?.enabled || !tgCfg?.botToken || !tgCfg?.pairedChatId) tgCfg = null;
        } catch { tgCfg = null; }
    }
    if (!tgCfg && !wantsBrowser) return;

    // Build short context from recent short-term memory
    let recentContext = '';
    try {
        const fs   = (await import('fs')).default;
        const path = (await import('path')).default;
        const { DATA_DIR } = await import('@/lib/paths');
        const stmDir = path.join(DATA_DIR, 'memory', 'short-term');
        if (fs.existsSync(stmDir)) {
            const files = fs.readdirSync(stmDir)
                .filter((f: string) => f.endsWith('.json'))
                .sort()
                .reverse()
                .slice(0, 5);
            const entries: string[] = [];
            for (const f of files) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(stmDir, f), 'utf8'));
                    if (data?.summary) entries.push(data.summary);
                } catch { /* skip */ }
            }
            recentContext = entries.length > 0
                ? `Recent topics: ${entries.join(' | ').slice(0, 300)}`
                : '';
        }
    } catch { /* non-fatal */ }

    // Use LLM to generate a context-aware single message (NOT via processMessageWithTools
    // to avoid session writes and tool-call noise)
    let checkInMsg = '';
    try {
        const { agentDecide } = await import('@/actions/orchestrator');
        const { buildContext } = await import('@/actions/identity');
        const identityCtx = await buildContext();

        const systemPrompt = [
            `You are Hands Free, a proactive AI companion sending a short check-in message to your user.`,
            identityCtx,
            ``,
            `RULES â€” READ CAREFULLY:`,
            `- Write EXACTLY ONE short message (1-3 sentences max).`,
            `- Be natural, warm, and varied â€” never send the same opener twice.`,
            `- DO NOT start with "How are you?" or "How was your day?" â€” these are boring.`,
            `- Instead: reference recent topics, share a quick insight, make a light joke, or suggest something useful.`,
            `- DO NOT include any instructions, system text, or meta-commentary.`,
            `- Output ONLY the message text â€” nothing else.`,
            recentContext ? `\n${recentContext}` : '',
        ].filter(Boolean).join('\n');

        // Pass systemPrompt as a system-role message so agentDecide() does NOT build its own
        // massive fullSystem (which adds 1200+ lines of tool instructions on top).
        // This keeps the provider request clean and avoids providers like Minimax echoing
        // the system prompt as the response text when noTools=true is set.
        const step = await agentDecide(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: 'Write the check-in message now.' },
            ],
            {
                provider: settings?.activeProvider,
                model:    settings?.providers?.[settings?.activeProvider]?.model,
                noTools:  true,
            } as any,
        );
        checkInMsg = (step.response ?? '').trim();
    } catch (e: any) {
        console.warn('[FriendMode] LLM call failed:', e?.message);
        return;
    }

    if (!checkInMsg) return;

    // Mark as sent BEFORE actually sending â€” prevents duplicate sends if send is slow
    friendModeLastSentAt.set('friend_mode', Date.now());

    // Send via Telegram
    if (tgCfg) {
        try {
            const { sendMessage } = await import('@/actions/telegram');
            await sendMessage(tgCfg.botToken, String(tgCfg.pairedChatId), checkInMsg);
            log.info('heartbeat_tick', `ðŸ¤ Friend Mode message sent via Telegram.`);
        } catch (e: any) {
            console.warn('[FriendMode] Telegram send failed:', e?.message);
        }
    }

    // Send via Desktop Buddy bubble (browser â€” visible when app is minimized to tray)
    if (wantsBrowser) {
        try {
            const { pushBuddyNotification } = await import('@/lib/buddy-notify');
            pushBuddyNotification(`ðŸ¤ ${checkInMsg}`);
        } catch { /* non-fatal */ }
    }

    // Send via Dashboard Chat (visible when app window is open)
    // Pushes to dashboard-queue.json which the Chat page polls every 5s
    if (wantsDashboard) {
        try {
            const { pushDashboardMessage } = await import('@/lib/dashboard-notify');
            pushDashboardMessage(`ðŸ¤ ${checkInMsg}`);
        } catch { /* non-fatal */ }
    }
}

// â”€â”€â”€ Core heartbeat tick â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function tick(): Promise<void> {
    if (!runnerEnabled)   return;
    if (isProcessingTask) return;

    let settings: any;
    try {
        const { loadSettings } = await import('@/actions/chat');
        settings = await loadSettings();
    } catch (err) {
        console.error('[AutonomousRunner] Could not load settings:', err);
        return;
    }

    if (!settings?.isAutonomousMode) return;

    // Sync cost-control settings from user prefs
    const autopilotConfig = (settings as any).autopilotConfig ?? {};
    MAX_CALLS_PER_HOUR  = autopilotConfig.maxCallsPerHour ?? 20;
    PAUSE_AFTER_TASKS   = autopilotConfig.pauseAfterTasks ?? 0;

    const safetyMode     = settings?.safetyMode        ?? 'safe';
    const baseTimeoutSec = settings?.taskTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;

    // â”€â”€ Cost Control Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
        if (!autopilotPausedForCost) {
            autopilotPausedForCost = true;
            saveCostState();
            log.warning('heartbeat_tick', `â¸ï¸ Autopilot paused: ${rateCheck.reason}`);
            console.warn(`[AutonomousRunner] â¸ï¸ Rate limit: ${rateCheck.reason}`);
        }
        return;
    }
    if (autopilotPausedForCost) {
        autopilotPausedForCost = false;
        saveCostState();
        log.info('heartbeat_tick', 'â–¶ï¸ Autopilot resumed (rate limit window reset).');
    }

    log.info('heartbeat_tick', `Heartbeat tick â€” scanning queue. API calls this hour: ${apiCallsThisHour}/${MAX_CALLS_PER_HOUR}.`);

    // â”€â”€ Recover stale tasks every tick (not just on startup) â”€â”€â”€â”€â”€
    // Guards against tasks stuck in 'in_progress' due to crashes, timeouts, or
    // unexpected errors that bypassed the finally block.
    try {
        const { recoverStaleTasks } = await import('@/lib/agent-tasks');
        const recovered = recoverStaleTasks();
        if (recovered > 0) {
            log.warning('heartbeat_tick', `â™» Recovered ${recovered} stale in_progress task(s).`);
        }
    } catch { /* non-fatal */ }

    // â”€â”€ Check & dispatch due cron jobs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Runs BEFORE the pending-task check so newly queued cron tasks
    // can be picked up in the same tick if the queue was empty.
    await tickCronJobs();

    // â”€â”€ Buddy Intelligence proactive check (rule-based, NO LLM calls) â”€â”€â”€â”€
    // Runs BEFORE Friend Mode â€” cheap context checks that decide if a
    // notification is warranted (meetings, tasks, email, idle, etc.)
    try {
        const { tickBuddyIntelligence } = await import('@/lib/buddy-intelligence');
        await tickBuddyIntelligence();
    } catch (e: any) {
        console.warn('[AutonomousRunner] Buddy Intelligence tick error:', e?.message);
    }

    // â”€â”€ Friend Mode proactive check-in (LLM-generated message) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Runs silently in the background â€” no session writes, no tool noise.
    await tickFriendMode(settings).catch(e =>
        console.warn('[AutonomousRunner] Friend Mode tick error:', e?.message)
    );

    // â”€â”€ Log approval-waiting tasks (don't execute, just report) â”€â”€
    const waiting = getTasksAwaitingApproval();
    if (waiting.length > 0) {
        log.warning('heartbeat_tick', `âš ï¸ ${waiting.length} task(s) awaiting user approval on the Execution Board.`);
    }

    const pending = getExecutablePendingTasks();
    if (pending.length === 0) {
        console.log('[AutonomousRunner] â™»  No executable pending tasks.');
        return;
    }

    const task = pending[0];

    // Safety gate: require explicit approval for system/scheduled tasks (instead of silently skipping)
    if (safetyMode === 'safe' && (task.source === 'system' || task.source === 'scheduled')) {
        if (!task.requiresApproval || task.approvalStatus === 'pending') {
            if (!task.requiresApproval) {
                updateTask(task.id, {
                    requiresApproval: true,
                    approvalReason:   `Safe Mode: ${task.source} tasks require approval before execution.`,
                    approvalStatus:   'pending',
                });
                log.info('heartbeat_tick', `ðŸ”’ Task "${task.title}" requires approval (Safe Mode + ${task.source} source)`, { taskId: task.id, taskTitle: task.title });
                await notifyTelegramApprovalRequired(task, `Safe Mode: ${task.source} tasks require approval before execution.`);
            }
            return; // Wait for approval â€” user can see and approve it on the Execution Board
        }
        // If already approved (approvalStatus === 'approved'), fall through to execution
    }

    // â”€â”€ Critical Action Detection (Safe + Advanced only) â”€â”€â”€â”€â”€â”€â”€
    // In 'unrestricted' mode autopilot runs 100% autonomously â€” no approval gates.
    if (safetyMode !== 'unrestricted') {
        const criticalReason = detectCriticalAction(task.title, task.description);
        if (criticalReason && !task.requiresApproval) {
            // Flag it and pause â€” don't execute
            updateTask(task.id, {
                requiresApproval: true,
                approvalReason:   criticalReason,
                approvalStatus:   'pending',
            });
            log.warning('heartbeat_tick', `ðŸ” Task requires approval: "${task.title}" â€” ${criticalReason}`, { taskId: task.id, taskTitle: task.title });
            console.warn(`[AutonomousRunner] ðŸ” Approval required: "${task.title}"`);
            await notifyTelegramApprovalRequired(task, criticalReason);
            return;
        }
    }

    const timeoutMs = (task.priority === 'high' ? 2 : 1) * (task.timeoutSeconds ?? baseTimeoutSec) * 1000;
    isProcessingTask = true;

    updateTask(task.id, {
        state:            'in_progress',
        startedAt:        Date.now(),
        assignedProvider: task.assignedProvider ?? settings?.activeProvider,
        assignedModel:    task.assignedModel    ?? settings?.providers?.[settings?.activeProvider]?.model,
    });

    try {
        const result = await executeTask(task, timeoutMs, settings);
        updateTask(task.id, { state: 'completed', completedAt: Date.now(), result });
        tasksCompletedThisSession++;

        log.success('task_completed', `âœ… "${task.title}" completed.`, {
            taskId: task.id, taskTitle: task.title,
            detail: { result: result.slice(0, 300), callsThisHour: apiCallsThisHour },
        });
        console.log(`[AutonomousRunner] âœ… "${task.title}" done.`);

        // Notify via unified notification router (respects quiet hours + cooldowns).
        // Falls back to direct pushBuddyNotification if router unavailable.
        try {
            const { routeNotification } = await import('@/lib/notification-router');
            const preview = result.length > 80 ? result.slice(0, 77) + 'â€¦' : result;
            await routeNotification({
                type: 'task-complete',
                message: `Done: "${task.title}"\n${preview}`,
                emoji: 'âœ…',
                priority: task.priority === 'high' ? 'high' : 'medium',
                cooldownMinutes: 1, // task completions have minimal cooldown
            });
        } catch {
            // Fallback: direct buddy push (old behavior)
            try {
                const { pushBuddyNotification } = await import('@/lib/buddy-notify');
                const preview = result.length > 80 ? result.slice(0, 77) + 'â€¦' : result;
                pushBuddyNotification(`âœ… Done: "${task.title}"\n${preview}`);
            } catch { /* non-fatal */ }
        }

        // For cron-sourced tasks: send a single clean Telegram notification.
        // This replaces the old approach of having the LLM call send_telegram_notification
        // mid-task (which could send multiple messages or leak the full prompt).
        if (task.description?.startsWith('[CRON]')) {
            try {
                const { loadTelegramConfig, sendMessage } = await import('@/actions/telegram');
                const tgCfg = await loadTelegramConfig();
                if (tgCfg?.enabled && tgCfg?.botToken && tgCfg?.pairedChatId) {
                    const shortResult = (result.split('\n\nâ”€â”€â”€ Tools used:')[0] ?? result).slice(0, 200);
                    await sendMessage(
                        tgCfg.botToken,
                        String(tgCfg.pairedChatId),
                        `âœ… *${task.title}* completed.\n${shortResult}`,
                    );
                }
            } catch { /* non-fatal â€” Telegram may not be configured */ }
        }

    } catch (err: any) {
        const errorMsg = err?.message ?? String(err);
        console.error(`[AutonomousRunner] âŒ "${task.title}" failed:`, errorMsg);

        const updated = incrementRetryAndRequeue(task.id, errorMsg);
        if (updated?.state === 'blocked') {
            log.error('task_blocked', `ðŸš« "${task.title}" BLOCKED (${updated.retryCount}/${updated.maxRetries} retries).`, {
                taskId: task.id, taskTitle: task.title, detail: { error: errorMsg },
            });
            // Notify via unified notification router â€” blocked tasks need user attention.
            try {
                const { routeNotification } = await import('@/lib/notification-router');
                const errPreview = errorMsg.length > 80 ? errorMsg.slice(0, 77) + 'â€¦' : errorMsg;
                await routeNotification({
                    type: 'task-blocked',
                    message: `Blocked: "${task.title}"\n${errPreview}`,
                    emoji: 'ðŸš«',
                    priority: 'high', // blocked = needs attention, bypass quiet hours
                    cooldownMinutes: 1,
                    action: { label: 'View Tasks', route: '/tasks' },
                });
            } catch {
                try {
                    const { pushBuddyNotification } = await import('@/lib/buddy-notify');
                    const errPreview = errorMsg.length > 80 ? errorMsg.slice(0, 77) + 'â€¦' : errorMsg;
                    pushBuddyNotification(`ðŸš« Blocked: "${task.title}"\n${errPreview}`);
                } catch { /* non-fatal */ }
            }
        } else {
            log.warning('task_retrying', `âš ï¸ "${task.title}" failed â€” retry ${updated?.retryCount ?? '?'}/${updated?.maxRetries ?? 3}.`, {
                taskId: task.id, taskTitle: task.title, detail: { error: errorMsg },
            });
        }
    } finally {
        isProcessingTask = false;
    }
}

// â”€â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function startAutonomousHeartbeat(): void {
    if (heartbeatTimer !== null) return;
    runnerEnabled             = true;
    tasksCompletedThisSession = 0;
    autopilotPausedForCost    = false;
    heartbeatTimer = setInterval(() => {
        tick().catch(err => console.error('[AutonomousRunner] Unhandled tick error:', err));
    }, HEARTBEAT_INTERVAL_MS);
    log.info('heartbeat_start', 'ðŸŸ¢ Autopilot heartbeat started (5-min interval).');
    console.log('[AutonomousRunner] ðŸŸ¢ Heartbeat started.');
    tick().catch(err => console.error('[AutonomousRunner] Unhandled initial tick error:', err));
}

export function stopAutonomousHeartbeat(): void {
    if (heartbeatTimer !== null) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    runnerEnabled = false;
    log.info('heartbeat_stop', 'ðŸ”´ Autopilot heartbeat stopped.');
    console.log('[AutonomousRunner] ðŸ”´ Heartbeat stopped.');
}

// â”€â”€â”€ Event-Driven Immediate Trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Called directly by the API route when a new task is added or approved â€”
// no need to wait up to 5 minutes for the next heartbeat tick.
// Guards: runner must be enabled, no task already in flight.
// Uses a counter instead of a boolean to avoid losing events when multiple
// tasks are added in quick succession (the old boolean flag would swallow
// any trigger that arrived while a previous setTimeout was still pending).
let immediateTickQueued = 0;
let immediateTickTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerImmediateTick(): void {
    if (!runnerEnabled) return;
    immediateTickQueued++;

    // If a timer is already pending, the new event will be picked up by the
    // existing tick â€” it reads from the full queue anyway.
    if (immediateTickTimer) return;

    immediateTickTimer = setTimeout(async () => {
        immediateTickTimer = null;
        immediateTickQueued = 0; // reset counter before tick
        if (isProcessingTask) return; // another tick is running
        tick().catch(err =>
            console.error('[AutonomousRunner] Unhandled immediate-tick error:', err),
        );
    }, 50);
    log.info('heartbeat_tick', 'âš¡ Immediate tick triggered by new task.');
    console.log('[AutonomousRunner] âš¡ Immediate tick triggered.');
}

export function resumeFromCostPause(): void {
    tasksCompletedThisSession = 0;
    apiCallsThisHour          = 0;
    hourWindowStartMs         = Date.now();
    autopilotPausedForCost    = false;
    saveCostState();
    log.info('heartbeat_start', 'â–¶ï¸ Autopilot cost-pause manually cleared by user.');
}

export function getAutonomousRunnerStatus(): {
    running: boolean; isProcessing: boolean; intervalMinutes: number;
    taskStats: ReturnType<typeof getTaskStats>;
    costControl: { apiCallsThisHour: number; maxCallsPerHour: number; tasksThisSession: number; paused: boolean };
} {
    return {
        running:         heartbeatTimer !== null,
        isProcessing:    isProcessingTask,
        intervalMinutes: HEARTBEAT_INTERVAL_MS / 60_000,
        taskStats:       getTaskStats(),
        costControl: {
            apiCallsThisHour, maxCallsPerHour: MAX_CALLS_PER_HOUR,
            tasksThisSession: tasksCompletedThisSession,
            paused: autopilotPausedForCost,
        },
    };
}

export async function initAutonomousRunner(): Promise<void> {
    try {
        const { loadSettings }      = await import('@/actions/chat');
        const { recoverStaleTasks } = await import('@/lib/agent-tasks');
        const recovered = recoverStaleTasks();
        if (recovered > 0) {
            log.warning('system', `â™» Recovered ${recovered} stale task(s) on startup.`);
            console.log(`[AutonomousRunner] â™»  Recovered ${recovered} stale task(s).`);
        }

        // Ensure a default daily standup cron job exists
        try {
            const { listCronJobs, createCronJob } = await import('@/actions/tasks');
            const cronJobs = await listCronJobs();
            const hasStandup = cronJobs.some((j: any) =>
                j.name?.includes('Daily Stand-up') || j.task?.includes('[STANDUP]'),
            );
            if (!hasStandup) {
                const settings = await loadSettings();
                const standupCron = (settings as any)?.autopilotConfig?.standupCron ?? '0 9 * * 1-5';
                await createCronJob({
                    name:     'Daily Stand-up Report',
                    schedule: standupCron,
                    task:     '[STANDUP] Generate and deliver daily stand-up report via Telegram',
                    enabled:  true,
                });
                log.info('system', `ðŸ“‹ Default daily stand-up cron created (${standupCron}).`);
                console.log(`[AutonomousRunner] ðŸ“‹ Default standup cron created.`);
            }
        } catch (cronErr) {
            console.warn('[AutonomousRunner] Could not check/create standup cron:', cronErr);
        }

        const settings = await loadSettings();
        if (settings?.isAutonomousMode) { startAutonomousHeartbeat(); }
        else { console.log('[AutonomousRunner] â„¹ï¸  Autonomous Mode is off.'); }
    } catch (err) {
        console.error('[AutonomousRunner] Failed to initialise:', err);
    }
}
