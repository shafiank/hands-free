/**
 * notification-router.ts
 *
 * Unified notification delivery for Hands Free.
 * All proactive notifications (Friend Mode check-ins, buddy intelligence,
 * task completions, calendar reminders) go through this router.
 *
 * The router enforces:
 *   1. Quiet hours â€” no notifications during sleep (high-priority bypasses)
 *   2. Per-type cooldowns â€” prevents spam (persistent across restarts)
 *   3. Channel routing â€” buddy bubble, Telegram, dashboard chat
 *   4. Per-type enable/disable â€” user can turn off specific notification types
 *
 * Hands Free v7 â€” Session 16
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '@/lib/paths';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type NotificationType =
    | 'friend-checkin'
    | 'task-complete'
    | 'task-blocked'
    | 'meeting-reminder'
    | 'meeting-prep'
    | 'email-alert'
    | 'eod-summary'
    | 'morning-greeting'
    | 'overdue-tasks'
    | 'idle-checkin'
    | 'planner-suggestion';

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface HandsFreeNotification {
    type: NotificationType;
    message: string;
    priority: NotificationPriority;
    emoji?: string;
    action?: {
        label: string;
        route?: string;
        handler?: string;
    };
    expiresMs?: number;
    cooldownMinutes: number;
}

// â”€â”€â”€ Cooldown persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BUDDY_STATE_FILE = path.join(DATA_DIR, 'buddy-state.json');

interface BuddyState {
    cooldowns: Record<string, number>;
    lastUserInteraction: number;
    /** Which page the user was last active on ('chat', 'buddy', 'settings', etc.) */
    lastActiveSource?: string;
}

function loadBuddyState(): BuddyState {
    try {
        if (fs.existsSync(BUDDY_STATE_FILE)) {
            return JSON.parse(fs.readFileSync(BUDDY_STATE_FILE, 'utf-8'));
        }
    } catch { /* first run */ }
    return { cooldowns: {}, lastUserInteraction: Date.now() };
}

function saveBuddyState(state: BuddyState): void {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(BUDDY_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch { /* non-fatal */ }
}

function isOnCooldown(type: NotificationType, cooldownMinutes: number): boolean {
    const state = loadBuddyState();
    const lastSent = state.cooldowns[type] || 0;
    return (Date.now() - lastSent) < cooldownMinutes * 60 * 1000;
}

function markSent(type: NotificationType): void {
    const state = loadBuddyState();
    state.cooldowns[type] = Date.now();
    saveBuddyState(state);
}

// â”€â”€â”€ Activity tracking (used by buddy intelligence for idle detection) â”€â”€

export function getLastUserInteraction(): number {
    return loadBuddyState().lastUserInteraction;
}

export function updateLastUserInteraction(source?: string): void {
    const state = loadBuddyState();
    state.lastUserInteraction = Date.now();
    if (source) state.lastActiveSource = source;
    saveBuddyState(state);
}

/**
 * Returns true if the user is actively using the chat window (heartbeat within last 60s).
 * Used to suppress buddy bubble / dashboard notifications when user is already reading chat.
 */
export function isUserActiveInChat(): boolean {
    try {
        const state = loadBuddyState();
        const timeSince = Date.now() - (state.lastUserInteraction || 0);
        return state.lastActiveSource === 'chat' && timeSince < 60_000;
    } catch { return false; }
}

// â”€â”€â”€ Quiet hours check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function isQuietHours(settings: any): boolean {
    const behavior = settings?.activeUserBehavior || {};
    const start = behavior.quietHoursStart ?? 22;
    const end = behavior.quietHoursEnd ?? 7;
    const hour = new Date().getHours();

    if (start < end) {
        return hour >= start && hour < end;
    } else {
        // Wraps midnight: e.g. 22â†’7 means quiet from 22:00 to 06:59
        return hour >= start || hour < end;
    }
}

// â”€â”€â”€ Main router â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function routeNotification(notification: HandsFreeNotification): Promise<boolean> {
    let settings: any;
    try {
        const { loadSettings } = await import('@/actions/chat');
        settings = await loadSettings();
    } catch {
        return false;
    }

    const behavior = settings?.activeUserBehavior || {};

    // 1. Respect quiet hours (HIGH priority bypasses)
    if (notification.priority !== 'high' && isQuietHours(settings)) {
        return false;
    }

    // 2. Check cooldown
    if (isOnCooldown(notification.type, notification.cooldownMinutes)) {
        return false;
    }

    // 3. Check if this notification type is enabled
    const typeSettings = behavior.notificationTypes || {};
    if (typeSettings[notification.type] === false) {
        return false;
    }

    // 4. Build display message
    const displayMsg = notification.emoji
        ? `${notification.emoji} ${notification.message}`
        : notification.message;

    // 5. Route to enabled channels
    const channels = behavior.channels || { browser: true, telegram: true };
    let sent = false;

    // Check if user is actively in chat â€” suppress local notifications to avoid duplicates
    const userInChat = isUserActiveInChat();

    // Buddy bubble â€” suppress when user is in chat (they already see the conversation)
    if (channels.browser !== false && !userInChat) {
        try {
            const { pushBuddyNotification } = await import('./buddy-notify');
            pushBuddyNotification(displayMsg, {
                type:      notification.type,
                action:    notification.action,
                expiresMs: notification.expiresMs,
            });
            sent = true;
        } catch { /* non-fatal */ }
    }

    // Telegram
    if (channels.telegram !== false) {
        try {
            const configPath = path.join(DATA_DIR, 'integrations', 'telegram.json');
            if (fs.existsSync(configPath)) {
                const tgCfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (tgCfg?.enabled && tgCfg?.botToken && tgCfg?.pairedChatId) {
                    const { sendMessage } = await import('@/actions/telegram');
                    await sendMessage(tgCfg.botToken, String(tgCfg.pairedChatId), displayMsg);
                    sent = true;
                }
            }
        } catch { /* Telegram not available */ }
    }

    // Dashboard chat â€” suppress when user is in chat (they see the chat already)
    if (channels.dashboard === true && !userInChat) {
        try {
            const { pushDashboardMessage } = await import('./dashboard-notify');
            pushDashboardMessage(displayMsg);
            sent = true;
        } catch { /* non-fatal */ }
    }

    // 6. Mark cooldown
    if (sent) {
        markSent(notification.type);
    }

    return sent;
}
