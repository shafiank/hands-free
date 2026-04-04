/**
 * buddy-intelligence.ts
 *
 * BRAIN of the proactive buddy system. Uses RULES + data (no LLMs).
 * Checks context and decides if there's something worth saying to the user.
 *
 * Exported functions:
 *   - gatherBuddyContext() â€” collects data from tasks, calendar, email, idle time
 *   - decideBuddyAction() â€” rule-based decision engine, returns HandsFreeNotification | null
 *   - tickBuddyIntelligence() â€” async runner heartbeat handler
 *
 * Hands Free v7
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '@/lib/paths';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface BuddyContext {
    tasksCount: {
        pending: number;
        inProgress: number;
        completedToday: number;
        blocked: number;
    };
    nextMeeting: {
        minutesUntilStart: number;
        title: string;
        location?: string;
        description?: string;
    } | null;
    unreadEmails: number;
    idleMinutes: number;
    currentHour: number;
}

// â”€â”€â”€ 1. Gather Context from Multiple Sources â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function gatherBuddyContext(): Promise<BuddyContext> {
    const context: BuddyContext = {
        tasksCount: {
            pending: 0,
            inProgress: 0,
            completedToday: 0,
            blocked: 0,
        },
        nextMeeting: null,
        unreadEmails: 0,
        idleMinutes: 0,
        currentHour: new Date().getHours(),
    };

    try {
        // â”€â”€ Task counts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try {
            const { getAllTasks } = await import('@/lib/agent-tasks');
            const allTasks = getAllTasks();
            const now = Date.now();
            const dayStart = new Date();
            dayStart.setHours(0, 0, 0, 0);

            for (const task of allTasks) {
                if (task.state === 'pending') context.tasksCount.pending++;
                else if (task.state === 'in_progress') context.tasksCount.inProgress++;
                else if (task.state === 'blocked') context.tasksCount.blocked++;
                else if (task.state === 'completed' && task.completedAt && task.completedAt > dayStart.getTime()) {
                    context.tasksCount.completedToday++;
                }
            }
        } catch {
            // Tasks unavailable
        }

        // â”€â”€ Calendar: next event within 60 minutes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try {
            const { listCalendarEvents } = await import('@/actions/calendar');
            const result = await listCalendarEvents(1);
            if (result.success && result.events && result.events.length > 0) {
                const now = new Date();
                for (const event of result.events) {
                    const startStr = event.start.dateTime || event.start.date;
                    if (!startStr) continue;

                    const startTime = new Date(startStr);
                    const diffMs = startTime.getTime() - now.getTime();
                    const diffMinutes = Math.floor(diffMs / (1000 * 60));

                    // Only consider if within next 60 minutes
                    if (diffMinutes > 0 && diffMinutes <= 60) {
                        context.nextMeeting = {
                            minutesUntilStart: diffMinutes,
                            title: event.summary,
                            location: event.location,
                            description: event.description,
                        };
                        break; // first match is the soonest
                    }
                }
            }
        } catch {
            // Calendar not available
        }

        // â”€â”€ Email: pending notifications from inbox state file â”€â”€â”€
        try {
            const emailStatePath = path.join(DATA_DIR, 'integrations', 'email-inbox-state.json');
            if (fs.existsSync(emailStatePath)) {
                const state = JSON.parse(fs.readFileSync(emailStatePath, 'utf-8'));
                context.unreadEmails = (state.pendingNotifications || []).length;
            }
        } catch {
            // Email state not available
        }

        // â”€â”€ Idle time: minutes since last user interaction â”€â”€â”€â”€â”€â”€â”€
        try {
            const { getLastUserInteraction } = await import('@/lib/notification-router');
            const lastInteraction = getLastUserInteraction();
            const idleMs = Date.now() - lastInteraction;
            context.idleMinutes = Math.floor(idleMs / (1000 * 60));
        } catch {
            // Interaction tracking unavailable
        }
    } catch {
        // Silent on any outer exception
    }

    return context;
}

// â”€â”€â”€ 2. Rule-Based Decision Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function decideBuddyAction(ctx: BuddyContext, settings: any): Promise<any | null> {
    try {
        // Check if proactive buddy is enabled
        const behavior = settings?.activeUserBehavior || {};
        const proactiveEnabled = behavior.proactiveEnabled !== false; // default true
        if (!proactiveEnabled) return null;

        const notificationTypes = behavior.notificationTypes || {};

        // Rule a: Meeting in next 30 min â†’ 'meeting-reminder' (HIGH)
        if (
            ctx.nextMeeting &&
            ctx.nextMeeting.minutesUntilStart <= 30 &&
            ctx.nextMeeting.minutesUntilStart > 0
        ) {
            if (notificationTypes['meeting-reminder'] !== false) {
                const msg = `â° Meeting starting in ${ctx.nextMeeting.minutesUntilStart} min: ${ctx.nextMeeting.title}${ctx.nextMeeting.location ? ` at ${ctx.nextMeeting.location}` : ''}`;
                return {
                    type: 'meeting-reminder',
                    message: msg,
                    priority: 'high',
                    emoji: 'â°',
                    cooldownMinutes: 25,
                };
            }
        }

        // Rule b: Meeting in next 60 min + has description â†’ 'meeting-prep' (MEDIUM)
        if (
            ctx.nextMeeting &&
            ctx.nextMeeting.minutesUntilStart > 30 &&
            ctx.nextMeeting.minutesUntilStart <= 60 &&
            ctx.nextMeeting.description
        ) {
            if (notificationTypes['meeting-prep'] !== false) {
                const msg = `â° Prep for "${ctx.nextMeeting.title}" in ${ctx.nextMeeting.minutesUntilStart} min`;
                return {
                    type: 'meeting-prep',
                    message: msg,
                    priority: 'medium',
                    emoji: 'â°',
                    cooldownMinutes: 50,
                };
            }
        }

        // Rule c: Blocked tasks > 0 â†’ 'overdue-tasks' (MEDIUM)
        // (Repurposing since there's no dueAt field)
        if (ctx.tasksCount.blocked > 0) {
            if (notificationTypes['overdue-tasks'] !== false) {
                const msg = `You have ${ctx.tasksCount.blocked} blocked task${ctx.tasksCount.blocked > 1 ? 's' : ''}. Review them to get unstuck.`;
                return {
                    type: 'overdue-tasks',
                    message: msg,
                    priority: 'medium',
                    emoji: 'âš ï¸',
                    cooldownMinutes: 120,
                };
            }
        }

        // Rule d: Unread emails > 3 â†’ 'email-alert' (LOW)
        if (ctx.unreadEmails > 3) {
            if (notificationTypes['email-alert'] !== false) {
                const msg = `ðŸ“§ You have ${ctx.unreadEmails} pending emails`;
                return {
                    type: 'email-alert',
                    message: msg,
                    priority: 'low',
                    emoji: 'ðŸ“§',
                    cooldownMinutes: 120,
                };
            }
        }

        // Rule e: Completed tasks today >= 3 â†’ 'eod-summary' (only 16:00-19:00)
        if (ctx.tasksCount.completedToday >= 3 && ctx.currentHour >= 16 && ctx.currentHour < 19) {
            if (notificationTypes['eod-summary'] !== false) {
                const msg = `âœ… Great work today! You completed ${ctx.tasksCount.completedToday} tasks.`;
                return {
                    type: 'eod-summary',
                    message: msg,
                    priority: 'low',
                    emoji: 'âœ…',
                    cooldownMinutes: 480, // 8 hours â€” once per evening
                };
            }
        }

        // Rule f: Idle > 45 min and pending tasks > 0 â†’ 'idle-checkin' (LOW)
        if (ctx.idleMinutes > 45 && ctx.tasksCount.pending > 0) {
            if (notificationTypes['idle-checkin'] !== false) {
                const msg = `ðŸ’¤ You've been idle for ${ctx.idleMinutes} min. Got ${ctx.tasksCount.pending} pending task${ctx.tasksCount.pending > 1 ? 's' : ''}.`;
                return {
                    type: 'idle-checkin',
                    message: msg,
                    priority: 'low',
                    emoji: 'ðŸ’¤',
                    cooldownMinutes: 60,
                };
            }
        }

        // Rule g: Morning greeting (7:00-9:00)
        if (ctx.currentHour >= 7 && ctx.currentHour < 9) {
            if (notificationTypes['morning-greeting'] !== false) {
                const greeting = ctx.tasksCount.pending > 0
                    ? `â˜€ï¸ Good morning! You have ${ctx.tasksCount.pending} task${ctx.tasksCount.pending > 1 ? 's' : ''} today.`
                    : 'â˜€ï¸ Good morning!';
                return {
                    type: 'morning-greeting',
                    message: greeting,
                    priority: 'low',
                    emoji: 'â˜€ï¸',
                    cooldownMinutes: 720, // 12 hours
                };
            }
        }
    } catch {
        // Silent on error
    }

    return null;
}

// â”€â”€â”€ 3. Autonomous Runner Heartbeat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function tickBuddyIntelligence(): Promise<void> {
    try {
        // Load settings
        const { loadSettings } = await import('@/actions/chat');
        const settings = await loadSettings();

        // Check if active behavior is enabled and proactive is not disabled
        const behavior = settings?.activeUserBehavior || {};
        if (!behavior.enabled) return;

        // Gather context
        const ctx = await gatherBuddyContext();

        // Decide if there's something to say
        const action = await decideBuddyAction(ctx, settings);
        if (!action) return;

        // Route the notification
        const { routeNotification } = await import('@/lib/notification-router');
        await routeNotification(action);
    } catch {
        // Silent on failure
    }
}
