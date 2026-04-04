// GET /api/skills/active
// Returns list of currently enabled skill IDs.
// Used by the Sidebar to conditionally show skill-based nav items.
//
// IMPORTANT: force-dynamic prevents Next.js from caching this response,
// ensuring the sidebar always reads the current skills.json state.

import { DATA_DIR } from '@/lib/paths';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SKILLS_FILE = path.join(DATA_DIR, 'skills.json');

export async function GET() {
    try {
        if (!fs.existsSync(SKILLS_FILE)) {
            return NextResponse.json({ skills: [] });
        }
        const raw = JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf-8'));
        const active: string[] = Object.entries(raw.skills || {})
            .filter(([, cfg]: [string, any]) => cfg?.enabled === true)
            .map(([id]) => id);
        return NextResponse.json({ skills: active });
    } catch {
        return NextResponse.json({ skills: [] });
    }
}
