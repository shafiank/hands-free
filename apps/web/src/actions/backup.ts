'use server';

import fs from 'fs';
import path from 'path';
import os from 'os';
// archiver is a direct dependency in package.json (v5.3.2) â€” guaranteed in standalone bundle.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const archiver: any = require('archiver');
// extract-zip is a direct dependency in package.json (v2.0.1) â€” pure Node.js, no shell required.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const extractZip: (source: string, opts: { dir: string }) => Promise<void> = require('extract-zip');

import { DATA_DIR } from '@/lib/paths';

export interface ExportResult {
    success: boolean;
    error?: string;
    filename?: string;
    sizeBytes?: number;
    /** Full server-side path to the created ZIP â€” used by the Electron IPC
     *  copy-file handler so the main process can write it to a user-chosen
     *  location without streaming binary data through IPC. */
    zipPath?: string;
}

export interface ImportResult {
    success: boolean;
    error?: string;
    message?: string;
}

/**
 * Create a zip of .handsfree-data (excluding workspace/ to keep size small).
 *
 * Uses the `archiver` npm package (pure Node.js) instead of OS shell commands
 * so it works reliably inside the Electron standalone build where the process
 * PATH may not include PowerShell / zip utilities.
 *
 * Returns the zip filename AND full zipPath so the caller can:
 *   - Browser: trigger a download via /api/export-backup
 *   - Electron: copy directly to the path chosen by dialog.showSaveDialog
 */
export async function exportData(): Promise<ExportResult> {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            console.error('[Hands Free Export] DATA_DIR does not exist:', DATA_DIR);
            return { success: false, error: '.handsfree-data folder not found. Nothing to export.' };
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `handsfree-backup-${timestamp}.zip`;
        const zipPath = path.join(DATA_DIR, filename);

        console.log('[Hands Free Export] DATA_DIR     :', DATA_DIR);
        console.log('[Hands Free Export] ZIP path     :', zipPath);

        // Top-level directories to skip entirely
        const EXCLUDE_TOP = new Set(['workspace', 'whatsapp', '_exports']);
        // Within 'integrations', skip all whatsapp-related entries
        const WHATSAPP_PREFIX = 'whatsapp';

        await new Promise<void>((resolve, reject) => {
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 6 } });

            output.on('close', () => {
                console.log(`[Hands Free Export] ZIP closed â€” ${archive.pointer()} bytes written`);
                resolve();
            });

            output.on('error', (err) => {
                console.error('[Hands Free Export] Output stream error:', err);
                reject(err);
            });

            archive.on('error', (err: Error) => {
                console.error('[Hands Free Export] Archiver error:', err);
                reject(err);
            });

            archive.on('warning', (warn: { code: string; message: string }) => {
                // ENOENT warnings are expected for locked/missing files â€” log but continue
                console.warn('[Hands Free Export] Archiver warning:', warn.code, warn.message);
            });

            archive.pipe(output);

            const entries = fs.readdirSync(DATA_DIR);
            for (const entry of entries) {
                // Skip excluded top-level dirs and any zip files (including the one we're writing)
                if (EXCLUDE_TOP.has(entry) || entry.endsWith('.zip')) continue;

                const entryPath = path.join(DATA_DIR, entry);
                let stat: fs.Stats;
                try { stat = fs.statSync(entryPath); } catch { continue; }

                if (stat.isDirectory()) {
                    if (entry === 'integrations') {
                        // Include integrations/ but skip all whatsapp-* entries inside
                        const subs = fs.readdirSync(entryPath);
                        for (const sub of subs) {
                            if (sub.startsWith(WHATSAPP_PREFIX)) continue;
                            const subPath = path.join(entryPath, sub);
                            let subStat: fs.Stats;
                            try { subStat = fs.statSync(subPath); } catch { continue; }
                            if (subStat.isDirectory()) {
                                archive.directory(subPath, `integrations/${sub}`);
                            } else {
                                archive.file(subPath, { name: `integrations/${sub}` });
                            }
                        }
                    } else {
                        archive.directory(entryPath, entry);
                    }
                } else {
                    archive.file(entryPath, { name: entry });
                }
            }

            archive.finalize();
        });

        if (!fs.existsSync(zipPath)) {
            console.error('[Hands Free Export] ZIP was not created at:', zipPath);
            return { success: false, error: 'ZIP file was not created. Check disk space and permissions.' };
        }

        const stat = fs.statSync(zipPath);
        console.log('[Hands Free Export] Success â€”', stat.size, 'bytes at', zipPath);
        return { success: true, filename, sizeBytes: stat.size, zipPath };

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[Hands Free Export] FAILED:', e);
        return { success: false, error: msg || 'Unknown error during export.' };
    }
}

/**
 * Import from a zip file (provided as base64 data URL or raw base64).
 * Extracts to DATA_DIR using pure Node.js â€” no shell commands, no python3,
 * no powershell. Works identically on Windows, macOS, and Linux.
 */
export async function importData(base64Input: string): Promise<ImportResult> {
    const tempZip = path.join(os.tmpdir(), `handsfree-import-${Date.now()}.zip`);
    const tempExtract = path.join(os.tmpdir(), `handsfree-extract-${Date.now()}`);

    try {
        // Strip data URL prefix if present (e.g. "data:application/zip;base64,...")
        const base64 = base64Input.includes(',') ? base64Input.split(',')[1] : base64Input;

        console.log('[Hands Free Import] Writing zip to temp:', tempZip);
        fs.writeFileSync(tempZip, Buffer.from(base64, 'base64'));
        fs.mkdirSync(tempExtract, { recursive: true });

        // Pure Node.js extraction via extract-zip.
        // extract-zip automatically normalises Windows backslash paths (chr 92 â†’ /)
        // so ZIPs built by archiver on any OS are handled correctly.
        console.log('[Hands Free Import] Extracting to:', tempExtract);
        await extractZip(tempZip, { dir: tempExtract });

        // Find the actual data root (may be nested inside a .handsfree-data subfolder
        // or a single top-level directory depending on how the zip was created).
        let sourceDir = tempExtract;
        const extractedEntries = fs.readdirSync(tempExtract);
        if (extractedEntries.includes('.handsfree-data')) {
            sourceDir = path.join(tempExtract, '.handsfree-data');
        } else if (extractedEntries.length === 1) {
            const sub = path.join(tempExtract, extractedEntries[0]);
            if (fs.statSync(sub).isDirectory()) sourceDir = sub;
        }

        console.log('[Hands Free Import] Source directory resolved to:', sourceDir);

        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        // Copy each item into DATA_DIR, preserving the workspace and whatsapp session.
        // Uses fs.cpSync (Node 16.7+) for recursive directory copies â€” pure JS, no shell.
        const PRESERVE = new Set(['workspace', 'whatsapp']);
        const items = fs.readdirSync(sourceDir);
        let copiedCount = 0;

        for (const item of items) {
            if (PRESERVE.has(item) || item.endsWith('.zip')) continue;
            const src = path.join(sourceDir, item);
            const dst = path.join(DATA_DIR, item);
            const stat = fs.statSync(src);

            if (stat.isDirectory()) {
                // Recursively copy directory â€” pure Node.js, OS-agnostic
                fs.cpSync(src, dst, { recursive: true, force: true });
            } else {
                fs.copyFileSync(src, dst);
            }
            copiedCount++;
            console.log('[Hands Free Import] Copied:', item);
        }

        return {
            success: true,
            message: `Import successful! ${copiedCount} items restored. Your Workspace was preserved.`,
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[Hands Free Import] FAILED:', e);
        return { success: false, error: msg || 'Unknown error during import.' };
    } finally {
        // Always clean up temp files â€” even if extraction or copy failed
        try { fs.rmSync(tempZip, { force: true }); } catch { }
        try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch { }
    }
}

/**
 * Get the path to the most recent export zip (for the /api/export-backup download route).
 */
export async function getLatestExportPath(): Promise<string | null> {
    try {
        if (!fs.existsSync(DATA_DIR)) return null;
        const zips = fs.readdirSync(DATA_DIR)
            .filter(f => f.startsWith('handsfree-backup-') && f.endsWith('.zip'))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(DATA_DIR, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);
        return zips.length > 0 ? path.join(DATA_DIR, zips[0].name) : null;
    } catch {
        return null;
    }
}

/**
 * Delete all export zip files from .handsfree-data to keep it clean.
 */
export async function cleanupExports(): Promise<void> {
    try {
        if (!fs.existsSync(DATA_DIR)) return;
        const zips = fs.readdirSync(DATA_DIR)
            .filter(f => f.startsWith('handsfree-backup-') && f.endsWith('.zip'));
        for (const z of zips) {
            try { fs.unlinkSync(path.join(DATA_DIR, z)); } catch { }
        }
    } catch { }
}
