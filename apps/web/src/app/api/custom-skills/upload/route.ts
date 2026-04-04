/**
 * POST /api/custom-skills/upload
 *
 * Accepts a JSON body: { filename: string, data: string (base64) }
 *
 * The file can be a .js, .ts, or .zip.
 * - .js / .ts  â†’ installed directly
 * - .zip       â†’ extracted and every .js inside is installed
 *
 * Uses vm.Script for in-memory metadata extraction â€” no temp-file require()
 * which would be quarantined by Windows Defender.
 */
import { NextResponse }                   from 'next/server';
import { unstable_noStore as noStore }     from 'next/cache';
import fs                                  from 'fs';
import path                                from 'path';
import os                                  from 'os';
import vm                                  from 'vm';
import { SKILLS_DIR }                      from '@/lib/paths';
import { saveCustomSkill, type SkillCategory } from '@/actions/custom-skills';
import { scanAttachment }                  from '@/actions/virustotal';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ensureSkillsDir() {
    if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

/**
 * Native Node.js require â€” bypasses webpack's __webpack_require__.
 * eval('require') is the standard trick: webpack cannot statically analyze eval(),
 * so we get the REAL Node.js require that resolves core modules and arbitrary paths.
 */
// eslint-disable-next-line no-eval
const nativeRequire: NodeRequire = eval('require');

/** Sandbox require for skill metadata extraction â€” normalizes node: prefixes. */
function sandboxRequire(moduleName: string): any {
    const name = moduleName.startsWith('node:') ? moduleName.slice(5) : moduleName;
    return nativeRequire(name);
}

/**
 * Extract skill metadata from a JS code string using vm.Script â€” no file I/O.
 * Immune to Windows Defender temp-file quarantine.
 */
function readSkillMetaFromCode(code: string): Record<string, any> | null {
    try {
        // Syntax check first
        new vm.Script(code, { filename: 'upload-validate.js' });

        const fakeModule = { exports: {} as any };
        const wrapped    = `(function(module,exports,require,__dirname,__filename){\n${code}\n})`;
        const fn         = vm.runInThisContext(wrapped, { filename: 'upload-validate.js' });
        fn(fakeModule, fakeModule.exports, sandboxRequire, SKILLS_DIR, path.join(SKILLS_DIR, 'upload.js'));

        const mod = fakeModule.exports;
        if (mod && typeof mod === 'object' && mod.name) return mod;
        if (mod?.default && typeof mod.default === 'object' && mod.default.name) return mod.default;
    } catch { /* invalid module â€” fall through */ }
    return null;
}

/** Process a single JS code string as a skill. */
async function processJsCode(
    code: string,
    originalName: string,
): Promise<{ success: boolean; error?: string; skill?: any }> {
    const meta = readSkillMetaFromCode(code);

    if (!meta) {
        // Metadata extraction failed (likely missing execute() or name).
        // Still install the skill â€” it will be marked as broken so user can fix it.
        return saveCustomSkill({
            code,
            meta: {
                name:        path.basename(originalName, '.js'),
                description: '(metadata could not be read â€” use Fix to repair)',
                category:    'other' as SkillCategory,
                icon:        'Wrench',
                version:     '1.0.0',
                author:      'Upload',
                hasUI:       false,
                status:      'error',
                lastError:   'Uploaded file does not export a valid Hands Free skill object.',
            },
        });
    }

    return saveCustomSkill({
        code,
        meta: {
            name:        String(meta.name ?? originalName),
            description: String(meta.description ?? ''),
            category:    (meta.category as SkillCategory) ?? 'other',
            icon:        String(meta.icon ?? 'Wrench'),
            version:     String(meta.version ?? '1.0.0'),
            author:      String(meta.author ?? 'User'),
            hasUI:       Boolean(meta.hasUI),
            menuName:    meta.hasUI ? String(meta.menuName ?? meta.name) : undefined,
            menuRoute:   meta.hasUI ? String(meta.menuRoute ?? `/custom/${meta.id ?? ''}`) : undefined,
        },
    });
}

// â”€â”€â”€ Route handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: Request) {
    noStore();
    ensureSkillsDir();

    // Accept JSON body { filename: string, data: string (base64) }
    let body: { filename?: string; data?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Expected JSON body with { filename, data (base64) }' }, { status: 400 });
    }

    const { filename, data } = body ?? {};
    if (!filename || !data) {
        return NextResponse.json({ error: 'Missing filename or data field' }, { status: 400 });
    }

    const ext = path.extname(filename).toLowerCase();
    if (!['.js', '.ts', '.zip'].includes(ext)) {
        return NextResponse.json(
            { error: `Unsupported file type "${ext}". Allowed: .js, .ts, .zip` },
            { status: 400 },
        );
    }

    const buffer = Buffer.from(data, 'base64');

    // â”€â”€ VirusTotal scan (non-blocking if VT is not configured) â”€â”€â”€â”€â”€â”€
    try {
        const vtResult = await scanAttachment(data, filename);
        if (vtResult.success && vtResult.maliciousCount && vtResult.maliciousCount > 0) {
            return NextResponse.json(
                { error: `VirusTotal flagged this file as malicious (${vtResult.maliciousCount} detection${vtResult.maliciousCount > 1 ? 's' : ''}). Upload blocked for safety.` },
                { status: 422 },
            );
        }
        // If VT is not configured or file is clean/unknown, continue with install
    } catch {
        // VT scan failed (network error, etc.) â€” proceed with install
    }

    // â”€â”€ ZIP handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (ext === '.zip') {
        const tmpZip = path.join(os.tmpdir(), `handsfree-upload-${Date.now()}.zip`);
        const tmpDir = path.join(os.tmpdir(), `handsfree-extract-${Date.now()}`);
        fs.writeFileSync(tmpZip, buffer);
        fs.mkdirSync(tmpDir, { recursive: true });

        try {
            const extractZip = (await import('extract-zip')).default;
            await extractZip(tmpZip, { dir: tmpDir });
        } catch (e: any) {
            return NextResponse.json({ error: `Failed to extract zip: ${e.message}` }, { status: 422 });
        } finally {
            try { fs.unlinkSync(tmpZip); } catch { /* ignore */ }
        }

        // Find all .js files inside the extracted folder (recursively)
        function findJs(dir: string): string[] {
            const results: string[] = [];
            try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) results.push(...findJs(full));
                    else if (entry.name.endsWith('.js') && !entry.name.startsWith('.')) results.push(full);
                }
            } catch { /* skip unreadable dirs */ }
            return results;
        }

        const jsFiles = findJs(tmpDir);
        if (jsFiles.length === 0) {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
            return NextResponse.json({ error: 'Zip contains no .js files.' }, { status: 422 });
        }

        const results: any[] = [];
        for (const jsPath of jsFiles) {
            try {
                const code = fs.readFileSync(jsPath, 'utf8');
                const r    = await processJsCode(code, path.basename(jsPath));
                results.push(r);
            } catch (e: any) {
                results.push({ success: false, error: e.message });
            }
        }

        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }

        const succeeded = results.filter(r => r.success);
        const failed    = results.filter(r => !r.success);
        return NextResponse.json({ success: succeeded.length > 0, installed: succeeded.length, failed: failed.length, results });
    }

    // â”€â”€ Single .js / .ts file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const code   = buffer.toString('utf8');
    const result = await processJsCode(code, filename);
    return NextResponse.json(result, { status: result.success ? 200 : 422 });
}
