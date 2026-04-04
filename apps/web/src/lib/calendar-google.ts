/**
 * Google Calendar Provider
 * Wraps the existing calendar.ts functions into the unified CalendarProvider interface.
 * Does NOT replace calendar.ts â€” existing code that calls calendar.ts directly still works.
 * Hands Free v7 â€” Session 13
 */

import { CalendarProvider, CalendarEvent } from './calendar-provider';
import {
    loadCalendarConfig,
    listCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
} from '@/actions/calendar';

export class GoogleCalendarProvider implements CalendarProvider {
    name = 'Google Calendar';
    type = 'google' as const;

    async isConfigured(): Promise<boolean> {
        try {
            const config = await loadCalendarConfig();
            if (!config) return false;
            return !!(config.apiKey || (config.clientId && config.refreshToken));
        } catch {
            return false;
        }
    }

    async getEvents(date: string): Promise<CalendarEvent[]> {
        // date: YYYY-MM-DD â€” fetch events for that single day
        const start = `${date}T00:00:00`;
        const end = `${date}T23:59:59`;
        return this.getEventsRange(start, end);
    }

    async getEventsRange(start: string, end: string): Promise<CalendarEvent[]> {
        // Calculate days ahead from the date range
        const startDate = new Date(start);
        const endDate = new Date(end);
        const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000));

        const result = await listCalendarEvents(daysDiff);
        if (!result.success || !result.events) return [];

        // Map Google Calendar events to unified CalendarEvent format
        return result.events
            .filter(e => {
                // Filter to requested range
                const eventStart = e.start.dateTime || e.start.date || '';
                return eventStart >= start.slice(0, 10);
            })
            .map(e => this.mapGoogleEvent(e));
    }

    async createEvent(event: Omit<CalendarEvent, 'id' | 'provider'>): Promise<CalendarEvent> {
        const result = await createCalendarEvent(
            event.title,
            event.startTime,
            event.endTime,
            event.description,
            event.location,
        );

        if (!result.success || !result.event) {
            throw new Error(result.error || 'Failed to create Google Calendar event');
        }

        return this.mapGoogleEvent(result.event);
    }

    async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
        const result = await updateCalendarEvent(id, {
            summary: updates.title,
            startDateTime: updates.startTime,
            endDateTime: updates.endTime,
            description: updates.description,
            location: updates.location,
        });

        if (!result.success || !result.event) {
            throw new Error(result.error || 'Failed to update Google Calendar event');
        }

        return this.mapGoogleEvent(result.event);
    }

    async deleteEvent(id: string): Promise<boolean> {
        const result = await deleteCalendarEvent(id);
        return result.success;
    }

    // â”€â”€â”€ Internal: map Google event â†’ unified CalendarEvent â”€â”€â”€â”€â”€â”€
    private mapGoogleEvent(e: any): CalendarEvent {
        const isAllDay = !!(e.start?.date && !e.start?.dateTime);
        return {
            id: e.id || '',
            title: e.summary || 'Untitled',
            description: e.description,
            startTime: e.start?.dateTime || e.start?.date || '',
            endTime: e.end?.dateTime || e.end?.date || '',
            allDay: isAllDay,
            location: e.location,
            provider: 'google',
            editable: true,
            htmlLink: e.htmlLink,
        };
    }
}
