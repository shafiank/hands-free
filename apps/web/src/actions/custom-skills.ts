'use server';

/**
 * Hands Free â€” Custom Skills Server Actions
 *
 * Custom skills are user-provided or AI-generated .js files stored in
 * DATA_DIR/skills/. A manifest file (DATA_DIR/skills/manifest.json) tracks
 * which skills are active and caches metadata so the sidebar and UI don't
 * need to require() every file on every render.
 */

import fs   from 'fs';
import path from 'path';
import { SKILLS_DIR, SKILLS_MANIFEST } from '@/lib/paths';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type SkillCategory =
    | 'productivity'
    | 'communication'
    | 'automation'
    | 'creative'
    | 'security'
    | 'other';

export interface CustomSkillMeta {
    id:          string;
    name:        string;
    description: string;
    category:    SkillCategory;
    icon:        string;
    version:     string;
    author:      string;
    hasUI:       boolean;
    menuName?:   string;
    menuRoute?:  string;
    enabled:     boolean;
    file:        string;        // filename relative to SKILLS_DIR
    installedAt: number;
    /** 'active' = working, 'error' = validation failed, 'generating' = in progress */
    status?:     'active' | 'error' | 'generating';
    /** Last validation error message (present when status === 'error') */
    lastError?:  string;
    /**
     * Backup copy of the skill code stored in the manifest.
     * Used to recover the file if Windows Defender quarantines it or if the
     * .js file is missing for any other reason. Written on every saveCustomSkill
     * and updateCustomSkill call.
     */
    _codeBackup?: string;
}

interface ManifestFile {
    skills: Record<string, CustomSkillMeta>;
}

// â”€â”€â”€ Internal helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ensureSkillsDir() {
    if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

function readManifest(): ManifestFile {
    ensureSkillsDir();
    try {
        if (fs.existsSync(SKILLS_MANIFEST)) {
            return JSON.parse(fs.readFileSync(SKILLS_MANIFEST, 'utf8')) as ManifestFile;
        }
    } catch { /* corrupt file â€” start fresh */ }
    return { skills: {} };
}

function writeManifest(m: ManifestFile): void {
    ensureSkillsDir();
    fs.writeFileSync(SKILLS_MANIFEST, JSON.stringify(m, null, 2), 'utf8');
}

/** Generate a safe kebab-case ID from a display name */
function toId(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'custom-skill';
}

/** Ensure the generated ID is unique in the manifest */
function uniqueId(base: string, existing: Set<string>): string {
    if (!existing.has(base)) return base;
    let i = 2;
    while (existing.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
}

// â”€â”€â”€ Public Server Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** List all custom skills from the manifest. */
export async function listCustomSkills(): Promise<CustomSkillMeta[]> {
    const manifest = readManifest();
    return Object.values(manifest.skills).sort((a, b) => b.installedAt - a.installedAt);
}

/** Toggle a skill's enabled state. Returns the updated metadata. */
export async function toggleCustomSkill(
    id: string,
    enabled: boolean,
): Promise<{ success: boolean; skill?: CustomSkillMeta; error?: string }> {
    try {
        const manifest = readManifest();
        if (!manifest.skills[id]) return { success: false, error: `Skill "${id}" not found.` };
        manifest.skills[id].enabled = enabled;
        writeManifest(manifest);
        return { success: true, skill: manifest.skills[id] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/** Delete a custom skill â€” removes from manifest and deletes the file. */
export async function deleteCustomSkill(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const manifest = readManifest();
        const meta = manifest.skills[id];
        if (!meta) return { success: false, error: `Skill "${id}" not found.` };

        // Delete the skill file if it exists
        const filePath = path.join(SKILLS_DIR, meta.file);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        delete manifest.skills[id];
        writeManifest(manifest);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/** Save a raw skill code string to disk and register it in the manifest. */
export async function saveCustomSkill(input: {
    code:        string;
    meta: Omit<CustomSkillMeta, 'id' | 'file' | 'installedAt' | 'enabled'>;
}): Promise<{ success: boolean; skill?: CustomSkillMeta; error?: string }> {
    try {
        ensureSkillsDir();
        const manifest = readManifest();
        const existingIds = new Set(Object.keys(manifest.skills));

        const baseId = toId(input.meta.name);
        const id     = uniqueId(baseId, existingIds);
        const file   = `${id}.js`;

        fs.writeFileSync(path.join(SKILLS_DIR, file), input.code, 'utf8');

        const meta: CustomSkillMeta = {
            ...input.meta,
            id,
            file,
            enabled:      true,
            installedAt:  Date.now(),
            status:       input.meta.status ?? 'active',
            _codeBackup:  input.code,   // backup in manifest against AV quarantine
        };
        manifest.skills[id] = meta;
        writeManifest(manifest);

        return { success: true, skill: meta };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/** Return metadata for all enabled skills that export hasUI=true (for sidebar). */
export async function getActiveCustomSkillsWithUI(): Promise<CustomSkillMeta[]> {
    const manifest = readManifest();
    return Object.values(manifest.skills).filter(s => s.enabled && s.hasUI);
}

/** Return a single skill's metadata by ID, or null if not found. */
export async function getCustomSkillById(
    id: string,
): Promise<CustomSkillMeta | null> {
    const manifest = readManifest();
    return manifest.skills[id] ?? null;
}

/**
 * Patch a skill's metadata fields and optionally overwrite its code file.
 * Designed for the autonomous Fix pipeline: update status/lastError + optionally
 * write new generated code in one atomic operation.
 */
export async function updateCustomSkill(
    id: string,
    updates: Partial<Pick<CustomSkillMeta,
        'status' | 'lastError' | 'enabled' | 'description' |
        'name' | 'icon' | 'category' | 'hasUI' | 'menuName' | 'menuRoute' | 'version' | 'author'
    >>,
    newCode?: string,
): Promise<{ success: boolean; skill?: CustomSkillMeta; error?: string }> {
    try {
        const manifest = readManifest();
        const skill = manifest.skills[id];
        if (!skill) return { success: false, error: `Skill "${id}" not found.` };

        const patchedUpdates: Partial<CustomSkillMeta> = { ...updates };

        if (newCode !== undefined) {
            const filePath = path.join(SKILLS_DIR, skill.file);
            fs.writeFileSync(filePath, newCode, 'utf8');
            patchedUpdates._codeBackup = newCode;  // keep manifest backup in sync
        }

        // Remove lastError when transitioning to 'active'
        if (patchedUpdates.status === 'active' && !patchedUpdates.lastError) {
            delete manifest.skills[id].lastError;
        }
        Object.assign(manifest.skills[id], patchedUpdates);
        writeManifest(manifest);

        return { success: true, skill: manifest.skills[id] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/** Read a skill's source code. Auto-restores from manifest backup if disk file is missing. */
export async function getCustomSkillSource(
    id: string,
): Promise<{ success: boolean; code?: string; restored?: boolean; error?: string }> {
    try {
        const manifest = readManifest();
        const meta = manifest.skills[id];
        if (!meta) return { success: false, error: `Skill "${id}" not found.` };

        const filePath = path.join(SKILLS_DIR, meta.file);

        if (fs.existsSync(filePath)) {
            return { success: true, code: fs.readFileSync(filePath, 'utf8') };
        }

        // File missing â€” attempt recovery from manifest backup (e.g., AV quarantine)
        if (meta._codeBackup) {
            try {
                fs.writeFileSync(filePath, meta._codeBackup, 'utf8');
                return { success: true, code: meta._codeBackup, restored: true };
            } catch { /* restore failed â€” fall through to error */ }
        }

        return { success: false, error: 'Skill file missing from disk and no backup available.' };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Ensure the skill's .js file exists on disk.
 * If it was quarantined/deleted, restore it from the manifest backup.
 * Returns the file path on success.
 */
export async function ensureSkillFileExists(
    id: string,
): Promise<{ success: boolean; filePath?: string; restored?: boolean; error?: string }> {
    try {
        const manifest = readManifest();
        const meta = manifest.skills[id];
        if (!meta) return { success: false, error: `Skill "${id}" not found.` };

        const filePath = path.join(SKILLS_DIR, meta.file);
        if (fs.existsSync(filePath)) return { success: true, filePath };

        if (meta._codeBackup) {
            fs.writeFileSync(filePath, meta._codeBackup, 'utf8');
            return { success: true, filePath, restored: true };
        }

        return { success: false, error: `Skill file "${meta.file}" is missing and has no backup.` };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ Built-in skills seed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Install or replace a built-in skill.
 * Used by the "Install Sample Skills" feature on the Custom Skills page.
 * If the skill already exists, its code is replaced and status set to 'active'.
 */
export async function installBuiltinSkill(input: {
    id:   string;
    code: string;
    meta: Omit<CustomSkillMeta, 'id' | 'file' | 'installedAt' | 'enabled'>;
}): Promise<{ success: boolean; skill?: CustomSkillMeta; error?: string }> {
    try {
        ensureSkillsDir();
        const manifest = readManifest();

        const id   = input.id;
        const file = `${id}.js`;
        const filePath = path.join(SKILLS_DIR, file);

        // Write skill file
        fs.writeFileSync(filePath, input.code, 'utf8');

        if (manifest.skills[id]) {
            // Update existing
            Object.assign(manifest.skills[id], {
                ...input.meta,
                file,
                status:      'active',
                lastError:   undefined,
                _codeBackup: input.code,
            });
        } else {
            // Create new
            manifest.skills[id] = {
                ...input.meta,
                id,
                file,
                enabled:     true,
                installedAt: Date.now(),
                status:      'active',
                _codeBackup: input.code,
            };
        }

        writeManifest(manifest);
        return { success: true, skill: manifest.skills[id] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
