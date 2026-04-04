'use server';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadSettings } from './chat';

import { DATA_DIR } from '@/lib/paths';
const TASKS_DIR = path.join(DATA_DIR, 'tasks');
const CRON_DIR = path.join(DATA_DIR, 'cron');

function ensureDirs() {
    [TASKS_DIR, CRON_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
}

// Task Interface
export interface Task {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
    priority: 'low' | 'medium' | 'high';
    agent?: string;  // Which agent should handle this
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    result?: any;
    error?: string;
    logs: Array<{ timestamp: number; message: string; level: 'info' | 'warn' | 'error' }>;
    // Multi-Agent fields
    isMultiAgent?: boolean;       // True if this task is part of a multi-agent job
    parentId?: string;            // Sub-task: ID of the parent orchestrator task
    subtaskIds?: string[];        // Parent: IDs of spawned sub-tasks
    subtaskIndex?: number;        // Position in batch (1-based)
    subtaskTotal?: number;        // Total sub-tasks in batch
}

// Sub-task data for dispatch
export interface SubTaskData {
    title: string;
    description: string;
    priority?: 'low' | 'medium' | 'high';
    agent?: string;
}

// Cron Job Interface
export interface CronJob {
    id: string;
    name: string;
    schedule: string;  // Cron expression
    task: string;      // Task description
    agent?: string;
    enabled: boolean;
    lastRun?: number;
    nextRun?: number;
    createdAt: number;
}

// Create Task
export async function createTask(data: Omit<Task, 'id' | 'status' | 'createdAt' | 'logs'>): Promise<Task> {
    ensureDirs();

    const task: Task = {
        id: `task-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        status: 'pending',
        createdAt: Date.now(),
        logs: [],
        ...data
    };

    const filePath = path.join(TASKS_DIR, `${task.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(task, null, 2));

    return task;
}

// List Tasks
export async function listTasks(limit: number = 50): Promise<Task[]> {
    ensureDirs();

    try {
        const files = fs.readdirSync(TASKS_DIR)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse()
            .slice(0, limit);

        return files.map(f => JSON.parse(fs.readFileSync(path.join(TASKS_DIR, f), 'utf-8')));
    } catch {
        return [];
    }
}

// Get Task
export async function getTask(id: string): Promise<Task | null> {
    ensureDirs();
    const filePath = path.join(TASKS_DIR, `${id}.json`);

    if (!fs.existsSync(filePath)) return null;

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Update Task
export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    const task = await getTask(id);
    if (!task) return null;

    const updated = { ...task, ...updates };
    const filePath = path.join(TASKS_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));

    return updated;
}

// Delete Task
export async function deleteTask(id: string) {
    const filePath = path.join(TASKS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
    }
    return { success: false };
}

// Execute Task â€” full multi-step agent loop (up to MAX_TASK_LOOPS rounds)
// This mirrors the chat page's agent loop so tasks can do as many tool calls as needed.
export async function executeTask(id: string): Promise<{ success: boolean; error?: string; result?: any }> {
    const task = await getTask(id);
    if (!task) return { success: false, error: 'Task not found' };

    // If already stopped before we even begin, bail early
    if (task.status === 'stopped') return { success: false, error: 'Task was stopped' };

    // Accumulate logs in memory to avoid repeated file reads inside the loop
    const logEntries: Array<{ timestamp: number; message: string; level: 'info' | 'warn' | 'error' }> = [
        ...task.logs,
        { timestamp: Date.now(), message: 'Task execution started', level: 'info' }
    ];

    await updateTask(id, {
        status: 'running',
        startedAt: Date.now(),
        logs: logEntries,
    });

    try {
        // Dynamic import to break circular dependency (tasks â†’ orchestrator â†’ tasks)
        const { agentDecide, agentExecute } = await import('./orchestrator');

        // â”€â”€ Priority-based timeout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Load user settings to respect their configured task timeout.
        // High-priority tasks automatically get 2Ã— the configured limit.
        const settings = await loadSettings();
        const baseTimeoutSec = settings.taskTimeoutSeconds ?? 300; // default 5 min
        const taskTimeoutSec = task.priority === 'high' ? baseTimeoutSec * 2 : baseTimeoutSec;
        const taskTimeoutMs = taskTimeoutSec * 1000;
        // Per-call timeout: each individual LLM API call gets at most taskTimeoutMs / 3
        // (capped at 180s so it's never unreasonably long for short tasks).
        const callTimeoutMs = Math.min(Math.round(taskTimeoutMs / 3), 180_000);

        // Task-level AbortController â€” fires when the overall task time runs out.
        const taskController = new AbortController();
        const taskDeadlineTimer = setTimeout(() => {
            taskController.abort(new Error(`Task exceeded time limit (${taskTimeoutSec}s)`));
        }, taskTimeoutMs);

        // â”€â”€ 80% Checkpoint Timer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // At 80% of the timeout budget, save a mid-run checkpoint so progress
        // isn't lost if the task is about to be aborted.
        let earlyCheckpointSaved = false;
        const checkpointThreshold = Math.round(taskTimeoutMs * 0.8);
        const checkpointTimer = setTimeout(() => {
            earlyCheckpointSaved = true;
            // This runs in the background â€” checkpoint will be written in the loop below
            logEntries.push({ timestamp: Date.now(), message: 'âš ï¸ Approaching time limit â€” progress checkpoint requested', level: 'warn' });
        }, checkpointThreshold);

        const MAX_TASK_LOOPS = 15;
        let loopCount = 0;
        let lastResponse = '';

        // Build the initial message history for the agent
        const messages: Array<{
            role: string;
            content: any;
            tool_calls?: any[];
            tool_call_id?: string;
            name?: string;
        }> = [
            {
                role: 'user',
                content:
                    `Execute the following task completely from start to finish.\n` +
                    `Do not stop after one step â€” keep using tools until the task is fully done.\n\n` +
                    `**Task title:** ${task.title}\n` +
                    `**Description:** ${task.description}\n` +
                    `**Priority:** ${task.priority}\n\n` +
                    `When finished, confirm what was created/done.`,
            },
        ];

        // Helper: save a mid-run progress checkpoint to workspace
        const saveProgressCheckpoint = (stepCount: number, reason: string) => {
            try {
                const checkpointDir = path.join(DATA_DIR, 'workspace', 'task-checkpoints');
                if (!fs.existsSync(checkpointDir)) fs.mkdirSync(checkpointDir, { recursive: true });
                const allToolCallsSoFar = messages
                    .filter(m => m.role === 'assistant' && m.tool_calls?.length)
                    .flatMap(m => m.tool_calls!.map((tc: any) => tc.function?.name || 'unknown'));
                const checkpoint = {
                    taskId: id,
                    taskTitle: task.title,
                    taskDescription: task.description,
                    stepsCompleted: stepCount,
                    toolsUsed: allToolCallsSoFar,
                    savedAt: new Date().toISOString(),
                    reason,
                    lastMessages: messages.slice(-6),
                    resumeHint: `Ask Hands Free: "Continue task: ${task.title}" â€” Hands Free will read this checkpoint and pick up from step ${stepCount}.`,
                };
                fs.writeFileSync(path.join(checkpointDir, `${id}.json`), JSON.stringify(checkpoint, null, 2));
                logEntries.push({ timestamp: Date.now(), message: `ðŸ“Œ Progress checkpoint saved (step ${stepCount}): task-checkpoints/${id}.json`, level: 'info' });
            } catch {
                logEntries.push({ timestamp: Date.now(), message: 'Could not save progress checkpoint', level: 'warn' });
            }
        };

        // â”€â”€ Agent Loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        while (loopCount < MAX_TASK_LOOPS) {
            loopCount++;

            // Poll for stop signal (user clicked Stop in UI)
            const current = await getTask(id);
            if (!current || current.status === 'stopped') {
                logEntries.push({ timestamp: Date.now(), message: 'Task stopped by user', level: 'warn' });
                clearTimeout(taskDeadlineTimer);
                clearTimeout(checkpointTimer);
                await updateTask(id, { logs: logEntries });
                return { success: false, error: 'Task stopped by user' };
            }

            // Check task-level deadline signal
            if (taskController.signal.aborted) {
                saveProgressCheckpoint(loopCount - 1, `Task timeout (${taskTimeoutSec}s limit reached)`);
                lastResponse = `â±ï¸ Task reached the time limit (${taskTimeoutSec}s). âœ… Progress checkpoint saved to Workspace at \`task-checkpoints/${id}.json\`. To resume, ask Hands Free: "Continue task: ${task.title}".`;
                break;
            }

            // If 80% checkpoint was requested (timer fired), save it now
            if (earlyCheckpointSaved && loopCount > 1) {
                earlyCheckpointSaved = false; // only save once
                saveProgressCheckpoint(loopCount - 1, '80% of time limit reached â€” early checkpoint');
            }

            logEntries.push({ timestamp: Date.now(), message: `Step ${loopCount}: thinkingâ€¦`, level: 'info' });

            // 1. DECIDE â€” pass task-level signal and per-call timeout
            const decision = await agentDecide(messages as any, {
                signal: taskController.signal,
                callTimeoutMs,
            });

            if (decision.decision === 'error') {
                // Check if error was caused by our abort signal (time limit)
                if (taskController.signal.aborted) {
                    saveProgressCheckpoint(loopCount, `Task timeout (${taskTimeoutSec}s limit reached)`);
                    lastResponse = `â±ï¸ Task reached the time limit (${taskTimeoutSec}s). âœ… Progress checkpoint saved. To resume, ask Hands Free: "Continue task: ${task.title}".`;
                    break;
                }
                throw new Error(decision.error || 'Agent decision error');
            }

            if (decision.decision === 'response') {
                // Agent has written its final reply â€” we're done
                lastResponse = decision.response || '';
                logEntries.push({ timestamp: Date.now(), message: `Done in ${loopCount} step(s)`, level: 'info' });
                break;
            }

            if (decision.decision === 'tool' && decision.toolCalls?.length) {
                const toolNames = decision.toolCalls.map(t => t.function.name).join(', ');
                logEntries.push({ timestamp: Date.now(), message: `Step ${loopCount}: calling [${toolNames}]`, level: 'info' });

                // 2. EXECUTE TOOLS
                const results = await agentExecute(decision.toolCalls);

                results.forEach(r => {
                    logEntries.push({
                        timestamp: Date.now(),
                        message: `  ${r.toolName}: ${r.success ? 'âœ“' : 'âœ— ' + (r.displayMessage || 'failed')}`,
                        level: r.success ? 'info' : 'warn',
                    });
                });

                // 3. APPEND to message history so next loop has full context
                messages.push({
                    role: 'assistant',
                    content: decision.response || '',
                    tool_calls: decision.toolCalls,
                });

                decision.toolCalls.forEach((tc, i) => {
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        name: tc.function.name,
                        content: JSON.stringify(results[i]?.result ?? { error: 'No result' }),
                    });
                });

                // Write incremental log so Tasks page shows live progress
                await updateTask(id, { logs: [...logEntries] });
            }
        }

        // Always clear timers once the loop exits (success, stop, or step limit)
        clearTimeout(taskDeadlineTimer);
        clearTimeout(checkpointTimer);

        if (loopCount >= MAX_TASK_LOOPS && !lastResponse) {
            logEntries.push({ timestamp: Date.now(), message: `Hit step limit (${MAX_TASK_LOOPS})`, level: 'warn' });
            saveProgressCheckpoint(loopCount, `Step limit (${MAX_TASK_LOOPS}) reached`);
            const allToolCallNames = messages
                .filter(m => m.role === 'assistant' && m.tool_calls?.length)
                .flatMap(m => m.tool_calls!.map((tc: any) => tc.function?.name || 'unknown'));
            lastResponse = `Reached the step limit (${MAX_TASK_LOOPS} steps) â€” ${loopCount} steps completed. âœ… Progress checkpoint saved to Workspace at \`task-checkpoints/${id}.json\`. Tools used: ${allToolCallNames.join(', ') || 'none'}. To resume, ask Hands Free: "Continue task: ${task.title}".`;
        }

        // Build a clean list of all tool calls for the result summary
        const allToolCalls = messages
            .filter(m => m.role === 'assistant' && m.tool_calls?.length)
            .flatMap(m => m.tool_calls!.map(tc => tc.function.name));

        await updateTask(id, {
            status: 'completed',
            completedAt: Date.now(),
            result: { response: lastResponse, toolCalls: allToolCalls, steps: loopCount },
            logs: logEntries,
        });

        return { success: true, result: lastResponse };

    } catch (e: any) {
        logEntries.push({ timestamp: Date.now(), message: `Error: ${e.message}`, level: 'error' });
        await updateTask(id, {
            status: 'failed',
            completedAt: Date.now(),
            error: e.message,
            logs: logEntries,
        });
        return { success: false, error: e.message };
    }
}

// Create Cron Job
export async function createCronJob(data: Omit<CronJob, 'id' | 'createdAt'>): Promise<CronJob> {
    ensureDirs();

    const job: CronJob = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        ...data
    };

    const filePath = path.join(CRON_DIR, `${job.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(job, null, 2));

    return job;
}

// List Cron Jobs
export async function listCronJobs(): Promise<CronJob[]> {
    ensureDirs();

    try {
        const files = fs.readdirSync(CRON_DIR)
            .filter(f => f.endsWith('.json'));

        return files.map(f => JSON.parse(fs.readFileSync(path.join(CRON_DIR, f), 'utf-8')));
    } catch {
        return [];
    }
}

// Delete Cron Job
export async function deleteCronJob(id: string) {
    const filePath = path.join(CRON_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
    }
    return { success: false };
}

// Stop a running task
export async function stopTask(id: string): Promise<{ success: boolean }> {
    const task = await getTask(id);
    if (!task) return { success: false };
    await updateTask(id, {
        status: 'stopped',
        completedAt: Date.now(),
        logs: [...task.logs, { timestamp: Date.now(), message: 'Task stopped by user', level: 'warn' }]
    });
    return { success: true };
}

// Dispatch a Multi-Agent Job: create parent task + all sub-tasks + execute them in parallel
export async function dispatchMultiAgent(
    subtasks: SubTaskData[],
    parentTitle?: string
): Promise<{ parentTask: Task; subtasks: Task[] }> {
    ensureDirs();

    // 1. Create parent orchestrator task
    const parentTask = await createTask({
        title: parentTitle || `Multi-Agent Job (${subtasks.length} tasks)`,
        description: `Orchestrating ${subtasks.length} parallel sub-tasks`,
        priority: 'high',
        isMultiAgent: true,
    });

    // 2. Create all sub-tasks
    const createdSubtasks: Task[] = [];
    for (let i = 0; i < subtasks.length; i++) {
        const sub = await createTask({
            title: subtasks[i].title,
            description: subtasks[i].description,
            priority: subtasks[i].priority || 'medium',
            agent: subtasks[i].agent,
            isMultiAgent: true,
            parentId: parentTask.id,
            subtaskIndex: i + 1,
            subtaskTotal: subtasks.length,
        });
        createdSubtasks.push(sub);
    }

    // 3. Update parent with sub-task IDs and mark as running
    await updateTask(parentTask.id, {
        subtaskIds: createdSubtasks.map(t => t.id),
        status: 'running',
        startedAt: Date.now(),
        logs: [{ timestamp: Date.now(), message: `Dispatched ${subtasks.length} sub-tasks`, level: 'info' }]
    });

    // 4. Execute sub-tasks with a concurrency limit so we don't flood the LLM API.
    //    Running all N tasks at once causes rate-limit collisions â€” agents create folders
    //    but then timeout before writing content. Max 2 simultaneous, staggered by 3s.
    const CONCURRENCY = 2;
    const STAGGER_MS = 3000; // 3s between each task start

    const execAll = async () => {
        const queue = [...createdSubtasks];
        let running = 0;
        let startIndex = 0;

        await new Promise<void>((resolve) => {
            const tryNext = () => {
                // Launch up to CONCURRENCY tasks, staggered
                while (running < CONCURRENCY && startIndex < queue.length) {
                    const sub = queue[startIndex];
                    const delay = startIndex * STAGGER_MS;
                    startIndex++;
                    running++;

                    const run = async () => {
                        // Stagger start time to avoid simultaneous LLM calls
                        if (delay > 0) await new Promise(r => setTimeout(r, delay));
                        try {
                            await executeTask(sub.id);
                        } catch (e) {
                            console.error(`[MultiAgent] Sub-task ${sub.id} failed:`, e);
                        } finally {
                            running--;
                            if (startIndex < queue.length) {
                                tryNext();
                            } else if (running === 0) {
                                resolve();
                            }
                        }
                    };
                    run();
                }
                // All enqueued, nothing more to start
                if (running === 0 && startIndex >= queue.length) resolve();
            };
            tryNext();
        });

        // Update parent status when all sub-tasks have finished
        const allResults = await Promise.all(createdSubtasks.map(t => getTask(t.id)));
        const allSuccess = allResults.every(t => t?.status === 'completed');
        await updateTask(parentTask.id, {
            status: allSuccess ? 'completed' : 'failed',
            completedAt: Date.now(),
            logs: [{ timestamp: Date.now(), message: `All ${subtasks.length} sub-tasks finished`, level: 'info' }]
        });
    };

    // Kick off without blocking the caller
    execAll().catch(console.error);

    return { parentTask, subtasks: createdSubtasks };
}

// Toggle Cron Job
export async function toggleCronJob(id: string, enabled: boolean) {
    const filePath = path.join(CRON_DIR, `${id}.json`);
    if (!fs.existsSync(filePath)) return { success: false };

    const job = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    job.enabled = enabled;
    fs.writeFileSync(filePath, JSON.stringify(job, null, 2));

    return { success: true };
}
