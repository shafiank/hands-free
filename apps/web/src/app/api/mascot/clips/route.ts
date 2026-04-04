/**
 * GET /api/mascot/clips?skin=handy&category=idle
 *
 * Returns the list of video clip paths for a given skin + category.
 * Used by the Desktop Buddy FSM so that new clips can be added to the
 * filesystem without any code changes.
 *
 * Query params:
 *   skin     Ã¢â‚¬â€ mascot skin folder name (default: 'handy')
 *   category Ã¢â‚¬â€ 'idle' | 'action' | 'intro' | 'outro'
 *
 * Response:
 *   { clips: string[] }   Ã¢â‚¬â€ public-relative paths, e.g. /mascot/handy/idle/stand.webm
 *                           Empty array when the folder doesn't exist (never 404).
 */

import { NextRequest, NextResponse }    from 'next/server';
import { unstable_noStore as noStore }  from 'next/cache';
import fs                               from 'fs';
import path                             from 'path';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

// Allowed skins / categories Ã¢â‚¬â€ prevents path-traversal
const ALLOWED_CATEGORIES = new Set(['idle', 'action', 'intro', 'outro']);
// Skin name must be alphanumeric + hyphen/underscore only
const SKIN_RE = /^[a-z0-9_-]+$/i;

export async function GET(req: NextRequest) {
    noStore();
    const { searchParams } = new URL(req.url);

    const skin     = (searchParams.get('skin')     ?? 'handy').trim();
    const category = (searchParams.get('category') ?? '').trim();

    // Validation Ã¢â‚¬â€ reject anything that looks like path traversal
    if (!SKIN_RE.test(skin) || skin.includes('..')) {
        return NextResponse.json({ error: 'invalid skin parameter' }, { status: 400 });
    }
    if (!ALLOWED_CATEGORIES.has(category)) {
        return NextResponse.json(
            { error: `category must be one of: ${[...ALLOWED_CATEGORIES].join(', ')}` },
            { status: 400 }
        );
    }

    const mascotDir = path.join(process.cwd(), 'public', 'mascot', skin, category);

    try {
        if (!fs.existsSync(mascotDir)) {
            return NextResponse.json({ clips: [] });
        }

        const files = fs
            .readdirSync(mascotDir)
            .filter(f => f.endsWith('.webm') || f.endsWith('.mp4'))
            .sort()                                     // deterministic ordering
            .map(f => `/mascot/${skin}/${category}/${f}`);

        return NextResponse.json({ clips: files });
    } catch {
        // Filesystem error Ã¢â‚¬â€ return empty array rather than 500
        return NextResponse.json({ clips: [] });
    }
}
