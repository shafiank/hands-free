/**
 * Hands Free â€” Agent Task State Machine
 *
 * Pure Node.js / pure-JSON implementation.
 * All tasks are persisted to ~/.handsfree-data/tasks.json.
 *
 * Architecture rule: NO native C++ modules (no sqlite3 / better-sqlite3).
 * All I/O is synchronous fs calls to keep the code simple and avoid the
 * callback/Promise complexity that would be needed for async JSON persistence.
 *
 * Phase 5 additions:
 *   - TaskState now includes 'blocked' (anti-loop: max 3 retries)
 *   - AgentTask now includes retryCount, maxRetries, blockedReason, assignedProvider, assignedModel
 *   - getPendingTasks filters out permanently blocked tasks
 *   - incrementRetry() helper â€” sets 'blocked' at max_retries
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { DATA_DIR } from '@/lib/paths';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type TaskState    = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high';
export type TaskSource   = 'user' | 'system' | 'scheduled' | 'autopilot';

export interface AgentTask {
    /** Unique identifier (UUID v4) */
    id: string;

    /** Short human-readable title shown in the UI */
    title: string;

    /** Full task description / instructions for the agent */
    description: string;

    /** Current lifecycle state */
    state: TaskState;

    /** Execution priority â€” high-priority tasks get 2Ã— the global timeout */
    priority: TaskPriority;

    /** Who created this task */
    source: TaskSource;

    /** Unix timestamp (ms) â€” task was created */
    createdAt: number;

    /** Unix timestamp (ms) â€” last state change */
    updatedAt: number;

    /** Unix timestamp (ms) â€” execution started */
    startedAt?: number;

    /** Unix timestamp (ms) â€” execution finished (success or failure) */
    completedAt?: number;

    /** Agent output / success message */
    result?: string;

    /** Error message when state === 'failed' or 'blocked' */
    error?: string;

    /**
     * Per-task timeout override (seconds).
     * Falls back to settings.taskTimeoutSeconds if not set.
     * High-priority tasks automatically get 2Ã— this value.
     */
    timeoutSeconds?: number;

    // â”€â”€ Phase 5: Anti-Loop Protocol â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Number of times this task has been attempted and failed.
     * When retryCount >= maxRetries, state is set to 'blocked'.
     */
    retryCount?: number;

    /**
     * Maximum number of retry attempts before permanently blocking.
     * Defaults to 3 (global anti-loop safeguard).
     */
    maxRetries?: number;

    /**
     * Human-readable explanation of why the task was blocked.
     * Set when state transitions to 'blocked'.
     */
    blockedReason?: string;

    /**
     * Which LLM provider is currently assigned to this task.
     * Set by the Autopilot planner when creating tasks.
     */
    assignedProvider?: string;

    /**
     * Which LLM model is currently assigned to this task.
     */
    assignedModel?: string;

    /**
     * Tags for grouping tasks into a logical master plan.
     * e.g. ['content-strategy', 'week-1']
     */
    tags?: string[];

    /**
     * If this task belongs to a master plan, this is the plan's goal title.
     */
    planTitle?: string;

    // â”€â”€ Phase 5.7: Human-in-the-Loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * If true, this task requires explicit user approval before execution.
     * Set automatically by the runner when the task involves:
     *   - Sending mass communications
     *   - Deleting files permanently
     *   - Spending money / financial transactions
     *   - Any action the user has flagged as critical
     *
     * The runner will pause this task and wait for approvalStatus = 'approved'.
     */
    requiresApproval?: boolean;

    /**
     * Human-readable explanation of WHY approval is required.
     */
    approvalReason?: string;

    /**
     * Approval decision made by the user in the Execution Board UI.
     * 'pending' = waiting for user action
     * 'approved' = user clicked Approve â†’ runner will execute
     * 'rejected' = user clicked Reject â†’ runner will cancel
     */
    approvalStatus?: 'pending' | 'approved' | 'rejected';

    // â”€â”€ Phase 5.7: OODA Re-Planning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Context or reason stored when the Autopilot re-plans and
     * modifies this task (changes description, priority, or deletes it).
     */
    replanReason?: string;

    /**
     * ISO timestamp of the last re-plan that modified this task.
     */
    replannedAt?: string;
}

// â”€â”€â”€ Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

function ensureDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readTasks(): AgentTask[] {
    try {
        if (!fs.existsSync(TASKS_FILE)) return [];
        return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8')) as AgentTask[];
    } catch {
        return [];
    }
}

function writeTasks(tasks: AgentTask[]): void {
    ensureDir();
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

// â”€â”€â”€ CRUD operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Add a new task to the queue with state = 'pending'.
 * Returns the created task.
 */
export function createTask(input: {
    title: string;
    description: string;
    priority?: TaskPriority;
    source?: TaskSource;
    timeoutSeconds?: number;
    maxRetries?: number;
    assignedProvider?: string;
    assignedModel?: string;
    tags?: string[];
    planTitle?: string;
}): AgentTask {
    const task: AgentTask = {
        id:               crypto.randomUUID(),
        title:            input.title.trim().slice(0, 200),
        description:      input.description.trim(),
        state:            'pending',
        priority:         input.priority   ?? 'normal',
        source:           input.source     ?? 'user',
        createdAt:        Date.now(),
        updatedAt:        Date.now(),
        timeoutSeconds:   input.timeoutSeconds,
        retryCount:       0,
        maxRetries:       input.maxRetries     ?? 3,
        assignedProvider: input.assignedProvider,
        assignedModel:    input.assignedModel,
        tags:             input.tags,
        planTitle:        input.planTitle,
    };

    const tasks = readTasks();
    tasks.push(task);
    writeTasks(tasks);
    return task;
}

/**
 * Update fields on an existing task.
 * Always stamps `updatedAt` to the current time.
 * Returns the updated task, or null if not found.
 */
export function updateTask(
    id: string,
    updates: Partial<Omit<AgentTask, 'id' | 'createdAt'>>,
): AgentTask | null {
    const tasks = readTasks();
    const idx   = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;

    tasks[idx] = { ...tasks[idx], ...updates, updatedAt: Date.now() };
    writeTasks(tasks);
    return tasks[idx];
}

/** Return a single task by ID, or null if not found. */
export function getTask(id: string): AgentTask | null {
    return readTasks().find(t => t.id === id) ?? null;
}

/** Return all tasks, sorted newest-first. */
export function getAllTasks(): AgentTask[] {
    return readTasks().sort((a, b) => b.createdAt - a.createdAt);
}

/** Return only tasks in state 'pending', sorted by priority (high â†’ normal â†’ low). */
export function getPendingTasks(): AgentTask[] {
    const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
    return readTasks()
        .filter(t => t.state === 'pending')
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

/** Permanently remove a task by ID. Returns true if found and deleted. */
export function deleteTask(id: string): boolean {
    const tasks    = readTasks();
    const filtered = tasks.filter(t => t.id !== id);
    if (filtered.length === tasks.length) return false;
    writeTasks(filtered);
    return true;
}

/**
 * Remove all completed, failed, cancelled, and blocked tasks.
 * Returns the number of tasks removed.
 */
export function clearFinishedTasks(): number {
    const tasks  = readTasks();
    const active = tasks.filter(t => t.state === 'pending' || t.state === 'in_progress');
    const removed = tasks.length - active.length;
    if (removed > 0) writeTasks(active);
    return removed;
}

/**
 * Reset any stale 'in_progress' tasks back to 'pending'.
 * Called on server startup to recover from unexpected crashes.
 */
export function recoverStaleTasks(): number {
    const tasks = readTasks();
    let recovered = 0;
    for (const t of tasks) {
        if (t.state === 'in_progress') {
            t.state     = 'pending';
            t.updatedAt = Date.now();
            t.startedAt = undefined;
            recovered++;
        }
    }
    if (recovered > 0) writeTasks(tasks);
    return recovered;
}

/**
 * Anti-Loop Protocol: increment the retry counter for a failed task.
 *
 * - If retryCount < maxRetries: resets state to 'pending' for the next attempt.
 * - If retryCount >= maxRetries: permanently sets state to 'blocked'.
 *
 * Returns the updated task.
 */
export function incrementRetryAndRequeue(
    id: string,
    errorMsg: string,
): AgentTask | null {
    const tasks = readTasks();
    const idx   = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;

    const task       = tasks[idx];
    const retryCount = (task.retryCount ?? 0) + 1;
    const maxRetries = task.maxRetries ?? 3;

    if (retryCount >= maxRetries) {
        // Permanently blocked â€” agent MUST NOT retry
        tasks[idx] = {
            ...task,
            state:         'blocked',
            retryCount,
            blockedReason: `Failed ${retryCount}/${maxRetries} times. Last error: ${errorMsg}`,
            error:         errorMsg,
            completedAt:   Date.now(),
            updatedAt:     Date.now(),
        };
    } else {
        // Re-queue for retry
        tasks[idx] = {
            ...task,
            state:      'pending',
            retryCount,
            error:      errorMsg,
            startedAt:  undefined,
            updatedAt:  Date.now(),
        };
    }

    writeTasks(tasks);
    return tasks[idx];
}

/**
 * Cancel a task (user-initiated). Sets state to 'cancelled'.
 */
export function cancelTask(id: string, reason?: string): AgentTask | null {
    return updateTask(id, {
        state:        'cancelled',
        completedAt:  Date.now(),
        blockedReason: reason ?? 'Cancelled by user',
    });
}

/**
 * Get task counts grouped by state.
 */
export function getTaskStats(): Record<TaskState | 'total' | 'awaiting_approval', number> {
    const tasks = readTasks();
    const counts: Record<string, number> = {
        total: tasks.length, pending: 0, in_progress: 0,
        completed: 0, failed: 0, blocked: 0, cancelled: 0,
        awaiting_approval: 0,
    };
    for (const t of tasks) {
        counts[t.state] = (counts[t.state] ?? 0) + 1;
        if (t.requiresApproval && t.approvalStatus === 'pending' && t.state === 'pending') {
            counts.awaiting_approval++;
        }
    }
    return counts as Record<TaskState | 'total' | 'awaiting_approval', number>;
}

/**
 * Approve a task that was flagged as requiresApproval.
 * Sets approvalStatus â†’ 'approved' so the runner picks it up on next tick.
 */
export function approveTask(id: string): AgentTask | null {
    return updateTask(id, { approvalStatus: 'approved' });
}

/**
 * Reject a task that was flagged as requiresApproval.
 * Cancels the task with a rejection reason.
 */
export function rejectTask(id: string, reason?: string): AgentTask | null {
    return updateTask(id, {
        state:          'cancelled',
        completedAt:    Date.now(),
        approvalStatus: 'rejected',
        blockedReason:  reason ?? 'Rejected by user',
    });
}

/**
 * Return all tasks that are pending approval (requiresApproval + approvalStatus='pending').
 */
export function getTasksAwaitingApproval(): AgentTask[] {
    return readTasks().filter(
        t => t.requiresApproval && t.approvalStatus === 'pending' && t.state === 'pending',
    );
}

/**
 * Update getPendingTasks to skip tasks awaiting approval
 * (already done â€” pending tasks with requiresApproval + approvalStatus='pending' are skipped by the runner).
 */
export function getExecutablePendingTasks(): AgentTask[] {
    const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };
    return readTasks()
        .filter(t =>
            t.state === 'pending' &&
            !(t.requiresApproval && t.approvalStatus === 'pending'),
        )
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
