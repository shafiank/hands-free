'use server';

import { DATA_DIR } from '@/lib/paths';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

// ============================================================
// HANDSFREE COMPUTER USE Ã¢â‚¬â€ Cross-Platform File & Command System
// ============================================================
// Supports Windows, macOS, and Linux.
// Handles both absolute and relative paths.
// Relative paths resolve to the workspace directory.
// Absolute paths work directly on the real file system.
// ============================================================

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Platform Detection Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const IS_WINDOWS = os.platform() === 'win32';
const IS_MAC = os.platform() === 'darwin';
const IS_LINUX = os.platform() === 'linux';
const PLATFORM = IS_WINDOWS ? 'windows' : IS_MAC ? 'macos' : 'linux';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Workspace Directory (fallback for relative paths) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const WORKSPACE_DIR = path.join(DATA_DIR, 'workspace');

function ensureWorkspace() {
    if (!fs.existsSync(WORKSPACE_DIR)) {
        fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ File System Access Mode Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Reads fileSystemAccess from settings.json synchronously (server-side only)
// 'workspace' = sandbox only (default, safe)
// 'full'      = any path on local drive (excl. blocked system paths)

function getFileSystemAccessMode(): 'workspace' | 'full' {
    try {
        const settingsPath = path.join(DATA_DIR, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            if (settings.fileSystemAccess === 'full') return 'full';
        }
    } catch {
        // fallback to safe mode
    }
    return 'workspace';
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Path Resolution Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// In 'workspace' mode: absolute paths are redirected into workspace sandbox
// In 'full' mode:      absolute paths work directly on real FS

function resolvePath(targetPath: string): string {
    const mode = getFileSystemAccessMode();

    // Check if it's an absolute path
    const isAbsolute = path.isAbsolute(targetPath) ||
        // Windows drive letters: C:, D:, etc.
        /^[a-zA-Z]:/.test(targetPath);

    if (isAbsolute) {
        if (mode === 'full') {
            // Full FS access Ã¢â‚¬â€ resolve directly (blocked paths still apply)
            return path.resolve(targetPath);
        } else {
            // Workspace mode Ã¢â‚¬â€ redirect absolute paths into workspace sandbox
            // Strip drive letter on Windows (C:\foo Ã¢â€ â€™ \foo Ã¢â€ â€™ foo)
            const stripped = targetPath.replace(/^[a-zA-Z]:/, '').replace(/\\/g, '/').replace(/^\//, '');
            ensureWorkspace();
            return path.resolve(WORKSPACE_DIR, stripped);
        }
    }

    // Relative path Ã¢â€ â€™ always resolve against workspace
    ensureWorkspace();
    return path.resolve(WORKSPACE_DIR, targetPath);
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Blocked Paths (prevent system damage & data exfiltration) Ã¢â€â‚¬Ã¢â€â‚¬
// These are HARD blocks Ã¢â‚¬â€ cannot be overridden by any LLM instruction.

const BLOCKED_PATHS_WINDOWS = [
    'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)',
    'C:\\ProgramData', 'C:\\System Volume Information',
    // User profile system dirs Ã¢â‚¬â€ protect credentials, browser data, SSH keys
    'AppData\\Roaming\\Microsoft\\Windows\\Recent',
    'AppData\\Roaming\\Microsoft\\Credentials',
    'AppData\\Roaming\\Microsoft\\Protect',
    'AppData\\Local\\Microsoft\\Credentials',
    'AppData\\Roaming\\Microsoft\\Windows\\Start Menu',
    '.ssh', '.gnupg', '.aws', '.azure',
];
const BLOCKED_PATHS_UNIX = [
    '/System', '/usr/bin', '/usr/sbin', '/bin', '/sbin',
    '/etc', '/boot', '/proc', '/sys', '/dev',
    '/private/etc', '/private/var', '/Library/Keychains',
    '/.ssh', '/.gnupg', '/.aws', '/.azure',
    '/root/.ssh', '/root/.gnupg',
];

const BLOCKED_PATHS = IS_WINDOWS ? BLOCKED_PATHS_WINDOWS : BLOCKED_PATHS_UNIX;

function isBlockedPath(resolvedPath: string): boolean {
    const normalizedTarget = resolvedPath.toLowerCase().replace(/\\/g, '/');
    return BLOCKED_PATHS.some(bp => {
        const normalizedBp = bp.toLowerCase().replace(/\\/g, '/');
        return normalizedTarget.includes(normalizedBp);
    });
}

// Also block the Hands Free config directory from destructive operations
function isHandsFreeDataPath(resolvedPath: string): boolean {
    const dataDir = path.join(DATA_DIR).toLowerCase().replace(/\\/g, '/');
    const normalized = resolvedPath.toLowerCase().replace(/\\/g, '/');
    return normalized.startsWith(dataDir);
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ File System Operations Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export async function createFolder(folderPath: string) {
    try {
        const resolved = resolvePath(folderPath);

        if (isBlockedPath(resolved)) {
            return { success: false, error: `Access denied: ${resolved} is a protected system path.` };
        }

        if (fs.existsSync(resolved)) {
            // Idempotent: If it exists, that's a success
            return { success: true, path: resolved, existed: true };
        }

        fs.mkdirSync(resolved, { recursive: true });
        return { success: true, path: resolved };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function listFiles(dirPath: string = '') {
    try {
        const resolved = dirPath === '' ? (ensureWorkspace(), WORKSPACE_DIR) : resolvePath(dirPath);

        if (!fs.existsSync(resolved)) {
            return { success: false, error: `Directory not found: ${resolved}` };
        }

        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
            return { success: false, error: `Not a directory: ${resolved}` };
        }

        const items = fs.readdirSync(resolved, { withFileTypes: true });
        const files = items.map(item => {
            const itemPath = path.join(resolved, item.name);
            let size: number | undefined;
            try {
                if (item.isFile()) {
                    size = fs.statSync(itemPath).size;
                }
            } catch { }
            return {
                name: item.name,
                type: item.isDirectory() ? 'directory' as const : 'file' as const,
                path: itemPath,
                size,
            };
        });

        return { success: true, files, directory: resolved };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function readFile(filePath: string) {
    try {
        const resolved = resolvePath(filePath);

        if (!fs.existsSync(resolved)) {
            return { success: false, error: `File not found: ${resolved}` };
        }

        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
            return { success: false, error: `Path is a directory, not a file: ${resolved}` };
        }

        // Limit file size to 1MB for safety
        if (stat.size > 1024 * 1024) {
            return { success: false, error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Max: 1 MB.` };
        }

        const content = fs.readFileSync(resolved, 'utf-8');
        return { success: true, content, path: resolved, size: stat.size };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function writeFile(filePath: string, content: string) {
    try {
        const resolved = resolvePath(filePath);

        if (isBlockedPath(resolved)) {
            return { success: false, error: `Access denied: ${resolved} is a protected system path.` };
        }

        // Auto-create parent directories
        const dir = path.dirname(resolved);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(resolved, content);
        return { success: true, path: resolved, bytesWritten: Buffer.byteLength(content) };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function copyFile(source: string, destination: string) {
    try {
        const safeSrc = resolvePath(source);
        const safeDest = resolvePath(destination);

        if (isBlockedPath(safeDest)) {
            return { success: false, error: `Access denied: ${safeDest} is a protected system path.` };
        }

        if (!fs.existsSync(safeSrc)) {
            return { success: false, error: `Source file not found: ${safeSrc}` };
        }

        // Auto-create destination parent directories
        const destDir = path.dirname(safeDest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.copyFileSync(safeSrc, safeDest);
        return { success: true, source: safeSrc, destination: safeDest };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteFile(filePath: string) {
    try {
        const resolved = resolvePath(filePath);

        if (isBlockedPath(resolved)) {
            return { success: false, error: `Access denied: ${resolved} is a protected system path.` };
        }

        // Protect Hands Free core config files from autonomous deletion
        if (isHandsFreeDataPath(resolved)) {
            const PROTECTED_HANDSFREE = ['settings.json', 'capabilities.json', 'soul.json', 'human.json'];
            const basename = path.basename(resolved);
            if (PROTECTED_HANDSFREE.includes(basename)) {
                return { success: false, error: `Protected: ${basename} is a Hands Free core configuration file and cannot be deleted.` };
            }
            // Protect the entire sessions directory
            if (resolved.includes(path.sep + 'sessions' + path.sep) || resolved.endsWith(path.sep + 'sessions')) {
                return { success: false, error: `Protected: The sessions directory cannot be deleted autonomously. Use Settings Ã¢â€ â€™ Danger Zone to clear chat history.` };
            }
        }

        if (!fs.existsSync(resolved)) {
            return { success: false, error: `File not found: ${resolved}` };
        }

        if (fs.lstatSync(resolved).isDirectory()) {
            fs.rmSync(resolved, { recursive: true, force: true });
        } else {
            fs.unlinkSync(resolved);
        }

        return { success: true, path: resolved };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Command Execution (Cross-Platform) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Command Security Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Dangerous command patterns Ã¢â‚¬â€ HARD blocked, cannot be overridden by LLM

const COMMAND_BLACKLIST = [
    // Disk/filesystem destruction
    'format', 'del /f /s /q c:\\', 'rmdir /s /q c:\\',
    'rm -rf /', 'rm -rf /*', 'rm -rf ~', 'mkfs', ':(){:|:&};:',
    // System power
    'shutdown', 'reboot', 'init 0', 'init 6', 'halt', 'poweroff',
    // Remote code execution (download and run)
    'curl | bash', 'curl|bash', 'wget | bash', 'wget|bash',
    'curl | sh', 'curl|sh', 'wget | sh', 'wget|sh',
    'invoke-expression', 'iex (', 'iex(iwr', 'downloadstring(',
    'powershell -encodedcommand', 'powershell /encodedcommand',
    // Data exfiltration via command (curl POST/PUT with data flags to external hosts)
    'curl -d ', 'curl --data', 'curl -T ', 'curl --upload',
    'curl -F ', 'curl --form',
    // Windows privilege escalation
    'net user', 'net localgroup administrators',
    'reg delete', 'reg add', 'regedit',
    'sc create', 'sc config',
    'schtasks /create',
    'icacls c:\\ /grant',
    'takeown /f c:\\windows',
    'bcdedit',
    'bootsect',
    // Unix privilege escalation
    'chmod 777 /', 'chmod -r 777',
    'chown -r root /',
    'sudo rm -rf',
    'visudo',
    'passwd root',
    // Credential harvesting
    'mimikatz',
    'procdump',
    'reg save hklm\\sam',
];

export async function executeCommand(command: string, requireConfirmation: boolean = true) {
    // Check blacklist
    const lowerCmd = command.toLowerCase().trim();
    if (COMMAND_BLACKLIST.some(blocked => lowerCmd.includes(blocked.toLowerCase()))) {
        return { success: false, error: 'Command blocked for safety. This command could damage your system.' };
    }

    try {
        // Determine shell based on platform
        const shellOptions: { cwd: string; timeout: number; shell?: string } = {
            cwd: WORKSPACE_DIR,
            timeout: 30000, // 30s timeout
        };

        // Use appropriate shell per platform
        if (IS_WINDOWS) {
            shellOptions.shell = 'powershell.exe';
        } else {
            shellOptions.shell = '/bin/bash';
        }

        ensureWorkspace();

        const { stdout, stderr } = await execAsync(command, shellOptions);

        return {
            success: true,
            stdout: stdout || '',
            stderr: stderr || '',
            platform: PLATFORM,
        };
    } catch (e: any) {
        return {
            success: false,
            error: e.message,
            stdout: e.stdout || '',
            stderr: e.stderr || '',
        };
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Web Scraping Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export async function fetchWebPage(url: string) {
    try {
        // Validate URL
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return { success: false, error: `Invalid protocol: ${parsedUrl.protocol}. Only HTTP/HTTPS allowed.` };
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Hands Free/1.0 (AI Assistant)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(15000), // 15s timeout
        });

        const html = await response.text();
        return { success: true, html, url, status: response.status };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function extractText(url: string) {
    try {
        const result = await fetchWebPage(url);
        if (!result.success || !result.html) {
            return { success: false, error: result.error || 'Failed to fetch page' };
        }

        // Remove script/style tags first, then strip remaining HTML
        const cleaned = result.html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return { success: true, text: cleaned, url };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Workspace & System Info Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export async function getWorkspaceInfo() {
    ensureWorkspace();

    try {
        const files = await listFiles('');

        return {
            success: true,
            path: WORKSPACE_DIR,
            files: files.success ? files.files : [],
            platform: PLATFORM,
            homeDir: os.homedir(),
            hostname: os.hostname(),
            nodeVersion: process.version,
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getSystemInfo() {
    return {
        platform: PLATFORM,
        arch: os.arch(),
        hostname: os.hostname(),
        homeDir: os.homedir(),
        tmpDir: os.tmpdir(),
        totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
        freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
        cpus: os.cpus().length,
        nodeVersion: process.version,
        uptime: `${(os.uptime() / 3600).toFixed(1)} hours`,
    };
}
