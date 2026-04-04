/**
 * GET /api/mascot/skins
 *
 * Scans the public/mascot/ directory and returns metadata for every available
 * skin.  A valid skin is any subdirectory that contains at least one of the
 * expected category folders (idle, action, intro, outro).
 *
 * Response:
 *   { skins: SkinMeta[] }
 *
 * SkinMeta:
 *   {
 *     id:        string   â€” folder name (e.g. "handsfree")
 *     label:     string   â€” human-readable name (folder name, title-cased)
 *     preview:   string | null  â€” public path to first idle still image, if any
 *   }
 *
 * Never throws â€” always returns at least the default 'handsfree' skin.
 */

import { NextResponse }                  from 'next/server';
import { unstable_noStore as noStore }   from 'next/cache';
import fs                                from 'fs';
import path                              from 'path';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

const VALID_CATEGORIES = new Set(['idle', 'action', 'intro', 'outro']);
const IMAGE_EXTS       = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
// Skin name must be alphanumeric + hyphen/underscore only (prevents path traversal)
const SKIN_RE          = /^[a-z0-9_-]+$/i;

// Known skin descriptions â€” shown in the skin selector UI
const SKIN_DESCRIPTIONS: Record<string, string> = {
    handsfree:  'Hands Free - Your trusty green AI companion. Reliable and always ready to help.',
    bubbles: 'Bubbles - A blue liquid blob that morphs into different shapes. Playful and unpredictable.',
    capy:    'Capy - The chillest AI companion. Calm, cozy, and always relaxed.',
};

interface SkinMeta {
    id:          string;
    label:       string;
    preview:     string | null;
    description: string | null;
}

function toLabel(id: string): string {
    return id
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function findPreview(skinDir: string, skinId: string): string | null {
    // Look for a still image in /idle or the skin root
    const searchDirs = [
        path.join(skinDir, 'idle'),
        skinDir,
    ];
    for (const dir of searchDirs) {
        try {
            if (!fs.existsSync(dir)) continue;
            const files = fs.readdirSync(dir);
            const img = files.find(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
            if (img) return `/mascot/${skinId}/${dir === skinDir ? '' : 'idle/'}${img}`;
        } catch { /* skip */ }
    }
    return null;
}

export async function GET() {
    noStore();

    const mascotRoot = path.join(process.cwd(), 'public', 'mascot');
    const skins: SkinMeta[] = [];

    try {
        if (!fs.existsSync(mascotRoot)) {
            // Fallback: return hardcoded default so the UI never breaks
            return NextResponse.json({ skins: [{ id: 'handsfree', label: 'Hands Free', preview: null }] });
        }

        const entries = fs.readdirSync(mascotRoot, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (!SKIN_RE.test(entry.name)) continue; // safety: skip weird names

            const skinDir = path.join(mascotRoot, entry.name);

            // A skin must contain at least one valid category sub-folder
            let hasContent = false;
            try {
                const subDirs = fs.readdirSync(skinDir, { withFileTypes: true });
                hasContent = subDirs.some(d => d.isDirectory() && VALID_CATEGORIES.has(d.name));
            } catch { /* skip */ }

            if (!hasContent) continue;

            skins.push({
                id:          entry.name,
                label:       toLabel(entry.name),
                preview:     findPreview(skinDir, entry.name),
                description: SKIN_DESCRIPTIONS[entry.name] || null,
            });
        }

        // Always sort 'handsfree' first, then alphabetically
        skins.sort((a, b) => {
            if (a.id === 'handsfree') return -1;
            if (b.id === 'handsfree') return  1;
            return a.id.localeCompare(b.id);
        });

        // Guarantee at least one skin
        if (skins.length === 0) {
            skins.push({ id: 'handsfree', label: 'Hands Free', preview: null });
        }

    } catch {
        skins.push({ id: 'handsfree', label: 'Hands Free', preview: null });
    }

    return NextResponse.json({ skins });
}
