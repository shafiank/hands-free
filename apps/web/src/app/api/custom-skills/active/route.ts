/**
 * GET /api/custom-skills/active
 *
 * Returns all enabled custom skills that have hasUI=true.
 * Used by the sidebar to render dynamic nav entries.
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { getActiveCustomSkillsWithUI } from '@/actions/custom-skills';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    noStore();
    const skills = await getActiveCustomSkillsWithUI();
    return NextResponse.json({
        skills: skills.map(s => ({
            id:        s.id,
            name:      s.name,
            menuName:  s.menuName ?? s.name,
            menuRoute: s.menuRoute ?? `/custom/${s.id}`,
            icon:      s.icon,
        })),
    });
}
