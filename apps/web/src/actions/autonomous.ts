'use server';

/**
 * Hands Free â€” Autonomous Mode Server Actions
 *
 * Used by the Settings UI and any other React component that needs to
 * read or manage the agent task queue.
 */

import {
    createTask,
    updateTask,
    getTask,
    getAllTasks,
    getPendingTasks,
    deleteTask,
    clearFinishedTasks,
    AgentTask,
    TaskPriority,
} from '@/lib/agent-tasks';

import {
    getAutonomousRunnerStatus,
    startAutonomousHeartbeat,
    stopAutonomousHeartbeat,
} from '@/lib/autonomous-runner';

// â”€â”€â”€ Task Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Add a new task to the queue. Returns the created task.
 */
export async function addAutonomousTask(input: {
    title: string;
    description: string;
    priority?: TaskPriority;
    timeoutSeconds?: number;
}): Promise<{ success: boolean; task?: AgentTask; error?: string }> {
    try {
        const task = createTask({
            title:          input.title,
            description:    input.description,
            priority:       input.priority ?? 'normal',
            source:         'user',
            timeoutSeconds: input.timeoutSeconds,
        });
        return { success: true, task };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Return all tasks sorted newest-first.
 */
export async function getAutonomousTasks(): Promise<AgentTask[]> {
    return getAllTasks();
}

/**
 * Delete a single task by ID.
 */
export async function removeAutonomousTask(id: string): Promise<{ success: boolean }> {
    return { success: deleteTask(id) };
}

/**
 * Remove all completed and failed tasks. Returns the number removed.
 */
export async function clearCompletedAutonomousTasks(): Promise<{ removed: number }> {
    return { removed: clearFinishedTasks() };
}

// â”€â”€â”€ Runner Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns the current in-process runner state (running/idle/processing)
 * plus a breakdown of task queue counts.
 */
export async function getAutonomousStatus(): Promise<{
    running:         boolean;
    isProcessing:    boolean;
    intervalMinutes: number;
    tasks: {
        pending:     number;
        in_progress: number;
        completed:   number;
        failed:      number;
        total:       number;
    };
}> {
    const status = getAutonomousRunnerStatus();
    const tasks  = getAllTasks();

    return {
        ...status,
        tasks: {
            pending:     tasks.filter(t => t.state === 'pending').length,
            in_progress: tasks.filter(t => t.state === 'in_progress').length,
            completed:   tasks.filter(t => t.state === 'completed').length,
            failed:      tasks.filter(t => t.state === 'failed').length,
            total:       tasks.length,
        },
    };
}

/**
 * Toggle Autonomous Mode on or off.
 * Immediately starts or stops the background heartbeat and persists the
 * new value through saveAllSettings so it survives server restarts.
 */
export async function setAutonomousMode(enabled: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        // Persist the setting
        const { loadSettings, saveAllSettings } = await import('@/actions/chat');
        const settings = await loadSettings();
        await saveAllSettings({ ...settings, isAutonomousMode: enabled });

        // Start/stop the in-process heartbeat immediately
        if (enabled) {
            startAutonomousHeartbeat();
        } else {
            stopAutonomousHeartbeat();
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
