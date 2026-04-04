'use server';

import fs from 'fs';
import path from 'path';

import { DATA_DIR } from '@/lib/paths';
const SECURITY_DIR = path.join(DATA_DIR, 'security');
const BLACKLIST_FILE = path.join(SECURITY_DIR, 'blacklists.json');

export interface SecurityBlacklists {
    domainBlacklistEnabled: boolean;
    buzzwordFilterEnabled: boolean;
    blockedDomains: string[];
    blockedBuzzwords: string[];
}

const DEFAULT_BLOCKED_DOMAINS = [
    // Paste/code sharing sites (prompt injection risk)
    'pastebin.com',
    'hastebin.com',
    'ghostbin.com',
    'rentry.co',
    'paste.ee',
    'controlc.com',
    'justpaste.it',
    // File sharing / malware distribution
    'mega.nz',
    'mediafire.com',
    'zippyshare.com',
    'rapidshare.com',
    'uploaded.to',
    'anonfiles.com',
    'bayfiles.com',
    // Dark web adjacent / onion proxies
    'tor2web.org',
    'onion.to',
    'darkfailllnkf4vf.onion',
    // Suspicious forums / chan boards
    '4chan.org',
    '8chan.moe',
    '8kun.top',
    'endchan.net',
    // Social engineering / phishing patterns
    'bit.ly',
    'tinyurl.com',
    't.co',
    'goo.gl',
    // Known prompt injection demo sites
    'promptinjection.com',
    'jailbreakchat.com',
    // Exploit databases
    'exploit-db.com',
    'exploits.shodan.io',
    // Malware repositories
    'thepiratebay.org',
    '1337x.to',
    'rarbg.to',
];

const DEFAULT_BLOCKED_BUZZWORDS = [
    // Hacking / exploitation
    'hack into',
    'exploit vulnerability',
    'steal password',
    'crack software',
    'bypass security',
    'brute force password',
    'sql injection tutorial',
    'how to ddos',
    'keylogger download',
    'trojan download',
    'malware download',
    // Personal data / doxxing
    "find someone's address",
    'dox someone',
    'find social security number',
    'steal identity',
    'track someone location',
    'find person phone number',
    // Prompt injection attacks
    'ignore previous instructions',
    'ignore all instructions',
    'system prompt reveal',
    'jailbreak prompt',
    'dan prompt',
    'act as jailbreak',
    // Illegal activity
    'buy drugs online',
    'buy weapons online',
    'counterfeit money',
    'make explosives',
    'synthesis drugs',
    // CSAM
    'child inappropriate',
];

function ensureDir() {
    if (!fs.existsSync(SECURITY_DIR)) fs.mkdirSync(SECURITY_DIR, { recursive: true });
}

export async function loadBlacklists(): Promise<SecurityBlacklists> {
    ensureDir();
    if (!fs.existsSync(BLACKLIST_FILE)) {
        const defaults: SecurityBlacklists = {
            domainBlacklistEnabled: true,
            buzzwordFilterEnabled: true,
            blockedDomains: DEFAULT_BLOCKED_DOMAINS,
            blockedBuzzwords: DEFAULT_BLOCKED_BUZZWORDS,
        };
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(defaults, null, 2));
        return defaults;
    }
    try {
        return JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf-8'));
    } catch {
        return {
            domainBlacklistEnabled: true,
            buzzwordFilterEnabled: true,
            blockedDomains: DEFAULT_BLOCKED_DOMAINS,
            blockedBuzzwords: DEFAULT_BLOCKED_BUZZWORDS,
        };
    }
}

export async function saveBlacklists(lists: SecurityBlacklists): Promise<{ success: boolean; error?: string }> {
    ensureDir();
    try {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(lists, null, 2));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function addBlockedDomain(domain: string): Promise<{ success: boolean; error?: string }> {
    const lists = await loadBlacklists();
    const clean = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
    if (!clean) return { success: false, error: 'Invalid domain.' };
    if (!lists.blockedDomains.includes(clean)) {
        lists.blockedDomains.push(clean);
        return saveBlacklists(lists);
    }
    return { success: true };
}

export async function removeBlockedDomain(domain: string): Promise<{ success: boolean }> {
    const lists = await loadBlacklists();
    lists.blockedDomains = lists.blockedDomains.filter(d => d !== domain);
    return saveBlacklists(lists);
}

export async function addBlockedBuzzword(word: string): Promise<{ success: boolean; error?: string }> {
    const lists = await loadBlacklists();
    const clean = word.toLowerCase().trim();
    if (!clean) return { success: false, error: 'Invalid term.' };
    if (!lists.blockedBuzzwords.includes(clean)) {
        lists.blockedBuzzwords.push(clean);
        return saveBlacklists(lists);
    }
    return { success: true };
}

export async function removeBlockedBuzzword(word: string): Promise<{ success: boolean }> {
    const lists = await loadBlacklists();
    lists.blockedBuzzwords = lists.blockedBuzzwords.filter(w => w !== word);
    return saveBlacklists(lists);
}

export async function checkDomainBlocked(url: string): Promise<{ blocked: boolean; domain?: string }> {
    const lists = await loadBlacklists();
    if (!lists.domainBlacklistEnabled) return { blocked: false };
    try {
        const domain = url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
        const blocked = lists.blockedDomains.some(d => domain === d || domain.endsWith('.' + d));
        return { blocked, domain: blocked ? domain : undefined };
    } catch {
        return { blocked: false };
    }
}

export async function checkBuzzwordBlocked(query: string): Promise<{ blocked: boolean; term?: string }> {
    const lists = await loadBlacklists();
    if (!lists.buzzwordFilterEnabled) return { blocked: false };
    const lower = query.toLowerCase();
    const matched = lists.blockedBuzzwords.find(w => lower.includes(w.toLowerCase()));
    return { blocked: !!matched, term: matched };
}
