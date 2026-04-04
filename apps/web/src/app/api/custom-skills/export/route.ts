/**
 * GET /api/custom-skills/export?skillId=<id>
 *
 * Streams a ZIP archive of the requested custom skill back to the client.
 * The archive contains:
 *   - The skill's .js source file
 *   - A meta.json with the manifest entry (name, description, category, etc.)
 *
 * Uses the `archiver` npm package (already in dependencies).
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import fs                              from 'fs';
import path                            from 'path';
import { SKILLS_DIR, SKILLS_MANIFEST } from '@/lib/paths';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
    noStore();

    const { searchParams } = new URL(req.url);
    const skillId = searchParams.get('skillId')?.trim();

    if (!skillId) {
        return NextResponse.json({ error: 'Missing skillId query parameter' }, { status: 400 });
    }

    // â”€â”€ Load manifest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Manifest format: { skills: { [id]: CustomSkillMeta } }
    let skillsMap: Record<string, any> = {};
    try {
        const raw = fs.readFileSync(SKILLS_MANIFEST, 'utf8');
        const parsed = JSON.parse(raw);
        // Support both legacy array format and current object format
        if (Array.isArray(parsed)) {
            parsed.forEach((s: any) => { if (s?.id) skillsMap[s.id] = s; });
        } else {
            skillsMap = parsed?.skills ?? {};
        }
    } catch {
        return NextResponse.json({ error: 'Skills manifest not found or unreadable.' }, { status: 404 });
    }

    const skill = skillsMap[skillId];
    if (!skill) {
        return NextResponse.json({ error: `Skill "${skillId}" not found in manifest.` }, { status: 404 });
    }

    const skillFile = path.join(SKILLS_DIR, skill.file ?? `${skillId}.js`);
    if (!fs.existsSync(skillFile)) {
        return NextResponse.json({ error: `Skill file missing from disk: ${skill.file}` }, { status: 404 });
    }

    // â”€â”€ Build ZIP in memory using archiver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const archiver = require('archiver');

        const chunks: Buffer[] = [];

        await new Promise<void>((resolve, reject) => {
            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('data',  (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
            archive.on('end',   () => resolve());
            archive.on('error', (err: Error) => reject(err));
            archive.on('warning', (err: Error & { code?: string }) => {
                if (err.code !== 'ENOENT') reject(err);
            });

            // Add the skill source file
            archive.file(skillFile, { name: path.basename(skillFile) });

            // Add a meta.json so the ZIP is self-describing and re-importable
            const metaJson = JSON.stringify({
                id:          skill.id,
                name:        skill.name,
                description: skill.description ?? '',
                category:    skill.category    ?? 'other',
                icon:        skill.icon        ?? 'Wrench',
                version:     skill.version     ?? '1.0.0',
                author:      skill.author      ?? 'Unknown',
                hasUI:       skill.hasUI       ?? false,
                menuName:    skill.menuName    ?? '',
                menuRoute:   skill.menuRoute   ?? '',
                exportedAt:  new Date().toISOString(),
                exportedBy:  'Hands Free v6.0.0',
            }, null, 2);
            archive.append(metaJson, { name: 'meta.json' });

            archive.finalize();
        });

        const zipBuffer = Buffer.concat(chunks);
        const zipName   = `${skillId}-skill.zip`;

        return new NextResponse(zipBuffer, {
            status:  200,
            headers: {
                'Content-Type':        'application/zip',
                'Content-Disposition': `attachment; filename="${zipName}"`,
                'Content-Length':      String(zipBuffer.length),
                'Cache-Control':       'no-store',
            },
        });
    } catch (e: any) {
        console.error('[Hands Free] ZIP export failed:', e.message);
        return NextResponse.json({ error: `ZIP export failed: ${e.message}` }, { status: 500 });
    }
}
