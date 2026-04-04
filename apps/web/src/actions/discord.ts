'use server';

import * as fs from 'fs';
import * as path from 'path';
import { unstable_noStore as noStore } from 'next/cache';

import { DATA_DIR } from '@/lib/paths';
const DISCORD_FILE = path.join(DATA_DIR, 'integrations', 'discord.json');
const LOCK_FILE = path.join(DATA_DIR, '.discord-bot.lock');

export interface DiscordConfig {
    botToken: string;
    guildId?: string;
    channelId?: string;
    botName?: string;
    botId?: string;
    savedAt?: number;
}

function ensureDirs() {
    const intDir = path.join(DATA_DIR, 'integrations');
    if (!fs.existsSync(intDir)) fs.mkdirSync(intDir, { recursive: true });
}

export async function loadDiscordConfig(): Promise<DiscordConfig | null> {
    noStore(); // Never cache — config file changes when user saves settings
    ensureDirs();
    try {
        if (fs.existsSync(DISCORD_FILE)) {
            return JSON.parse(fs.readFileSync(DISCORD_FILE, 'utf-8'));
        }
    } catch { }
    return null;
}

export async function saveDiscordConfig(config: Omit<DiscordConfig, 'savedAt'>): Promise<{ success: boolean; error?: string }> {
    ensureDirs();
    try {
        const toSave: DiscordConfig = { ...config, savedAt: Date.now() };
        fs.writeFileSync(DISCORD_FILE, JSON.stringify(toSave, null, 2));
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function deleteDiscordConfig(): Promise<{ success: boolean }> {
    try {
        if (fs.existsSync(DISCORD_FILE)) fs.unlinkSync(DISCORD_FILE);
        return { success: true };
    } catch { return { success: true }; }
}

export async function testDiscordBot(token: string): Promise<{ success: boolean; botName?: string; botId?: string; error?: string }> {
    try {
        const resp = await fetch('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': `Bot ${token}` },
        });
        if (!resp.ok) {
            if (resp.status === 401) return { success: false, error: 'Invalid bot token.' };
            return { success: false, error: `Discord API error (${resp.status})` };
        }
        const data = await resp.json();
        return { success: true, botName: data.username, botId: data.id };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getDiscordBotRunning(): Promise<boolean> {
    noStore(); // Never cache — process liveness check must be real-time
    try {
        if (!fs.existsSync(LOCK_FILE)) return false;
        const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').trim(), 10);
        if (isNaN(pid)) return false;
        process.kill(pid, 0);
        return true;
    } catch { return false; }
}
