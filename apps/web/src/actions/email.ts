'use server';

import fs from 'fs';
import path from 'path';

// â”€â”€â”€ Email Integration â€” IMAP / SMTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Stores config in .handsfree-data/integrations/email.json
// Uses nodemailer for SMTP and imap-simple for IMAP.

import { DATA_DIR } from '@/lib/paths';
const EMAIL_CONFIG_FILE = path.join(DATA_DIR, 'integrations', 'email.json');

function ensureDir() {
    const dir = path.dirname(EMAIL_CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export interface EmailConfig {
    // IMAP settings
    imapHost: string;
    imapPort: number;
    imapTls: boolean;
    // SMTP settings
    smtpHost: string;
    smtpPort: number;
    smtpTls: boolean; // true = SSL/TLS, false = STARTTLS
    // Auth (shared username/password for IMAP+SMTP)
    username: string;      // email address / login
    password: string;
    // Sender info
    displayName: string;
    signature: string;
    enabled: boolean;
    savedAt: number;
    // Polling
    pollInterval: number;  // minutes; 0 = manual only. Default: 15
    // Trusted address book â€” AI may only send to these addresses.
    // If empty, no restriction is applied (backward compat).
    // The account's own username is always implicitly trusted.
    trustedAddresses?: string[];
}

export interface EmailInboxState {
    lastCheckedAt: number;
    pendingNotifications: Array<{ from: string; subject: string; date: string }>;
    seenUids: string[]; // UIDs already notified â€” never re-notify even after dismiss
}

export interface EmailMessage {
    uid: string;
    from: string;
    to: string;
    subject: string;
    date: string;
    body: string;       // plain text snippet
    isRead: boolean;
    folder: string;
}

// â”€â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function loadEmailConfig(): Promise<EmailConfig | null> {
    ensureDir();
    if (!fs.existsSync(EMAIL_CONFIG_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(EMAIL_CONFIG_FILE, 'utf-8'));
    } catch { return null; }
}

export async function saveEmailConfig(config: Omit<EmailConfig, 'savedAt'>): Promise<{ success: boolean; error?: string }> {
    ensureDir();
    try {
        const full: EmailConfig = { ...config, savedAt: Date.now() };
        fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(full, null, 2));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteEmailConfig(): Promise<{ success: boolean }> {
    if (fs.existsSync(EMAIL_CONFIG_FILE)) fs.unlinkSync(EMAIL_CONFIG_FILE);
    return { success: true };
}

// â”€â”€â”€ Multi-Account Support â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Stores up to 5 email accounts in email-accounts.json.
// Backward-compatible: legacy email.json is auto-migrated as "Default" account.

export type EmailPermission = 'read-only' | 'write-only' | 'read-write';

export interface EmailAccount extends EmailConfig {
    id: string;                    // unique identifier (e.g. 'account_abc123')
    alias: string;                 // friendly label e.g. "Work Gmail", "Personal"
    permissions: EmailPermission;  // what Hands Free is allowed to do with this account
}

const ACCOUNTS_CONFIG_FILE = path.join(DATA_DIR, 'integrations', 'email-accounts.json');

export async function loadEmailAccounts(): Promise<EmailAccount[]> {
    ensureDir();
    // Try the new multi-account file first
    if (fs.existsSync(ACCOUNTS_CONFIG_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(ACCOUNTS_CONFIG_FILE, 'utf-8'));
            if (Array.isArray(data) && data.length > 0) return data as EmailAccount[];
        } catch { /* fall through */ }
    }
    // Migrate legacy single-account email.json if it exists
    if (fs.existsSync(EMAIL_CONFIG_FILE)) {
        try {
            const cfg = JSON.parse(fs.readFileSync(EMAIL_CONFIG_FILE, 'utf-8')) as EmailConfig;
            if (cfg?.username) {
                const migrated: EmailAccount = {
                    ...cfg,
                    id: 'account_legacy',
                    alias: 'Default',
                    permissions: 'read-write',
                };
                return [migrated];
            }
        } catch { /* fall through */ }
    }
    return [];
}

export async function saveEmailAccounts(accounts: EmailAccount[]): Promise<{ success: boolean; error?: string }> {
    ensureDir();
    try {
        fs.writeFileSync(ACCOUNTS_CONFIG_FILE, JSON.stringify(accounts, null, 2));
        // Keep legacy email.json in sync with the first writable enabled account (backward compat)
        const primary = accounts.find(a => a.enabled && (a.permissions === 'read-write' || a.permissions === 'write-only'));
        if (primary) {
            const legacyCfg: EmailConfig = { ...primary, savedAt: Date.now() };
            fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify(legacyCfg, null, 2));
        } else if (accounts.length === 0) {
            if (fs.existsSync(EMAIL_CONFIG_FILE)) fs.unlinkSync(EMAIL_CONFIG_FILE);
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/** Upsert a single account (adds if new, replaces if id matches). Max 5 accounts. */
export async function saveEmailAccount(account: EmailAccount): Promise<{ success: boolean; error?: string }> {
    const accounts = await loadEmailAccounts();
    const idx = accounts.findIndex(a => a.id === account.id);
    if (idx >= 0) {
        accounts[idx] = { ...account, savedAt: Date.now() };
    } else {
        if (accounts.length >= 5) return { success: false, error: 'Maximum 5 email accounts allowed.' };
        accounts.push({ ...account, savedAt: Date.now() });
    }
    return saveEmailAccounts(accounts);
}

/** Remove a single account by id. */
export async function deleteEmailAccount(id: string): Promise<{ success: boolean }> {
    const accounts = await loadEmailAccounts();
    await saveEmailAccounts(accounts.filter(a => a.id !== id));
    return { success: true };
}

/** Test IMAP for a specific account by id (or default to the first account). */
export async function testImapConnectionForAccount(accountId: string): Promise<{ success: boolean; error?: string; folders?: string[] }> {
    const accounts = await loadEmailAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (!account) return { success: false, error: 'Account not found.' };
    // Temporarily set as the current config for the existing testImapConnection()
    const saved = fs.existsSync(EMAIL_CONFIG_FILE) ? fs.readFileSync(EMAIL_CONFIG_FILE, 'utf-8') : null;
    try {
        fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify({ ...account, savedAt: Date.now() }, null, 2));
        return await testImapConnection();
    } finally {
        if (saved) fs.writeFileSync(EMAIL_CONFIG_FILE, saved);
        else if (fs.existsSync(EMAIL_CONFIG_FILE)) fs.unlinkSync(EMAIL_CONFIG_FILE);
    }
}

/** Test SMTP for a specific account by id. */
export async function testSmtpConnectionForAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    const accounts = await loadEmailAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (!account) return { success: false, error: 'Account not found.' };
    const saved = fs.existsSync(EMAIL_CONFIG_FILE) ? fs.readFileSync(EMAIL_CONFIG_FILE, 'utf-8') : null;
    try {
        fs.writeFileSync(EMAIL_CONFIG_FILE, JSON.stringify({ ...account, savedAt: Date.now() }, null, 2));
        return await testSmtpConnection();
    } finally {
        if (saved) fs.writeFileSync(EMAIL_CONFIG_FILE, saved);
        else if (fs.existsSync(EMAIL_CONFIG_FILE)) fs.unlinkSync(EMAIL_CONFIG_FILE);
    }
}

// â”€â”€â”€ SMTP: Send â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function sendEmail(params: {
    to: string;
    subject: string;
    body: string;       // plain text
    htmlBody?: string;  // optional HTML version
    replyTo?: string;
    /** Optional: supply the specific account config to use. If omitted, falls back to loadEmailConfig(). */
    accountConfig?: EmailConfig;
    /** Optional: absolute file paths to attach. Paths must already be validated by the caller. */
    attachments?: string[];
}): Promise<{ success: boolean; error?: string }> {
    const config = params.accountConfig ?? await loadEmailConfig();
    if (!config?.enabled) return { success: false, error: 'Email not configured. Go to Settings â†’ Email.' };

    try {
        const nodemailer = await import('nodemailer');
        const transport = nodemailer.createTransport({
            host: config.smtpHost,
            port: config.smtpPort,
            secure: config.smtpTls,        // true = port 465 SSL, false = STARTTLS (587 etc)
            auth: { user: config.username, pass: config.password },
            tls: { rejectUnauthorized: false },   // Allow self-signed certs
            // Explicit timeouts â€” nodemailer default is 2 minutes which causes long hangs
            connectionTimeout: 15_000,   // 15s to establish TCP connection
            greetingTimeout:   15_000,   // 15s for SMTP greeting (EHLO)
            socketTimeout:     30_000,   // 30s idle socket timeout
        });

        const signatureSep = config.signature ? '\n\n-- \n' + config.signature : '';

        // Build nodemailer attachments from file paths
        const nmAttachments = params.attachments?.map(fp => ({
            filename: fp.split('/').pop() || 'attachment',
            path: fp,
        }));

        await transport.sendMail({
            from: config.displayName
                ? `"${config.displayName}" <${config.username}>`
                : config.username,
            to: params.to,
            replyTo: params.replyTo,
            subject: params.subject,
            text: params.body + signatureSep,
            html: params.htmlBody
                ? params.htmlBody + (config.signature ? `<br><br><div style="color:#888">-- <br>${config.signature.replace(/\n/g, '<br>')}</div>` : '')
                : undefined,
            ...(nmAttachments && nmAttachments.length > 0 ? { attachments: nmAttachments } : {}),
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ SMTP: Test connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
    const config = await loadEmailConfig();
    if (!config) return { success: false, error: 'No email config found.' };
    try {
        const nodemailer = await import('nodemailer');
        const transport = nodemailer.createTransport({
            host: config.smtpHost,
            port: config.smtpPort,
            secure: config.smtpTls,
            auth: { user: config.username, pass: config.password },
            tls: { rejectUnauthorized: false },
            // Explicit timeouts â€” without these nodemailer waits up to 2 minutes
            connectionTimeout: 15_000,
            greetingTimeout:   15_000,
            socketTimeout:     30_000,
        });
        await transport.verify();
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ IMAP: Fetch emails â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function fetchEmails(folder: 'INBOX' | 'Sent' | 'SENT' | string = 'INBOX', limit = 20): Promise<{
    success: boolean;
    emails?: EmailMessage[];
    error?: string;
}> {
    const config = await loadEmailConfig();
    if (!config?.enabled) return { success: false, error: 'Email not configured.' };

    try {
        const imapSimple = await import('imap-simple');
        const connection = await imapSimple.connect({
            imap: {
                user: config.username,
                password: config.password,
                host: config.imapHost,
                port: config.imapPort,
                tls: config.imapTls,
                tlsOptions: { rejectUnauthorized: false },
                connTimeout: 15000,
                authTimeout: 10000,
            },
        });

        // Try the folder name as-is, then fallback variants
        let openedFolder = folder;
        try {
            await connection.openBox(folder);
        } catch {
            // Try Sent variants
            const sentVariants = ['Sent', 'SENT', 'Sent Messages', 'Sent Items', '[Gmail]/Sent Mail'];
            if (folder.toLowerCase().includes('sent')) {
                for (const v of sentVariants) {
                    try { await connection.openBox(v); openedFolder = v; break; } catch { }
                }
            } else {
                await connection.openBox('INBOX');
                openedFolder = 'INBOX';
            }
        }

        const searchCriteria = ['ALL'];
        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
            struct: true,
            markSeen: false,
        };

        const messages = await connection.search(searchCriteria, fetchOptions);

        // Get the most recent `limit` messages
        const recent = messages.slice(-limit).reverse();

        const emails: EmailMessage[] = recent.map((msg: any) => {
            const headerPart = msg.parts.find((p: any) => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
            const bodyPart = msg.parts.find((p: any) => p.which === 'TEXT');

            const header = headerPart?.body || {};
            const from = Array.isArray(header.from) ? header.from[0] : (header.from || '');
            const to = Array.isArray(header.to) ? header.to[0] : (header.to || '');
            const subject = Array.isArray(header.subject) ? header.subject[0] : (header.subject || '(No subject)');
            const date = Array.isArray(header.date) ? header.date[0] : (header.date || '');

            let bodyRaw: string = bodyPart?.body || '';

            // Detect and convert HTML to plain text
            if (/<html|<body|<div|<p/i.test(bodyRaw)) {
                bodyRaw = htmlToPlainText(bodyRaw);
            }

            // Strip quoted text and excessive whitespace for snippet
            const snippet = bodyRaw
                .replace(/Content-Type:[^\n]+\n/gi, '')
                .replace(/Content-Transfer-Encoding:[^\n]+\n/gi, '')
                .replace(/\n>/g, '')
                .replace(/=\r?\n/g, '')  // quoted-printable line continuation
                .replace(/=[\dA-F]{2}/gi, c => String.fromCharCode(parseInt(c.slice(1), 16)))
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 500);

            const attrs = msg.attributes || {};
            const flags: string[] = attrs.flags || [];

            return {
                uid: String(attrs.uid || msg.seqno || Math.random()),
                from: from.replace(/"/g, '').trim(),
                to: to.replace(/"/g, '').trim(),
                subject: subject.trim(),
                date: date.trim(),
                body: snippet,
                isRead: flags.includes('\\Seen'),
                folder: openedFolder,
            };
        });

        await connection.end();
        return { success: true, emails };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ IMAP: Test connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function testImapConnection(): Promise<{ success: boolean; error?: string; folders?: string[] }> {
    const config = await loadEmailConfig();
    if (!config) return { success: false, error: 'No email config found.' };
    try {
        const imapSimple = await import('imap-simple');
        const connection = await imapSimple.connect({
            imap: {
                user: config.username,
                password: config.password,
                host: config.imapHost,
                port: config.imapPort,
                tls: config.imapTls,
                tlsOptions: { rejectUnauthorized: false },
                connTimeout: 15000,
                authTimeout: 10000,
            },
        });
        const boxes = await connection.getBoxes();
        const folders = Object.keys(boxes).slice(0, 10);
        await connection.end();
        return { success: true, folders };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ Inbox Polling State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EMAIL_STATE_FILE = path.join(DATA_DIR, 'integrations', 'email-inbox-state.json');

function loadEmailInboxStateSync(): EmailInboxState {
    try {
        if (fs.existsSync(EMAIL_STATE_FILE)) {
            return JSON.parse(fs.readFileSync(EMAIL_STATE_FILE, 'utf-8'));
        }
    } catch { }
    return { lastCheckedAt: 0, pendingNotifications: [], seenUids: [] };
}

function saveEmailInboxStateSync(state: EmailInboxState) {
    try {
        ensureDir();
        fs.writeFileSync(EMAIL_STATE_FILE, JSON.stringify(state, null, 2));
    } catch { }
}

export async function loadEmailInboxState(): Promise<EmailInboxState> {
    return loadEmailInboxStateSync();
}

export async function clearEmailNotifications(): Promise<void> {
    const state = loadEmailInboxStateSync();
    saveEmailInboxStateSync({ ...state, pendingNotifications: [] });
}

// â”€â”€â”€ IMAP: Poll for new emails â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Checks if pollInterval has elapsed since lastCheckedAt.
// If yes: connects to IMAP, fetches emails newer than lastCheckedAt,
//         appends them to pendingNotifications, updates lastCheckedAt.
// Returns: { checked: boolean; newCount: number; notifications: [...] }

export async function pollEmailInbox(): Promise<{
    checked: boolean;
    newCount: number;
    notifications: Array<{ from: string; subject: string; date: string }>;
    error?: string;
}> {
    const config = await loadEmailConfig();
    if (!config?.enabled) return { checked: false, newCount: 0, notifications: [] };

    const intervalMinutes = config.pollInterval ?? 15;
    if (intervalMinutes === 0) return { checked: false, newCount: 0, notifications: [] }; // manual only

    const state = loadEmailInboxStateSync();
    const now = Date.now();
    const intervalMs = intervalMinutes * 60 * 1000;

    // Not yet time to poll
    if (state.lastCheckedAt > 0 && now - state.lastCheckedAt < intervalMs) {
        return { checked: false, newCount: 0, notifications: state.pendingNotifications };
    }

    // It's time to connect and check
    try {
        const imapSimple = await import('imap-simple');
        const connection = await imapSimple.connect({
            imap: {
                user: config.username,
                password: config.password,
                host: config.imapHost,
                port: config.imapPort,
                tls: config.imapTls,
                tlsOptions: { rejectUnauthorized: false },
                connTimeout: 15000,
                authTimeout: 15000,
            },
        });

        await connection.openBox('INBOX');

        // Search for emails newer than lastCheckedAt (or last 10 if never checked)
        let searchCriteria: any[];
        if (state.lastCheckedAt > 0) {
            // IMAP SINCE only supports dates (not time), so we use SINCE with yesterday
            // and then filter by actual timestamp client-side
            const since = new Date(state.lastCheckedAt);
            const sinceStr = since.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
            searchCriteria = [['SINCE', sinceStr], 'UNSEEN'];
        } else {
            // First check: get last 5 unseen messages
            searchCriteria = ['UNSEEN'];
        }

        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)'],
            struct: false,
            markSeen: false,
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
        await connection.end();

        // Use UID-based dedup â€” seenUids persists across notification dismissals
        // so the same email never re-triggers a notification
        const seenUids = new Set(state.seenUids || []);
        const existingSubjects = new Set(state.pendingNotifications.map(n => n.subject + n.from));
        const newNotifs: Array<{ from: string; subject: string; date: string }> = [];
        const newSeenUids: string[] = [];

        for (const msg of messages.slice(-20)) { // cap at 20
            const uid = String(msg.attributes?.uid || msg.seqno || '');
            if (uid && seenUids.has(uid)) continue; // already notified about this UID

            const headerPart = msg.parts.find((p: any) => p.which === 'HEADER.FIELDS (FROM SUBJECT DATE)');
            const header = headerPart?.body || {};
            const from = (Array.isArray(header.from) ? header.from[0] : (header.from || '')).replace(/"/g, '').trim();
            const subject = (Array.isArray(header.subject) ? header.subject[0] : (header.subject || '(No subject)')).trim();
            const date = (Array.isArray(header.date) ? header.date[0] : (header.date || '')).trim();

            const key = subject + from;
            if (!existingSubjects.has(key)) {
                newNotifs.push({ from, subject, date });
                existingSubjects.add(key);
            }
            if (uid) newSeenUids.push(uid);
        }

        // Keep seenUids capped at 500 to avoid unbounded growth
        const updatedSeenUids = [...(state.seenUids || []), ...newSeenUids].slice(-500);
        const updatedPending = [...state.pendingNotifications, ...newNotifs];
        saveEmailInboxStateSync({ lastCheckedAt: now, pendingNotifications: updatedPending, seenUids: updatedSeenUids });

        return { checked: true, newCount: newNotifs.length, notifications: updatedPending };
    } catch (e: any) {
        // Update lastCheckedAt even on error so we don't hammer the server
        saveEmailInboxStateSync({ ...state, lastCheckedAt: now });
        return { checked: true, newCount: 0, notifications: state.pendingNotifications, error: e.message };
    }
}

// â”€â”€â”€ HTML to Plain Text Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function htmlToPlainText(html: string): string {
    let text = html;

    // Remove <style> blocks
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    // Remove <script> blocks
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Replace block-level tags with newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<p[^>]*>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<div[^>]*>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');

    // Strip all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    // Collapse multiple blank lines to max 2
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim
    return text.trim();
}

// â”€â”€â”€ IMAP Helper: Build IMAP connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function makeImapConnection(config: EmailConfig) {
    const imapSimple = await import('imap-simple');
    return imapSimple.connect({
        imap: {
            user: config.username,
            password: config.password,
            host: config.imapHost,
            port: config.imapPort,
            tls: config.imapTls,
            tlsOptions: { rejectUnauthorized: false },
            connTimeout: 15000,   // TCP connect timeout (node-imap param)
            authTimeout: 15000,   // Auth/greeting timeout after connect
        },
    });
}

// â”€â”€â”€ IMAP Helper: Resolve folder name with namespace prefix â”€â”€â”€
// Some mail servers (IONOS, GMX, web.de, Hetzner) store all
// folders under an "INBOX." namespace prefix. This helper tries
// the given folder name as-is first, then with "INBOX." prepended.
// Returns the working folder name, or the original if both fail.

async function resolveFolder(connection: any, folder: string): Promise<string> {
    // Already has a namespace prefix or is a known absolute path â†’ use as-is
    if (folder.startsWith('[Gmail]') || folder.startsWith('INBOX.') || folder === 'INBOX') {
        return folder;
    }
    // Try as-is first
    try {
        await connection.openBox(folder);
        return folder;
    } catch {
        // Try with INBOX. prefix
        const prefixed = `INBOX.${folder}`;
        try {
            await connection.openBox(prefixed);
            return prefixed;
        } catch {
            // Couldn't open either â€” return original and let caller handle the error
            return folder;
        }
    }
}

// â”€â”€â”€ IMAP Helper: Promisified copy + expunge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function imapCopy(connection: any, uid: string, toBox: string): Promise<void> {
    return new Promise((resolve, reject) => {
        connection.imap.copy(uid, toBox, (err: any) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function imapExpunge(connection: any): Promise<void> {
    return new Promise((resolve, reject) => {
        connection.imap.expunge((err: any) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// â”€â”€â”€ IMAP Helper: Flatten all mailbox paths â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Recursively walks the nested getBoxes() result and returns a flat
// list of { path, name, attribs } for every folder on the server.

interface BoxEntry { path: string; name: string; attribs: string[] }

function flattenBoxPaths(boxes: any, prefix: string): BoxEntry[] {
    const result: BoxEntry[] = [];
    for (const [name, box] of Object.entries<any>(boxes)) {
        const delim = box.delimiter || '.';
        const fullPath = prefix ? `${prefix}${delim}${name}` : name;
        result.push({ path: fullPath, name, attribs: Array.isArray(box.attribs) ? box.attribs : [] });
        if (box.children) result.push(...flattenBoxPaths(box.children, fullPath));
    }
    return result;
}

// â”€â”€â”€ IMAP Helper: Find trash folder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Strategy:
//   1. Try well-known names (incl. German "Papierkorb" for Hetzner/Horde).
//   2. Fetch full box list and look for \Trash special-use attribute.
//   3. Full deep scan: match any folder whose name contains a trash keyword.
// Reopens sourceFolder before returning so the caller can continue.

async function findTrashFolder(connection: any, sourceFolder: string): Promise<string | null> {
    // â”€â”€ Step 1: Try well-known folder names â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const knownCandidates = [
        // Gmail
        '[Gmail]/Trash',
        // English
        'Trash', 'TRASH',
        'Deleted', 'DELETED',
        'Deleted Items', 'Deleted Messages',
        // INBOX-namespaced (GMX, Minimax, many hosters)
        'INBOX.Trash', 'INBOX.Deleted',
        'INBOX.Deleted Items', 'INBOX.Deleted Messages',
        // German (Hetzner KH Webmail / Horde IMP, T-Online, GMX DE, etc.)
        'Papierkorb', 'INBOX.Papierkorb',
        // French / Italian / Spanish
        'Corbeille', 'Cestino', 'Papelera',
        // Other common names
        'Junk', 'Spam', 'Archive',
    ];

    for (const name of knownCandidates) {
        try {
            await connection.openBox(name);
            await connection.openBox(sourceFolder);
            return name;
        } catch { /* try next */ }
    }

    // â”€â”€ Step 2 + 3: Enumerate ALL folders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
        const boxes = await connection.getBoxes();
        const allBoxes = flattenBoxPaths(boxes, '');

        // 2a. Special-use \Trash attribute (RFC 6154)
        const byAttr = allBoxes.find(b =>
            b.attribs.some(a => a.toLowerCase() === '\\trash')
        );
        if (byAttr) {
            try {
                await connection.openBox(byAttr.path);
                await connection.openBox(sourceFolder);
                return byAttr.path;
            } catch { }
        }

        // 2b. Name-based keyword match (case-insensitive, any language)
        const trashKeywords = ['trash', 'deleted', 'papierkorb', 'corbeille', 'cestino', 'papelera', 'junk'];
        const byName = allBoxes.find(b =>
            trashKeywords.some(kw => b.name.toLowerCase().includes(kw))
        );
        if (byName) {
            try {
                await connection.openBox(byName.path);
                await connection.openBox(sourceFolder);
                return byName.path;
            } catch { }
        }
    } catch { /* getBoxes failed â€” server doesn't support LIST */ }

    return null;
}

// Kept for backwards compatibility (used in older call sites).
function findBoxByAttribute(boxes: any, attr: string, prefix: string): string | null {
    for (const [name, box] of Object.entries<any>(boxes)) {
        const delim = box.delimiter || '.';
        const fullName = prefix ? `${prefix}${delim}${name}` : name;
        if (Array.isArray(box.attribs) && box.attribs.includes(attr)) return fullName;
        if (box.children) {
            const found = findBoxByAttribute(box.children, attr, fullName);
            if (found) return found;
        }
    }
    return null;
}

// â”€â”€â”€ IMAP: Mark email as read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function markEmailAsRead(uid: string, folder: string = 'INBOX'): Promise<{ success: boolean; error?: string }> {
    const config = await loadEmailConfig();
    if (!config?.enabled) return { success: false, error: 'Email not configured.' };
    try {
        const connection = await makeImapConnection(config);
        const resolvedFolder = await resolveFolder(connection, folder);
        // resolveFolder already opened the box â€” just proceed
        await connection.addFlags(uid, ['\\Seen']);
        await connection.end();
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ IMAP: Move to Trash â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function moveEmailToTrash(uid: string, folder: string = 'INBOX'): Promise<{ success: boolean; error?: string }> {
    const config = await loadEmailConfig();
    if (!config?.enabled) return { success: false, error: 'Email not configured.' };

    try {
        const connection = await makeImapConnection(config);
        folder = await resolveFolder(connection, folder); // resolveFolder already opened the box

        const trashFolder = await findTrashFolder(connection, folder);

        if (!trashFolder) {
            // No trash folder found â€” just mark deleted and expunge in place
            try {
                await connection.addFlags(uid, ['\\Deleted']);
                await imapExpunge(connection);
                await connection.end();
                return { success: true };
            } catch (e: any) {
                await connection.end();
                return { success: false, error: `Could not find Trash folder and in-place delete failed: ${e.message}` };
            }
        }

        // Try IMAP MOVE extension first (atomic, supported by most modern servers)
        try {
            await (connection as any).moveMessage(uid, trashFolder);
            await connection.end();
            return { success: true };
        } catch {
            // Fallback: COPY to trash + mark \Deleted on source + expunge
            try {
                await imapCopy(connection, uid, trashFolder);
                await connection.addFlags(uid, ['\\Deleted']);
                await imapExpunge(connection);
                await connection.end();
                return { success: true };
            } catch (fallbackErr: any) {
                await connection.end();
                return { success: false, error: fallbackErr.message };
            }
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ IMAP: Move Email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function moveEmail(uid: string, fromFolder: string, toFolder: string): Promise<{ success: boolean; error?: string }> {
    const config = await loadEmailConfig();
    if (!config?.enabled) return { success: false, error: 'Email not configured.' };

    try {
        const connection = await makeImapConnection(config);
        fromFolder = await resolveFolder(connection, fromFolder); // resolveFolder already opened the box

        // Try IMAP MOVE extension first
        try {
            await (connection as any).moveMessage(uid, toFolder);
            await connection.end();
            return { success: true };
        } catch {
            // Fallback: COPY + mark \Deleted + expunge
            try {
                await imapCopy(connection, uid, toFolder);
                await connection.addFlags(uid, ['\\Deleted']);
                await imapExpunge(connection);
                await connection.end();
                return { success: true };
            } catch (fallbackErr: any) {
                await connection.end();
                return { success: false, error: fallbackErr.message };
            }
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// â”€â”€â”€ IMAP: Empty Trash â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function emptyTrash(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
    const config = await loadEmailConfig();
    if (!config?.enabled) return { success: false, error: 'Email not configured.' };

    try {
        const connection = await makeImapConnection(config);
        // Open INBOX first so findTrashFolder has a known "source" to reopen
        try { await connection.openBox('INBOX'); } catch { }

        // Use the same multi-strategy finder as moveEmailToTrash
        const trashFolder = await findTrashFolder(connection, 'INBOX');

        if (!trashFolder) {
            await connection.end();
            return { success: false, error: 'Could not find Trash folder.' };
        }

        // Open the trash folder for subsequent operations
        await connection.openBox(trashFolder);

        // Search all messages â€” must pass fetchOptions to imap-simple
        const messages = await connection.search(['ALL'], { bodies: [], markSeen: false });
        const deletedCount = messages.length;

        if (deletedCount === 0) {
            await connection.end();
            return { success: true, deletedCount: 0 };
        }

        // Mark all as \Deleted
        const uids = messages.map((m: any) => String(m.attributes?.uid || m.seqno));
        for (const u of uids) {
            try {
                await connection.addFlags(u, ['\\Deleted']);
            } catch { }
        }

        // Expunge via promisified node-imap call
        await imapExpunge(connection);
        await connection.end();
        return { success: true, deletedCount };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
