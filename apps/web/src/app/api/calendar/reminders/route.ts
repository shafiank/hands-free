export const dynamic = 'force-dynamic';
// ============================================================
// Calendar Reminder Endpoint — GET /api/calendar/reminders
// ============================================================
// Called every 5 minutes from the frontend (Sidebar useEffect).
// Checks for Google Calendar events starting in the next 15 min
// and sends a Telegram notification if any are found.
//
// Dedup: in-memory Set of already-notified event IDs.
// Resets on server restart (acceptable — prevents duplicate
// notifications within the same session).
// ============================================================

import { NextResponse } from 'next/server';
import { loadCalendarConfig, listCalendarEvents } from '@/actions/calendar';
import { loadTelegramConfig, sendMessage } from '@/actions/telegram';
import { loadSettings } from '@/actions/chat';

// In-memory dedup — resets on server restart (intentional)
const notifiedEventIds = new Set<string>();

// How far ahead to look for "upcoming" events (in minutes)
const LOOKAHEAD_MINUTES = 15;

export async function GET() {
    try {
        // 1. Check if Google Calendar skill is enabled
        const settings = await loadSettings();
        if (!settings.skills?.googleCalendar?.enabled) {
            return NextResponse.json({ skipped: true, reason: 'Google Calendar skill is not enabled.' });
        }

        // 2. Check if calendar is configured
        const calConfig = await loadCalendarConfig();
        if (!calConfig) {
            return NextResponse.json({ skipped: true, reason: 'Google Calendar not configured.' });
        }

        // 3. Fetch events in the next LOOKAHEAD_MINUTES
        const now = Date.now();
        const windowEnd = now + LOOKAHEAD_MINUTES * 60 * 1000;

        // listCalendarEvents(1) = next 1 day — narrow it down below
        const result = await listCalendarEvents(1);
        if (!result.success || !result.events) {
            return NextResponse.json({ skipped: true, reason: result.error || 'No events returned.' });
        }

        // 4. Filter: events that start within the next LOOKAHEAD_MINUTES and haven't been notified
        const upcoming = result.events.filter((ev) => {
            if (notifiedEventIds.has(ev.id)) return false;
            const startStr = ev.start.dateTime || ev.start.date;
            if (!startStr) return false;
            const startMs = new Date(startStr).getTime();
            return startMs >= now && startMs <= windowEnd;
        });

        if (upcoming.length === 0) {
            return NextResponse.json({ sent: 0, message: 'No upcoming events in the next 15 minutes.' });
        }

        // 5. Try to send Telegram notification for each upcoming event
        const telegramConfig = await loadTelegramConfig();
        const canNotify = telegramConfig?.enabled && telegramConfig?.botToken && telegramConfig?.pairedChatId;

        const notified: string[] = [];
        for (const ev of upcoming) {
            // Mark as notified before sending to avoid double-notification on retry
            notifiedEventIds.add(ev.id);

            if (canNotify) {
                const startStr = ev.start.dateTime || ev.start.date || '';
                let timeLabel = '';
                try {
                    timeLabel = new Date(startStr).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit', hour12: false,
                    });
                } catch { timeLabel = startStr; }

                const text = [
                    `⏰ *Upcoming Event in ~${LOOKAHEAD_MINUTES} min*`,
                    `📅 *${ev.summary}*`,
                    timeLabel ? `🕐 ${timeLabel}` : '',
                    ev.location ? `📍 ${ev.location}` : '',
                    ev.description ? `📝 ${ev.description.slice(0, 100)}` : '',
                ].filter(Boolean).join('\n');

                await sendMessage(
                    telegramConfig!.botToken!,
                    telegramConfig!.pairedChatId!,
                    text,
                ).catch(() => { /* silent — Telegram may be temporarily unreachable */ });
            }

            notified.push(ev.summary);
        }

        return NextResponse.json({
            sent: notified.length,
            events: notified,
            notifiedViaTelegram: canNotify,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
