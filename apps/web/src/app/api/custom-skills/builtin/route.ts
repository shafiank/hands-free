/**
 * GET /api/custom-skills/builtin?skill=gallery|quoty
 *
 * Installs a built-in sample skill.
 * Reads the code from /data/builtin-skills/ and saves it via installBuiltinSkill().
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import fs   from 'fs';
import path from 'path';
import { installBuiltinSkill }         from '@/actions/custom-skills';
import type { SkillCategory }          from '@/actions/custom-skills';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

// â”€â”€ Built-in skill metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BUILTIN_SKILLS: Record<string, {
    id:          string;
    name:        string;
    description: string;
    category:    SkillCategory;
    icon:        string;
    version:     string;
    author:      string;
    hasUI:       boolean;
    menuName:    string;
    menuRoute:   string;
    filename:    string; // relative to builtin-skills dir
}> = {
    gallery: {
        id:          'gallery',
        name:        'Gallery',
        description: 'Media library with grid view and lightbox for all workspace images',
        category:    'creative',
        icon:        'Image',
        version:     '1.0.0',
        author:      'Hands Free',
        hasUI:       true,
        menuName:    'Gallery',
        menuRoute:   '/custom/gallery',
        filename:    'gallery.js',
    },
    quoty: {
        id:          'quoty',
        name:        'Quoty',
        description: 'AI-generated inspirational quotes â€” fresh and unique every time',
        category:    'creative',
        icon:        'Quote',
        version:     '2.0.0',
        author:      'Hands Free',
        hasUI:       true,
        menuName:    'Quoty',
        menuRoute:   '/custom/quoty',
        filename:    'quoty.js',
    },
};

// â”€â”€ Resolve built-in skill code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getBuiltinCode(filename: string): string | null {
    // Try multiple locations for the skill source
    const candidates = [
        path.join(process.cwd(), 'src', 'data', 'builtin-skills', filename),
        path.join(process.cwd(), 'data', 'builtin-skills', filename),
        path.join(__dirname, '..', '..', '..', '..', 'data', 'builtin-skills', filename),
    ];

    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
        } catch { /* try next */ }
    }
    return null;
}

// â”€â”€â”€ Route handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function GET(req: Request) {
    noStore();

    const { searchParams } = new URL(req.url);
    const skillKey = searchParams.get('skill');

    if (!skillKey || !BUILTIN_SKILLS[skillKey]) {
        return NextResponse.json(
            { error: `Unknown built-in skill "${skillKey}". Available: ${Object.keys(BUILTIN_SKILLS).join(', ')}` },
            { status: 400 },
        );
    }

    const meta = BUILTIN_SKILLS[skillKey];
    const code = getBuiltinCode(meta.filename);

    if (!code) {
        return NextResponse.json(
            { error: `Built-in skill file "${meta.filename}" not found on disk.` },
            { status: 404 },
        );
    }

    try {
        const result = await installBuiltinSkill({
            id:   meta.id,
            code,
            meta: {
                name:        meta.name,
                description: meta.description,
                category:    meta.category,
                icon:        meta.icon,
                version:     meta.version,
                author:      meta.author,
                hasUI:       meta.hasUI,
                menuName:    meta.menuName,
                menuRoute:   meta.menuRoute,
            },
        });

        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
