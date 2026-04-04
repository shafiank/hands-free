'use server';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { DATA_DIR } from '@/lib/paths';
const WEBHOOK_FILE = path.join(DATA_DIR, 'integrations', 'webhook.json');

export interface WebhookConfig {
    enabled: boolean;
    secret: string;
    savedAt?: number;
}

function ensureDirs() {
    const intDir = path.join(DATA_DIR, 'integrations');
    if (!fs.existsSync(intDir)) fs.mkdirSync(intDir, { recursive: true });
}

export async function loadWebhookConfig(): Promise<WebhookConfig | null> {
    ensureDirs();
    try {
        if (fs.existsSync(WEBHOOK_FILE)) {
            return JSON.parse(fs.readFileSync(WEBHOOK_FILE, 'utf-8'));
        }
    } catch { }
    return null;
}

export async function saveWebhookConfig(config: Omit<WebhookConfig, 'savedAt'>): Promise<{ success: boolean; error?: string }> {
    ensureDirs();
    try {
        const toSave: WebhookConfig = { ...config, savedAt: Date.now() };
        fs.writeFileSync(WEBHOOK_FILE, JSON.stringify(toSave, null, 2));
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function enableWebhook(): Promise<{ success: boolean; secret?: string; error?: string }> {
    try {
        const existing = await loadWebhookConfig();
        const secret = existing?.secret || crypto.randomBytes(32).toString('hex');
        const res = await saveWebhookConfig({ enabled: true, secret });
        return { success: res.success, secret, error: res.error };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function disableWebhook(): Promise<{ success: boolean }> {
    try {
        const existing = await loadWebhookConfig();
        if (existing) await saveWebhookConfig({ ...existing, enabled: false });
        return { success: true };
    } catch { return { success: true }; }
}

export async function regenerateWebhookSecret(): Promise<{ success: boolean; secret?: string }> {
    try {
        const existing = await loadWebhookConfig();
        const newSecret = crypto.randomBytes(32).toString('hex');
        await saveWebhookConfig({ enabled: existing?.enabled ?? true, secret: newSecret });
        return { success: true, secret: newSecret };
    } catch { return { success: false }; }
}
