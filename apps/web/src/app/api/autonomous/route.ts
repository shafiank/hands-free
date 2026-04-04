/**
 * GET  /api/autonomous  — returns the runner's live status + task queue counts
 * POST /api/autonomous  — { enabled: boolean } starts or stops the heartbeat
 *
 * This endpoint is always force-dynamic / never cached so the React frontend
 * always gets live state.
 */

import { NextResponse }            from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';

import {
    startAutonomousHeartbeat,
    stopAutonomousHeartbeat,
    getAutonomousRunnerStatus,
} from '@/lib/autonomous-runner';

import {
    getAllTasks,
} from '@/lib/agent-tasks';

export const dynamic   = 'force-dynamic';
export const revalidate = 0;

// ─── GET /api/autonomous ─────────────────────────────────────

export async function GET() {
    noStore();

    const status = getAutonomousRunnerStatus();
    const tasks  = getAllTasks();

    const counts = {
        pending:    tasks.filter(t => t.state === 'pending').length,
        in_progress: tasks.filter(t => t.state === 'in_progress').length,
        completed:  tasks.filter(t => t.state === 'completed').length,
        failed:     tasks.filter(t => t.state === 'failed').length,
        total:      tasks.length,
    };

    return NextResponse.json({ ...status, tasks: counts });
}

// ─── POST /api/autonomous ────────────────────────────────────

export async function POST(request: Request) {
    noStore();

    let body: { enabled?: boolean };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (typeof body.enabled !== 'boolean') {
        return NextResponse.json(
            { error: 'Body must be { enabled: boolean }' },
            { status: 400 },
        );
    }

    if (body.enabled) {
        startAutonomousHeartbeat();
    } else {
        stopAutonomousHeartbeat();
    }

    return NextResponse.json({ ok: true, ...getAutonomousRunnerStatus() });
}
