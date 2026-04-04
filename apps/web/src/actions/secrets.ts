'use server';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { DATA_DIR } from '@/lib/paths';
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');
const KEY_FILE = path.join(DATA_DIR, '.encryption-key');

// Ensure encryption key exists
function getOrCreateKey(): string {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(KEY_FILE)) {
        return fs.readFileSync(KEY_FILE, 'utf-8');
    }

    // Generate new key
    const key = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(KEY_FILE, key, { mode: 0o600 }); // Owner read/write only
    return key;
}

// Simple encryption (for local storage security)
function encrypt(text: string): string {
    const key = getOrCreateKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
    const key = getOrCreateKey();
    const parts = text.split(':');

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error('Invalid encrypted format: expected "iv:ciphertext"');
    }

    const iv = Buffer.from(parts[0], 'hex');
    if (iv.length !== 16) {
        throw new Error('Invalid IV length in encrypted data');
    }

    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

export interface SecretStore {
    [key: string]: string;
}

// Load secrets (decrypted)
export async function loadSecrets(): Promise<SecretStore> {
    if (!fs.existsSync(SECRETS_FILE)) {
        return {};
    }

    try {
        const encrypted = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
        const decrypted: SecretStore = {};

        for (const [key, value] of Object.entries(encrypted)) {
            decrypted[key] = decrypt(value as string);
        }

        return decrypted;
    } catch (e) {
        console.error('Failed to load secrets:', e);
        return {};
    }
}

// Save secrets (encrypted)
export async function saveSecrets(secrets: SecretStore) {
    const encrypted: SecretStore = {};

    for (const [key, value] of Object.entries(secrets)) {
        encrypted[key] = encrypt(value);
    }

    fs.writeFileSync(SECRETS_FILE, JSON.stringify(encrypted, null, 2), { mode: 0o600 });
    return { success: true };
}

// Set individual secret
export async function setSecret(key: string, value: string) {
    try {
        const secrets = await loadSecrets();
        secrets[key] = value;
        await saveSecrets(secrets);
        return { success: true };
    } catch (e: any) {
        console.error(`Failed to set secret '${key}':`, e);
        return { success: false, error: e.message };
    }
}

// Get individual secret
export async function getSecret(key: string): Promise<string | undefined> {
    const secrets = await loadSecrets();
    return secrets[key];
}

// Delete secret
export async function deleteSecret(key: string) {
    const secrets = await loadSecrets();
    delete secrets[key];
    await saveSecrets(secrets);
    return { success: true };
}

// List secret keys (not values!)
export async function listSecretKeys(): Promise<string[]> {
    const secrets = await loadSecrets();
    return Object.keys(secrets);
}

// Common secret categories (internal — not exported from 'use server' file)
const SECRET_CATEGORIES = {
    API_KEYS: 'api_keys',
    DATABASE: 'database',
    EMAIL: 'email',
    MESSENGER: 'messenger',
    CUSTOM: 'custom'
};

// Predefined secret templates (internal — not exported from 'use server' file)
const SECRET_TEMPLATES = {
    'openai_api_key': { category: SECRET_CATEGORIES.API_KEYS, label: 'OpenAI API Key' },
    'anthropic_api_key': { category: SECRET_CATEGORIES.API_KEYS, label: 'Anthropic API Key' },
    'google_api_key': { category: SECRET_CATEGORIES.API_KEYS, label: 'Google API Key' },
    'telegram_bot_token': { category: SECRET_CATEGORIES.MESSENGER, label: 'Telegram Bot Token' },
    'gmail_app_password': { category: SECRET_CATEGORIES.EMAIL, label: 'Gmail App Password' },
    'smtp_password': { category: SECRET_CATEGORIES.EMAIL, label: 'SMTP Password' },
};
