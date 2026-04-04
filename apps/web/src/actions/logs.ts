'use server';

import fs from 'fs';
import path from 'path';

import { DATA_DIR } from '@/lib/paths';
const LOGS_DIR = path.join(DATA_DIR, 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'system.jsonl');

function ensureDirs() {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export interface LogEntry {
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
    context?: string;
}

// Append a log entry
export async function addLog(entry: Omit<LogEntry, 'timestamp'>) {
    ensureDirs();
    const log: LogEntry = { timestamp: Date.now(), ...entry };
    fs.appendFileSync(LOG_FILE, JSON.stringify(log) + '\n');
}

// Read recent logs (last N entries)
export async function getRecentLogs(limit: number = 100): Promise<LogEntry[]> {
    ensureDirs();

    if (!fs.existsSync(LOG_FILE)) return [];

    try {
        const content = fs.readFileSync(LOG_FILE, 'utf-8').trim();
        if (!content) return [];

        const lines = content.split('\n');
        const recentLines = lines.slice(-limit);

        return recentLines
            .map(line => {
                try { return JSON.parse(line); }
                catch { return null; }
            })
            .filter(Boolean)
            .reverse(); // Newest first
    } catch {
        return [];
    }
}

// Return the log file path (for display)
export async function getLogFilePath(): Promise<string> {
    return LOG_FILE;
}

// Export all logs as a downloadable string
export async function exportAllLogs(): Promise<string> {
    ensureDirs();
    if (!fs.existsSync(LOG_FILE)) return '';
    return fs.readFileSync(LOG_FILE, 'utf-8');
}

// Clear old logs (keep last N entries)
export async function clearOldLogs(keepLast: number = 500) {
    ensureDirs();

    if (!fs.existsSync(LOG_FILE)) return;

    try {
        const content = fs.readFileSync(LOG_FILE, 'utf-8').trim();
        if (!content) return;

        const lines = content.split('\n');
        if (lines.length <= keepLast) return;

        const kept = lines.slice(-keepLast).join('\n') + '\n';
        fs.writeFileSync(LOG_FILE, kept);
    } catch (e) {
        console.error('Failed to clean logs:', e);
    }
}
