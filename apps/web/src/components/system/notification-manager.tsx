'use client';

import { useEffect, useRef } from 'react';
import { getTelegramInbox } from '@/actions/telegram';

export function NotificationManager() {
    const lastCheckRef = useRef<number>(Date.now());

    useEffect(() => {
        // Request permission on mount
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        const checkInbox = async () => {
            // Skip while tab is hidden â€” avoids spurious fetch errors on wake-up
            if (document.hidden) return;
            try {
                const now = Date.now();
                const newItems = await getTelegramInbox(lastCheckRef.current);

                if (newItems && newItems.length > 0) {
                    newItems.forEach(item => {
                        // Avoid notifying on very old items (clock skew / initial load)
                        if (now - item.timestamp > 60000) return;

                        if (Notification.permission === 'granted') {
                            const title = item.telegramUserName || 'Hands Free';
                            const body = item.content.length > 100 ? item.content.slice(0, 100) + '...' : item.content;

                            new Notification(title, {
                                body: body,
                                icon: '/icon.png',
                                tag: item.id // Prevent duplicate notifications for same ID
                            });
                        }
                    });

                    lastCheckRef.current = now;
                }
            } catch {
                // Silent â€” Telegram not configured or network unavailable (tab wake-up)
            }
        };

        // â”€â”€ Calendar reminder polling â€” every 5 minutes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Calls /api/calendar/reminders which checks events in the next 15 min
        // and sends a Telegram message for each. Dedup happens server-side.
        const checkCalendarReminders = async () => {
            if (document.hidden) return;
            try {
                await fetch('/api/calendar/reminders');
            } catch {
                // Silent â€” reminder check is best-effort
            }
        };

        // â”€â”€ Memory scanner â€” every 90 minutes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Scans new conversations and extracts memories via regex NLP.
        // Best-effort: silent on failure. First run 2 minutes after mount.
        const runMemoryScan = async () => {
            if (document.hidden) return;
            try {
                await fetch('/api/memory/scan');
            } catch {
                // Silent â€” memory scan is background best-effort
            }
        };

        // Check every 30 seconds for inbox
        const inboxInterval    = setInterval(checkInbox,             30 * 1000);
        // Check calendar reminders every 5 minutes
        const calendarInterval = setInterval(checkCalendarReminders,  5 * 60 * 1000);
        // Memory scan every 90 minutes
        const memoryScanInterval = setInterval(runMemoryScan,        90 * 60 * 1000);

        // â”€â”€ visibilitychange: immediately re-check inbox on tab/window wake-up â”€â”€
        // Triggers a safe, guarded fetch the moment the user returns,
        // instead of waiting up to 30 seconds for the next interval tick.
        const onVisibility = () => {
            if (!document.hidden) checkInbox();
        };
        document.addEventListener('visibilitychange', onVisibility);

        // Initial checks after short delays to avoid hammering on mount
        setTimeout(checkInbox,             5_000);
        setTimeout(checkCalendarReminders, 30_000);       // First calendar check after 30s
        setTimeout(runMemoryScan,          2 * 60_000);   // First memory scan after 2 min

        return () => {
            clearInterval(inboxInterval);
            clearInterval(calendarInterval);
            clearInterval(memoryScanInterval);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    return null; // Invisible component
}
