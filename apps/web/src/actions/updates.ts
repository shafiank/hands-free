'use server';

import fs from 'fs';
import path from 'path';
import os from 'os';

import { DATA_DIR } from '@/lib/paths';
const UPDATE_SETTINGS_FILE = path.join(DATA_DIR, 'update-settings.json');
const UPDATE_CACHE_FILE = path.join(DATA_DIR, 'update-cache.json');

// HARDCODED â€” never user-configurable to prevent pointing to malicious server
const UPDATE_CHECK_URL = 'https://handsfree.app/updates/latest.json';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface UpdateInfo {
    version: string;
    date: string;
    changelog: string;
    checksum_windows: string;
    checksum_macos: string;
    windows: string;
    macos: string;
    min_version?: string;
    previous?: Array<{
        version: string;
        date?: string;
        windows: string;
        macos: string;
    }>;
}

export interface UpdateSettings {
    autoCheckOnStartup: boolean;
}

export interface UpdateCheckResult {
    success: boolean;
    currentVersion: string;
    platform: 'windows' | 'macos';
    updateAvailable: boolean;
    updateInfo?: UpdateInfo;
    lastChecked?: string;
    error?: string;
    fromCache?: boolean;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ensureDirs() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** Semantic version comparison: returns positive if a > b, negative if a < b, 0 if equal */
function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(n => parseInt(n, 10) || 0);
    const pb = b.split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

// â”€â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCurrentVersion(): Promise<string> {
    try {
        const pkgPath = path.join(process.cwd(), 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return pkg.version || '3.5.0';
    } catch {
        return '3.5.0';
    }
}

export async function getCurrentPlatform(): Promise<'windows' | 'macos'> {
    return process.platform === 'darwin' ? 'macos' : 'windows';
}

export async function loadUpdateSettings(): Promise<UpdateSettings> {
    try {
        if (fs.existsSync(UPDATE_SETTINGS_FILE)) {
            const raw = JSON.parse(fs.readFileSync(UPDATE_SETTINGS_FILE, 'utf-8'));
            return { autoCheckOnStartup: raw.autoCheckOnStartup !== false }; // default true
        }
    } catch { /* ignore */ }
    return { autoCheckOnStartup: true };
}

export async function saveUpdateSettings(settings: UpdateSettings): Promise<void> {
    ensureDirs();
    fs.writeFileSync(UPDATE_SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

/** Silently check for updates â€” returns null on network failure (for dashboard banner) */
export async function silentCheckForUpdates(): Promise<UpdateCheckResult | null> {
    try {
        return await checkForUpdates();
    } catch {
        return null;
    }
}

/** Full update check with caching and fallback */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = await getCurrentVersion();
    const platform = await getCurrentPlatform();
    const lastChecked = new Date().toISOString();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        let response: Response;
        try {
            response = await fetch(UPDATE_CHECK_URL, {
                signal: controller.signal,
                headers: { 'User-Agent': `Hands Free/${currentVersion}` },
                cache: 'no-store',
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const updateInfo: UpdateInfo = await response.json();

        // Cache the result for offline fallback
        ensureDirs();
        try {
            fs.writeFileSync(UPDATE_CACHE_FILE, JSON.stringify({ updateInfo, lastChecked }, null, 2));
        } catch { /* non-fatal */ }

        const updateAvailable = compareVersions(updateInfo.version, currentVersion) > 0;
        return { success: true, currentVersion, platform, updateAvailable, updateInfo, lastChecked };

    } catch (e: any) {
        // Return cached result if available (offline mode)
        try {
            if (fs.existsSync(UPDATE_CACHE_FILE)) {
                const cached = JSON.parse(fs.readFileSync(UPDATE_CACHE_FILE, 'utf-8'));
                const updateAvailable = compareVersions(cached.updateInfo.version, currentVersion) > 0;
                return {
                    success: true,
                    currentVersion,
                    platform,
                    updateAvailable,
                    updateInfo: cached.updateInfo,
                    lastChecked: cached.lastChecked,
                    fromCache: true,
                    error: 'Using cached data (offline)',
                };
            }
        } catch { /* ignore */ }

        return {
            success: false,
            currentVersion,
            platform,
            updateAvailable: false,
            error: e.name === 'AbortError' ? 'Request timed out' : e.message,
        };
    }
}

/** Returns the user's Downloads folder path (falls back to Desktop, then home) */
export async function getDownloadsFolder(): Promise<string> {
    const home = os.homedir();
    const candidates = [
        path.join(home, 'Downloads'),
        path.join(home, 'Desktop'),
        home,
    ];
    for (const dir of candidates) {
        if (fs.existsSync(dir)) return dir;
    }
    return home;
}

// â”€â”€â”€ Install Later â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const UPDATE_PENDING_FILE = path.join(DATA_DIR, 'update-pending.json');

export async function saveInstallLater(zipPath: string, version: string): Promise<void> {
    ensureDirs();
    fs.writeFileSync(UPDATE_PENDING_FILE, JSON.stringify({ zipPath, version, savedAt: new Date().toISOString() }, null, 2));
}

export async function getInstallLater(): Promise<{ zipPath: string; version: string; savedAt: string } | null> {
    try {
        if (!fs.existsSync(UPDATE_PENDING_FILE)) return null;
        const data = JSON.parse(fs.readFileSync(UPDATE_PENDING_FILE, 'utf-8'));
        if (!fs.existsSync(data.zipPath)) {
            fs.unlinkSync(UPDATE_PENDING_FILE);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

export async function clearInstallLater(): Promise<void> {
    try {
        if (fs.existsSync(UPDATE_PENDING_FILE)) fs.unlinkSync(UPDATE_PENDING_FILE);
    } catch { /* ignore */ }
}

// â”€â”€â”€ Backups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface BackupEntry {
    name: string;
    path: string;
    version: string;
    createdAt: string;
}

const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

export async function listBackups(): Promise<BackupEntry[]> {
    try {
        if (!fs.existsSync(BACKUPS_DIR)) return [];
        return fs.readdirSync(BACKUPS_DIR, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => {
                const backupPath = path.join(BACKUPS_DIR, e.name);
                const metaPath = path.join(backupPath, '.backup-meta.json');
                let version = 'unknown';
                let createdAt = '';
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                    version = meta.version || 'unknown';
                    createdAt = meta.createdAt || '';
                } catch {
                    const match = e.name.match(/^v?(.+?)-\d+$/);
                    if (match) version = match[1];
                }
                return { name: e.name, path: backupPath, version, createdAt };
            })
            .sort((a, b) => b.name.localeCompare(a.name));
    } catch {
        return [];
    }
}
