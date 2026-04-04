/**
 * POST /api/custom-skills/fix
 *
 * Autonomous skill repair pipeline:
 *   1. Load the existing (broken) skill code from disk
 *   2. Build a fix prompt: original code + error description â†’ send to LLM
 *   3. Validate the new code (up to MAX_ATTEMPTS attempts)
 *   4. Overwrite the skill file and update status in the manifest
 *
 * Body:
 * {
 *   skillId:          string,   // existing skill ID in the manifest
 *   provider:         string,   // LLM provider (same as generate page selection)
 *   model:            string,   // LLM model
 *   errorDescription?: string,  // optional extra context from the user
 * }
 *
 * Response:
 * {
 *   success:  boolean,
 *   skill?:   CustomSkillMeta,
 *   attempts: number,
 *   warning?: string,   // present when still broken after all attempts
 *   error?:   string,
 * }
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import fs                             from 'fs';
import path                           from 'path';
import { SKILLS_DIR }                 from '@/lib/paths';
import {
    getCustomSkillById,
    updateCustomSkill,
} from '@/actions/custom-skills';
import { loadSettings } from '@/actions/chat';
import {
    callLLM,
    extractCode,
    validateSkillCode,
} from '@/lib/skill-ai';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

const MAX_ATTEMPTS = 3;

// â”€â”€â”€ Fix system prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildFixSystemPrompt(): string {
    return `You are a Hands Free Skill AI â€” an expert Node.js developer who repairs broken Hands Free v5 custom skill modules.

STRICT OUTPUT RULES:
1. Output ONLY valid JavaScript code â€” no markdown fences, no explanations, no commentary.
2. The file must export a CommonJS module (module.exports = { ... }).
3. The execute() function must be async and return { success: boolean, result?: any, error?: string }.
4. Use ONLY Node.js built-in modules: fs, path, https, http, crypto, os, util, child_process.
   NEVER use: require('react'), require('react-dom'), or any browser/UI library.
5. Fix ONLY the reported error. Preserve all skill metadata (name, id, description, category, icon, etc.) exactly.
6. The code must be production-quality: handle errors gracefully and include clear comments.

You will receive the broken skill code and the error message. Return the complete fixed skill file.`;
}

// â”€â”€â”€ Route handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: Request) {
    noStore();

    let body: any;
    try { body = await req.json(); } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { skillId, provider, model, errorDescription } = body ?? {};

    if (!skillId || !provider || !model) {
        return NextResponse.json(
            { error: 'Missing required fields: skillId, provider, model' },
            { status: 400 },
        );
    }

    // â”€â”€ Load skill metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const skill = await getCustomSkillById(skillId);
    if (!skill) {
        return NextResponse.json({ error: `Skill "${skillId}" not found` }, { status: 404 });
    }

    // â”€â”€ Load current skill code (try disk â†’ manifest backup â†’ regenerate from metadata) â”€â”€
    const skillFile = path.join(SKILLS_DIR, skill.file ?? `${skillId}.js`);
    let fileExists = fs.existsSync(skillFile);
    let existingCode = fileExists ? fs.readFileSync(skillFile, 'utf-8') : '';

    // If file is missing but we have a backup in the manifest, restore it first
    if (!fileExists && (skill as any)._codeBackup) {
        existingCode = (skill as any)._codeBackup;
        try {
            if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
            fs.writeFileSync(skillFile, existingCode, 'utf-8');
            fileExists = true;
        } catch { /* restore failed â€” will regenerate from scratch */ }
    }

    // â”€â”€ Build the repair prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const knownError = skill.lastError ?? errorDescription ?? 'Unknown error â€” the skill was marked as broken.';

    let baseUserPrompt: string;
    if (!fileExists) {
        // File missing from disk â€” regenerate from scratch using skill metadata
        baseUserPrompt =
            `The Hands Free skill "${skill.name}" is registered in the manifest but its JavaScript file ` +
            `is missing from disk. Regenerate the complete skill from scratch based on the metadata below.\n\n` +
            `SKILL METADATA:\n` +
            `- Name: ${skill.name}\n` +
            `- Description: ${skill.description || '(none)'}\n` +
            `- Category: ${skill.category}\n` +
            `- Icon: ${skill.icon}\n` +
            `- Has UI (sidebar page): ${skill.hasUI ? 'yes' : 'no'}\n` +
            (skill.menuName ? `- Menu name: ${skill.menuName}\n` : '') +
            `\nReturn the complete JavaScript skill file only. No markdown. No explanations.`;
    } else {
        baseUserPrompt =
            `Fix the following broken Hands Free skill.\n\n` +
            `REPORTED ERROR:\n${knownError}\n\n` +
            (errorDescription && errorDescription !== knownError
                ? `ADDITIONAL USER CONTEXT:\n${errorDescription}\n\n`
                : '') +
            `CURRENT (BROKEN) CODE:\n\`\`\`javascript\n${existingCode}\n\`\`\`\n\n` +
            `Return the complete fixed JavaScript file only. No markdown. No explanations.`;
    }

    try {
        const settings     = await loadSettings();
        const systemPrompt = buildFixSystemPrompt();

        let code      = '';
        let lastError = '';
        let attempts  = 0;

        // â”€â”€ Autonomous fix â†’ validate â†’ retry loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        while (attempts < MAX_ATTEMPTS) {
            attempts++;

            const retryBlock = attempts > 1
                ? `\n\n---\nYOUR PREVIOUS FIX ATTEMPT STILL FAILED:\n${lastError}\n\nFix this new error too. Output ONLY valid JavaScript.`
                : '';

            let rawCode: string;
            try {
                rawCode = await callLLM(settings, provider, model, systemPrompt, baseUserPrompt + retryBlock);
            } catch (llmErr: any) {
                return NextResponse.json({ error: llmErr.message ?? 'LLM call failed' }, { status: 502 });
            }

            code = extractCode(rawCode);

            if (!code.includes('module.exports')) {
                lastError = `Attempt ${attempts}: LLM output did not contain module.exports`;
                continue;
            }

            const validation = await validateSkillCode(code);
            if (validation.valid) {
                lastError = '';
                break;
            }

            lastError = `Attempt ${attempts}: ${validation.error ?? 'Validation failed'}`;
        }

        // â”€â”€ Persist result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const updateResult = await updateCustomSkill(
            skillId,
            {
                status:    lastError ? 'error' : 'active',
                lastError: lastError || undefined,
            },
            code, // always overwrite with latest generated code
        );

        if (!updateResult.success) {
            return NextResponse.json({ error: updateResult.error ?? 'Failed to save fixed skill' }, { status: 500 });
        }

        if (lastError) {
            return NextResponse.json({
                success:  true,
                skill:    updateResult.skill,
                attempts,
                warning:  `Skill still has issues after ${MAX_ATTEMPTS} fix attempts. Last error: ${lastError}`,
            });
        }

        return NextResponse.json({ success: true, skill: updateResult.skill, attempts });

    } catch (e: any) {
        return NextResponse.json({ error: e.message ?? 'Fix failed' }, { status: 500 });
    }
}
