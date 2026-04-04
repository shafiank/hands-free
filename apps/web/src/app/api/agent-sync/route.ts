/**
 * /api/agent-sync â€” Hands Free v5 Multi-Agent Handshake & Task Delegation Protocol
 *
 * Allows remote Hands Free instances (or any agent that speaks this protocol)
 * to announce themselves, delegate tasks, and receive capability manifests.
 *
 * â”€â”€â”€ Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * GET  /api/agent-sync
 *   â†’ Returns this agent's identity card and capability manifest.
 *   â†’ Used for discovery: "Who are you and what can you do?"
 *
 * POST /api/agent-sync
 *   Body: AgentSyncRequest
 *   â†’ Handles:
 *       type: "handshake"   â€” peer announces itself; returns this agent's card
 *       type: "delegate"    â€” remote agent delegates a task to this instance
 *       type: "status"      â€” request status of a previously delegated task
 *       type: "ping"        â€” simple liveness check
 *
 * â”€â”€â”€ Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Requests MUST include the header:
 *   X-Hands Free-Agent: <sharedSecret>
 * where sharedSecret is the value of HANDSFREE_AGENT_SECRET env var (if set).
 * If HANDSFREE_AGENT_SECRET is not set, agent-sync is open (localhost-only is assumed).
 */

import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { loadSoul, loadHuman }         from '@/actions/identity';
import { createTask, getTask }         from '@/actions/tasks';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface AgentCard {
    agentId:      string;
    name:         string;
    version:      string;
    protocol:     string;
    capabilities: string[];
    syncEndpoint: string;
    timestamp:    number;
}

type AgentSyncRequest =
    | { type: 'ping' }
    | { type: 'handshake'; from: AgentCard }
    | { type: 'delegate';  task: { title: string; description: string; priority?: 'low' | 'normal' | 'high' } }
    | { type: 'status';    taskId: string };

// â”€â”€â”€ Auth helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function isAuthorized(req: Request): boolean {
    const secret = process.env.HANDSFREE_AGENT_SECRET;
    if (!secret) return true; // No secret configured â†’ open
    const header = req.headers.get('x-handsfree-agent') ?? '';
    return header === secret;
}

// â”€â”€â”€ Build this agent's identity card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function buildAgentCard(reqUrl: string): Promise<AgentCard> {
    let agentName = 'Hands Free';
    let agentId   = 'handsfree-default';
    try {
        const soul  = await loadSoul();
        const human = await loadHuman();
        agentName   = human.name ? `Hands Free (${human.name}'s)` : 'Hands Free';
        agentId     = `handsfree-${(soul.createdAt ?? Date.now()).toString(36)}`;
    } catch { /* identity not yet bootstrapped */ }

    const origin = new URL(reqUrl).origin;

    return {
        agentId,
        name:         agentName,
        version:      '6.0.0',
        protocol:     'handsfree-agent-sync/1.0',
        capabilities: [
            'chat', 'task-delegation', 'web-search', 'file-read', 'file-write',
            'calendar', 'telegram', 'email', 'code-execution', 'image-generation',
            'network-scan', 'dlna-cast', 'custom-skills', 'autopilot',
        ],
        syncEndpoint: `${origin}/api/agent-sync`,
        timestamp:    Date.now(),
    };
}

// â”€â”€â”€ GET /api/agent-sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function GET(req: Request) {
    noStore();
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const card = await buildAgentCard(req.url);
    return NextResponse.json({ ok: true, agent: card });
}

// â”€â”€â”€ POST /api/agent-sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: Request) {
    noStore();
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: AgentSyncRequest;
    try { body = await req.json(); } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const myCard = await buildAgentCard(req.url);

    switch (body.type) {

        // â”€â”€ Ping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        case 'ping': {
            return NextResponse.json({ ok: true, pong: true, agentId: myCard.agentId, timestamp: Date.now() });
        }

        // â”€â”€ Handshake â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // A remote agent announces itself. We log it and reply with our own card.
        case 'handshake': {
            const peer = body.from;
            console.log(`[AgentSync] Handshake from "${peer?.name ?? '?'}" (${peer?.agentId ?? 'unknown'}) at ${peer?.syncEndpoint ?? '?'}`);
            return NextResponse.json({
                ok:    true,
                agent: myCard,
                message: `Hello from ${myCard.name}! Handshake accepted.`,
            });
        }

        // â”€â”€ Delegate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // A remote agent asks us to execute a task on its behalf.
        case 'delegate': {
            const { task } = body;
            if (!task?.title || !task?.description) {
                return NextResponse.json({ error: 'Missing task.title or task.description' }, { status: 400 });
            }
            try {
                const created = await createTask({
                    title:       `[DELEGATED] ${task.title}`,
                    description: task.description,
                    priority:    task.priority ?? 'normal',
                });
                console.log(`[AgentSync] Task delegated: "${task.title}" â†’ id=${created.id}`);
                return NextResponse.json({
                    ok:     true,
                    taskId: created.id,
                    message: `Task "${task.title}" accepted and queued (id: ${created.id}).`,
                });
            } catch (err: any) {
                return NextResponse.json({ error: err.message ?? 'Failed to create task' }, { status: 500 });
            }
        }

        // â”€â”€ Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Check the status of a previously delegated task.
        case 'status': {
            const { taskId } = body;
            if (!taskId) {
                return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
            }
            try {
                const task = await getTask(taskId);
                if (!task) {
                    return NextResponse.json({ error: `Task "${taskId}" not found` }, { status: 404 });
                }
                return NextResponse.json({
                    ok:     true,
                    taskId: task.id,
                    status: task.status,
                    result: task.result ?? null,
                    error:  task.error  ?? null,
                });
            } catch (err: any) {
                return NextResponse.json({ error: err.message ?? 'Failed to retrieve task' }, { status: 500 });
            }
        }

        default:
            return NextResponse.json({ error: `Unknown request type: ${(body as any).type}` }, { status: 400 });
    }
}
