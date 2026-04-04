export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { getCurrentVersion } from '@/actions/updates';

const execAsync = promisify(exec);
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const extractZip: (source: string, opts: { dir: string }) => Promise<void> = require('extract-zip');

import { DATA_DIR } from '@/lib/paths';
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const TEMP_UPDATE_DIR = path.join(DATA_DIR, 'temp-update');

// Files/folders that must NEVER be deleted during an update
const PROTECTED_NAMES = new Set(['.handsfree-data', 'node_modules', '.next']);

function ensureDirs() {
    [DATA_DIR, BACKUPS_DIR].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
}

/**
 * Recursively copy a directory, skipping protected folders at the root level.
 * Used for backup and restore.
 */
function copyDirRecursive(src: string, dest: string, skipRootNames?: Set<string>) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (skipRootNames?.has(entry.name)) continue;
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Delete all files/folders in dir except protected names.
 */
function clearDirExcept(dir: string, protect: Set<string>) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (protect.has(entry.name)) continue;
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            fs.rmSync(p, { recursive: true, force: true });
        } else {
            fs.unlinkSync(p);
        }
    }
}

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();
    const { zipPath } = await req.json();

    if (!zipPath || !fs.existsSync(zipPath)) {
        return NextResponse.json({ error: 'ZIP file not found: ' + zipPath }, { status: 400 });
    }

    const isWindows = process.platform === 'win32';
    const appRoot = process.cwd(); // e.g. .../Hands Free/windows/apps/web

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            let backupPath = '';

            try {
                ensureDirs();

                // â”€â”€ Step 1: Backup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                send({ step: 1, status: 'running', message: 'Creating backup of current version...' });

                const currentVersion = await getCurrentVersion();
                const timestamp = Date.now();
                const backupName = `v${currentVersion}-${timestamp}`;
                backupPath = path.join(BACKUPS_DIR, backupName);
                fs.mkdirSync(backupPath, { recursive: true });

                // Copy app files (skip .handsfree-data, node_modules, .next)
                copyDirRecursive(appRoot, backupPath, PROTECTED_NAMES);

                // Write metadata
                fs.writeFileSync(path.join(backupPath, '.backup-meta.json'), JSON.stringify({
                    version: currentVersion,
                    createdAt: new Date().toISOString(),
                    backupName,
                }, null, 2));

                send({ step: 1, status: 'done', message: `Backup saved: ${backupName}` });

                // â”€â”€ Step 2: Extract ZIP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                send({ step: 2, status: 'running', message: 'Extracting update ZIP...' });

                if (fs.existsSync(TEMP_UPDATE_DIR)) {
                    fs.rmSync(TEMP_UPDATE_DIR, { recursive: true, force: true });
                }
                fs.mkdirSync(TEMP_UPDATE_DIR, { recursive: true });

                // Pure Node.js extraction â€” no shell, no powershell, no unzip binary required
                await extractZip(zipPath, { dir: TEMP_UPDATE_DIR });

                // Find the root folder inside the ZIP (usually just one)
                const extractedItems = fs.readdirSync(TEMP_UPDATE_DIR);
                let extractedRoot = TEMP_UPDATE_DIR;
                if (extractedItems.length === 1) {
                    const candidate = path.join(TEMP_UPDATE_DIR, extractedItems[0]);
                    if (fs.statSync(candidate).isDirectory()) {
                        extractedRoot = candidate;
                    }
                }

                send({ step: 2, status: 'done', message: 'ZIP extracted successfully' });

                // â”€â”€ Step 3: Install files â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                send({ step: 3, status: 'running', message: 'Installing new files (keeping your data safe)...' });

                // Delete current app files EXCEPT protected folders
                clearDirExcept(appRoot, PROTECTED_NAMES);

                // Copy new files to app root
                copyDirRecursive(extractedRoot, appRoot, PROTECTED_NAMES);

                // Cleanup temp dir
                try { fs.rmSync(TEMP_UPDATE_DIR, { recursive: true, force: true }); } catch { /* ignore */ }

                send({ step: 3, status: 'done', message: 'New files installed' });

                // â”€â”€ Step 4: npm install â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                send({ step: 4, status: 'running', message: 'Running npm install (this may take 1â€“2 minutes)...' });

                await execAsync('npm install --prefer-offline', { cwd: appRoot, timeout: 180_000 });

                send({ step: 4, status: 'done', message: 'Dependencies installed' });

                // â”€â”€ Step 5: Restart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                send({ step: 5, status: 'running', message: 'Preparing restart...' });

                // In the Electron build, restart is handled by closing and reopening the app.
                send({ step: 5, status: 'done', message: 'Update complete. Close and reopen the Hands Free app to restart.' });
                send({ event: 'manual_restart' });
                controller.close();

            } catch (e: any) {
                send({ event: 'error', message: e.message, backupPath });
                // Attempt rollback if backup exists
                if (backupPath && fs.existsSync(backupPath)) {
                    try {
                        send({ event: 'rollback', message: 'Rolling back to backup...' });
                        clearDirExcept(appRoot, PROTECTED_NAMES);
                        copyDirRecursive(backupPath, appRoot, PROTECTED_NAMES);
                        send({ event: 'rollback_done', message: 'Rollback complete. Your previous version has been restored.' });
                    } catch (re: any) {
                        send({ event: 'rollback_failed', message: re.message });
                    }
                }
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
