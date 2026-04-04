/**
 * /api/autopilot — Autopilot Hub REST endpoint
 *
 * GET  ?resource=tasks|logs|profile|status|stats
 *      &limit=N  &taskId=X  (for logs)
 *
 * POST { action: string, ...payload }
 *   actions:
 *     "add_task"        — add a new task
 *     "edit_task"       — update task fields
 *     "cancel_task"     — cancel a task
 *     "delete_task"     — permanently remove a task
 *     "save_profile"    — update user_profile.json
 *     "clear_logs"      — wipe autopilot_logs.json
 *     "toggle_runner"   — start/stop the heartbeat
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import {
    loadUserProfile, saveUserProfile,
    getAutopilotLogs, clearAutopilotLogs,
    getAutopilotTasks,
    addAutopilotTask, editAutopilotTask,
    cancelAutopilotTask, deleteAutopilotTask,
    approveAutopilotTask, rejectAutopilotTask,
    saveAutopilotConfig, resumeFromCostPause,
    retryBlockedTask,
} from '@/actions/autopilot';
import { getAutonomousRunnerStatus, startAutonomousHeartbeat, stopAutonomousHeartbeat, triggerImmediateTick } from '@/lib/autonomous-runner';
import { getTaskStats } from '@/lib/agent-tasks';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
    noStore();
    const url      = new URL(req.url);
    const resource = url.searchParams.get('resource') ?? 'tasks';

    try {
        switch (resource) {
            case 'tasks':   return NextResponse.json(await getAutopilotTasks());
            case 'logs':    return NextResponse.json(await getAutopilotLogs({
                limit:  Number(url.searchParams.get('limit') ?? '100'),
                taskId: url.searchParams.get('taskId') ?? undefined,
            }));
            case 'profile': return NextResponse.json({ success: true, profile: await loadUserProfile() });
            case 'stats':   return NextResponse.json({ success: true, stats: getTaskStats() });
            case 'status':  return NextResponse.json({ success: true, ...getAutonomousRunnerStatus() });
            default:        return NextResponse.json({ success: false, error: `Unknown resource: ${resource}` }, { status: 400 });
        }
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    noStore();
    let body: any = {};
    try { body = await req.json(); } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const { action } = body;

    try {
        switch (action) {
            case 'add_task': {
                const result = await addAutopilotTask({
                    title:       body.title,
                    description: body.description,
                    priority:    body.priority,
                    tags:        body.tags,
                    planTitle:   body.planTitle,
                });
                // Wake the runner immediately — no need to wait for next heartbeat tick
                triggerImmediateTick();
                return NextResponse.json(result);
            }

            case 'edit_task':
                return NextResponse.json(await editAutopilotTask(body.id, {
                    title:       body.title,
                    description: body.description,
                    priority:    body.priority,
                    tags:        body.tags,
                    planTitle:   body.planTitle,
                    maxRetries:  body.maxRetries,
                }));

            case 'cancel_task':
                return NextResponse.json(await cancelAutopilotTask(body.id, body.reason));

            case 'delete_task':
                return NextResponse.json(await deleteAutopilotTask(body.id));

            case 'save_profile':
                return NextResponse.json(await saveUserProfile(body.profile ?? {}));

            case 'clear_logs':
                return NextResponse.json(await clearAutopilotLogs());

            case 'toggle_runner': {
                if (body.enabled) { startAutonomousHeartbeat(); }
                else               { stopAutonomousHeartbeat(); }
                return NextResponse.json({ success: true, running: body.enabled });
            }

            case 'approve_task': {
                const approveResult = await approveAutopilotTask(body.id);
                // Approved task is now pending → wake runner immediately
                triggerImmediateTick();
                return NextResponse.json(approveResult);
            }

            case 'reject_task':
                return NextResponse.json(await rejectAutopilotTask(body.id, body.reason));

            case 'retry_task': {
                const retryResult = await retryBlockedTask(body.id);
                if (retryResult.success) triggerImmediateTick();
                return NextResponse.json(retryResult);
            }

            case 'save_autopilot_config':
                return NextResponse.json(await saveAutopilotConfig({ maxCallsPerHour: body.maxCallsPerHour, pauseAfterTasks: body.pauseAfterTasks }));

            case 'resume_cost_pause': {
                const resumeResult = await resumeFromCostPause();
                triggerImmediateTick();
                return NextResponse.json(resumeResult);
            }

            default:
                return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message ?? 'Action failed' }, { status: 500 });
    }
}
