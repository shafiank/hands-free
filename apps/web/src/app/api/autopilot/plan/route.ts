/**
 * POST /api/autopilot/plan
 * Body: { activeSkills?: string[], overrideGoal?: string }
 * Generates and queues a Master Plan.
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { generateMasterPlan }         from '@/actions/autopilot';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
    noStore();
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }
    const result = await generateMasterPlan({ activeSkills: body.activeSkills, overrideGoal: body.overrideGoal });
    return NextResponse.json(result);
}
