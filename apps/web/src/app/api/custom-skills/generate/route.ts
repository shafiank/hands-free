/**
 * POST /api/custom-skills/generate
 *
 * Autonomous Skill AI pipeline:
 *   1. Call LLM to generate skill code
 *   2. Validate the code (syntax check + execute() call with dummy context)
 *   3. If validation fails, retry up to MAX_ATTEMPTS total with the error injected
 *      into the LLM prompt so it can self-correct
 *   4. Save the skill with status:'active' on success, status:'error' on all failures
 *
 * Request body:
 * {
 *   name:            string,
 *   category:        SkillCategory,
 *   icon:            string,
 *   hasUI:           boolean,
 *   menuName?:       string,
 *   requiresApiKeys: boolean,
 *   prompt:          string,
 *   provider:        string,
 *   model:           string,
 * }
 *
 * Response:
 * {
 *   success:   boolean,
 *   skill?:    CustomSkillMeta,
 *   attempts:  number,           // how many LLM calls were made
 *   warning?:  string,           // present when skill saved with status:'error'
 *   error?:    string,
 * }
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { saveCustomSkill, updateCustomSkill, getCustomSkillSource, getCustomSkillById, type SkillCategory } from '@/actions/custom-skills';
import { loadSettings }               from '@/actions/chat';
import {
    buildSystemPrompt,
    callLLM,
    extractCode,
    validateSkillCode,
} from '@/lib/skill-ai';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

const MAX_ATTEMPTS = 3;

// â”€â”€â”€ Route handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: Request) {
    noStore();

    let body: any;
    try { body = await req.json(); } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, category, icon, hasUI, menuName, requiresApiKeys, prompt, provider, model, existingSkillId } = body ?? {};

    if (!name || !category || !prompt || !provider || !model) {
        return NextResponse.json(
            { error: 'Missing required fields: name, category, prompt, provider, model' },
            { status: 400 },
        );
    }

    try {
        const settings     = await loadSettings();
        const systemPrompt = buildSystemPrompt({
            name,
            category,
            icon:            icon ?? 'Wrench',
            hasUI:           !!hasUI,
            menuName,
            requiresApiKeys: !!requiresApiKeys,
        });

        // â”€â”€ If editing an existing skill, load its current code and include it â”€â”€
        let existingCode = '';
        if (existingSkillId) {
            try {
                const src = await getCustomSkillSource(existingSkillId);
                if (src.success && src.code) existingCode = src.code;
            } catch { /* non-fatal â€” proceed without existing code */ }
        }

        const baseUserPrompt = existingCode
            ? `You are MODIFYING an existing Hands Free custom skill. Here is the current skill code:\n\n\`\`\`javascript\n${existingCode}\n\`\`\`\n\nApply the following changes to this skill. Preserve everything else â€” keep the same module structure, the same skill name, and the same functionality unless explicitly asked to change it:\n\n${prompt}`
            : `Build a Hands Free custom skill that does the following:\n\n${prompt}`;

        let code          = '';
        let lastError     = '';
        let attempts      = 0;

        // â”€â”€ Autonomous generate â†’ validate â†’ retry loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        while (attempts < MAX_ATTEMPTS) {
            attempts++;

            // On retries, feed the previous error back to the LLM so it can fix it
            const retryBlock = attempts > 1
                ? `\n\n---\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION WITH THIS ERROR:\n${lastError}\n\nFix the above error. Do NOT repeat the same mistake. Output ONLY valid JavaScript.`
                : '';

            let rawCode: string;
            try {
                rawCode = await callLLM(settings, provider, model, systemPrompt, baseUserPrompt + retryBlock);
            } catch (llmErr: any) {
                // LLM call itself failed (bad API key, network, etc.) â€” no point retrying
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
                break;  //
            }

            lastError = `Attempt ${attempts}: ${validation.error ?? 'Validation failed'}`;
        }

        // â”€â”€ Save skill (with appropriate status) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const finalStatus = lastError ? 'error' : 'active';
        const slug        = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        let savedSkill: any;

        if (existingSkillId) {
            // â”€â”€ EDIT MODE: overwrite the existing skill in-place (same ID/filename) â”€â”€
            const updateResult = await updateCustomSkill(existingSkillId, {
                name,
                description: `AI-generated skill: ${name}`,
                category:    category as SkillCategory,
                icon:        icon ?? 'Wrench',
                hasUI:       !!hasUI,
                menuName:    hasUI ? (menuName ?? name) : undefined,
                menuRoute:   hasUI ? `/custom/${slug}` : undefined,
                status:      finalStatus,
                lastError:   lastError || undefined,
            }, code);
            if (!updateResult.success) {
                return NextResponse.json({ error: updateResult.error ?? 'Failed to update skill' }, { status: 500 });
            }
            savedSkill = updateResult.skill;
        } else {
            // â”€â”€ CREATE MODE: save as a brand-new skill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            const saveResult = await saveCustomSkill({
                code,
                meta: {
                    name,
                    description: `AI-generated skill: ${name}`,
                    category:    category as SkillCategory,
                    icon:        icon ?? 'Wrench',
                    version:     '1.0.0',
                    author:      'Skill AI',
                    hasUI:       !!hasUI,
                    menuName:    hasUI ? (menuName ?? name) : undefined,
                    menuRoute:   hasUI ? `/custom/${slug}` : undefined,
                    status:      finalStatus,
                    lastError:   lastError || undefined,
                },
            });
            if (!saveResult.success) {
                return NextResponse.json({ error: saveResult.error ?? 'Failed to save skill' }, { status: 500 });
            }
            savedSkill = saveResult.skill;
        }

        if (lastError) {
            // All retries failed â€” skill saved but marked as broken so user can fix it
            return NextResponse.json({
                success:  true,
                skill:    savedSkill,
                attempts,
                warning:  `Skill saved with errors after ${MAX_ATTEMPTS} attempts. Click "Fix" to auto-repair it. Last error: ${lastError}`,
            });
        }

        return NextResponse.json({ success: true, skill: savedSkill, attempts });

    } catch (e: any) {
        return NextResponse.json({ error: e.message ?? 'Generation failed' }, { status: 500 });
    }
}
