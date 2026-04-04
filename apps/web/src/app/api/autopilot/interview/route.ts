/**
 * POST /api/autopilot/interview
 * Body: { history: [{role, content}][], activeSkills?: string[] }
 * Runs one turn of the Deep-Dive interview.
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { runInterviewTurn }           from '@/actions/autopilot';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
    noStore();
    let body: any = {};
    try { body = await req.json(); } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }
    const result = await runInterviewTurn({ history: body.history ?? [], activeSkills: body.activeSkills });
    return NextResponse.json(result);
}
