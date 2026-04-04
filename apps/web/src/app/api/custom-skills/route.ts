/**
 * GET  /api/custom-skills         — list all custom skills
 * DELETE /api/custom-skills?id=x  — delete skill by id
 * PATCH  /api/custom-skills?id=x  — toggle skill enabled state or update metadata
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import {
    listCustomSkills,
    deleteCustomSkill,
    toggleCustomSkill,
    updateCustomSkill,
} from '@/actions/custom-skills';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    noStore();
    const skills = await listCustomSkills();
    return NextResponse.json({ skills });
}

export async function DELETE(req: Request) {
    noStore();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const result = await deleteCustomSkill(id);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
}

export async function PATCH(req: Request) {
    noStore();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    let body: any;
    try { body = await req.json(); } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // If only 'enabled' is present, use toggleCustomSkill (legacy behavior)
    if (body.enabled !== undefined && Object.keys(body).length === 1) {
        if (typeof body.enabled !== 'boolean') {
            return NextResponse.json({ error: 'enabled must be boolean' }, { status: 400 });
        }
        const result = await toggleCustomSkill(id, body.enabled);
        return NextResponse.json(result, { status: result.success ? 200 : 404 });
    }

    // Otherwise, use updateCustomSkill for metadata updates
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.category !== undefined) updates.category = body.category;
    if (body.description !== undefined) updates.description = body.description;
    if (body.hasUI !== undefined) updates.hasUI = body.hasUI;
    if (body.menuName !== undefined) updates.menuName = body.menuName;
    if (body.menuRoute !== undefined) updates.menuRoute = body.menuRoute;

    const result = await updateCustomSkill(id, updates);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
