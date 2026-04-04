/**
 * Hands Free â€” Autopilot Logger
 *
 * Append-only log to DATA_DIR/autopilot_logs.json.
 * Every action the background runner takes is recorded here so the
 * Autopilot Dashboard can show a transparent "Live History" timeline.
 *
 * Design rules:
 *   - Pure synchronous fs â€” no async, no native modules
 *   - Capped at MAX_LOG_ENTRIES (rolling window keeps disk usage bounded)
 *   - Log entries are immutable once written
 */

import fs   from 'fs';
import path from 'path';
import { DATA_DIR } from '@/lib/paths';

const LOG_FILE        = path.join(DATA_DIR, 'autopilot_logs.json');
const MAX_LOG_ENTRIES = 500; // rolling cap

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type LogLevel  = 'info' | 'success' | 'warning' | 'error';
export type LogAction =
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'task_blocked'       // anti-loop: max retries exceeded
    | 'task_retrying'      // re-queued after failure (< max retries)
    | 'task_cancelled'
    | 'task_thinking'      // LLM reasoning step (Live Execution view)
    | 'task_tool_call'     // Tool invocation (Live Execution view)
    | 'task_tool_result'   // Tool return value (Live Execution view)
    | 'task_step'          // Generic intermediate step (Live Execution view)
    | 'heartbeat_tick'
    | 'heartbeat_start'
    | 'heartbeat_stop'
    | 'plan_created'       // new master plan pushed
    | 'interview_saved'    // user profile updated after deep-dive
    | 'standup_generated'  // daily stand-up report created
    | 'skill_used'         // specific skill invoked during task
    | 'system';

export interface AutopilotLogEntry {
    /** Auto-generated UUID */
    id: string;

    /** ISO-8601 timestamp */
    timestamp: string;

    /** Unix ms â€” for sorting/filtering */
    ts: number;

    /** Log severity */
    level: LogLevel;

    /** What happened */
    action: LogAction;

    /** Short description shown in timeline */
    message: string;

    /** Optional structured detail */
    detail?: Record<string, any>;

    /** Task ID this entry is associated with (if applicable) */
    taskId?: string;

    /** Task title for quick display without a join */
    taskTitle?: string;
}

// â”€â”€â”€ Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ensureDir(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readLogs(): AutopilotLogEntry[] {
    try {
        if (!fs.existsSync(LOG_FILE)) return [];
        return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')) as AutopilotLogEntry[];
    } catch {
        return [];
    }
}

function writeLogs(logs: AutopilotLogEntry[]): void {
    ensureDir();
    // Keep only the newest MAX_LOG_ENTRIES entries
    const capped = logs.slice(-MAX_LOG_ENTRIES);
    fs.writeFileSync(LOG_FILE, JSON.stringify(capped, null, 2));
}

// â”€â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let _logIdCounter = 0; // tiny monotonic suffix for uniqueness within same ms

/**
 * Append a single log entry.
 */
export function appendLog(entry: Omit<AutopilotLogEntry, 'id' | 'timestamp' | 'ts'>): AutopilotLogEntry {
    const ts    = Date.now();
    const id    = `${ts}-${++_logIdCounter}`;
    const full: AutopilotLogEntry = {
        id,
        timestamp: new Date(ts).toISOString(),
        ts,
        ...entry,
    };

    const logs = readLogs();
    logs.push(full);
    writeLogs(logs);
    return full;
}

/**
 * Return all log entries, newest-first.
 */
export function getLogs(options?: { limit?: number; taskId?: string; action?: LogAction }): AutopilotLogEntry[] {
    let logs = readLogs().sort((a, b) => b.ts - a.ts);
    if (options?.taskId)  logs = logs.filter(l => l.taskId === options.taskId);
    if (options?.action)  logs = logs.filter(l => l.action === options.action);
    if (options?.limit)   logs = logs.slice(0, options.limit);
    return logs;
}

/**
 * Clear all log entries. Used for "Clear History" in the UI.
 */
export function clearLogs(): void {
    writeLogs([]);
}

/**
 * Return a count of log entries by level.
 */
export function getLogStats(): Record<LogLevel, number> {
    const logs = readLogs();
    return logs.reduce(
        (acc, l) => { acc[l.level] = (acc[l.level] ?? 0) + 1; return acc; },
        { info: 0, success: 0, warning: 0, error: 0 } as Record<LogLevel, number>,
    );
}

// â”€â”€â”€ Convenience helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const log = {
    info: (action: LogAction, message: string, extra?: Partial<Pick<AutopilotLogEntry, 'taskId' | 'taskTitle' | 'detail'>>) =>
        appendLog({ level: 'info',    action, message, ...extra }),
    success: (action: LogAction, message: string, extra?: Partial<Pick<AutopilotLogEntry, 'taskId' | 'taskTitle' | 'detail'>>) =>
        appendLog({ level: 'success', action, message, ...extra }),
    warning: (action: LogAction, message: string, extra?: Partial<Pick<AutopilotLogEntry, 'taskId' | 'taskTitle' | 'detail'>>) =>
        appendLog({ level: 'warning', action, message, ...extra }),
    error: (action: LogAction, message: string, extra?: Partial<Pick<AutopilotLogEntry, 'taskId' | 'taskTitle' | 'detail'>>) =>
        appendLog({ level: 'error',   action, message, ...extra }),
};
