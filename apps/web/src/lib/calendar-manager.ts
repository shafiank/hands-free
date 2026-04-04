/**
 * Unified Calendar Manager
 * Aggregates events from all configured calendar providers (Google, Apple, Outlook).
 * Hands Free v7 â€” Session 13
 */

import { CalendarProvider, CalendarEvent } from './calendar-provider';
import { GoogleCalendarProvider } from './calendar-google';
import { AppleCalendarProvider } from './calendar-apple';
import { OutlookCalendarProvider } from './calendar-outlook';
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './paths';

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function loadSettingsSync(): any {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        }
    } catch { /* ignore */ }
    return {};
}

export class CalendarManager {
    private providers: CalendarProvider[] = [];

    async initialize(): Promise<void> {
        this.providers = [];

        // Google Calendar
        const google = new GoogleCalendarProvider();
        if (await google.isConfigured()) {
            this.providers.push(google);
        }

        // Apple Calendar (CalDAV)
        const settings = loadSettingsSync();
        if (settings.appleCalendar?.caldavUrl && settings.appleCalendar?.username && settings.appleCalendar?.password) {
            const apple = new AppleCalendarProvider(settings.appleCalendar);
            if (await apple.isConfigured()) {
                this.providers.push(apple);
            }
        }

        // Outlook Calendar
        const outlook = new OutlookCalendarProvider();
        if (await outlook.isConfigured()) {
            this.providers.push(outlook);
        }
    }

    async getAllEvents(date: string): Promise<CalendarEvent[]> {
        if (this.providers.length === 0) await this.initialize();

        const results = await Promise.allSettled(
            this.providers.map(p => p.getEvents(date))
        );

        const events: CalendarEvent[] = [];
        for (const result of results) {
            if (result.status === 'fulfilled') {
                events.push(...result.value);
            }
        }

        return events.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    async getAllEventsRange(start: string, end: string): Promise<CalendarEvent[]> {
        if (this.providers.length === 0) await this.initialize();

        const results = await Promise.allSettled(
            this.providers.map(p => p.getEventsRange(start, end))
        );

        const events: CalendarEvent[] = [];
        for (const result of results) {
            if (result.status === 'fulfilled') {
                events.push(...result.value);
            }
        }

        return events.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    async createEvent(
        event: Omit<CalendarEvent, 'id' | 'provider'>,
        targetProvider?: 'google' | 'apple' | 'outlook',
    ): Promise<CalendarEvent> {
        if (this.providers.length === 0) await this.initialize();

        const provider = targetProvider
            ? this.providers.find(p => p.type === targetProvider)
            : this.providers[0];

        if (!provider) {
            throw new Error(
                targetProvider
                    ? `Calendar provider "${targetProvider}" is not configured.`
                    : 'No calendar provider configured. Set up a calendar in Settings.'
            );
        }

        return provider.createEvent(event);
    }

    async updateEvent(
        id: string,
        updates: Partial<CalendarEvent>,
        targetProvider?: 'google' | 'apple' | 'outlook',
    ): Promise<CalendarEvent> {
        if (this.providers.length === 0) await this.initialize();

        // If provider specified, use it; otherwise try to find the right one
        const provider = targetProvider
            ? this.providers.find(p => p.type === targetProvider)
            : this.providers[0];

        if (!provider) throw new Error('No calendar provider available for update.');
        return provider.updateEvent(id, updates);
    }

    async deleteEvent(
        id: string,
        targetProvider?: 'google' | 'apple' | 'outlook',
    ): Promise<boolean> {
        if (this.providers.length === 0) await this.initialize();

        const provider = targetProvider
            ? this.providers.find(p => p.type === targetProvider)
            : this.providers[0];

        if (!provider) throw new Error('No calendar provider available for delete.');
        return provider.deleteEvent(id);
    }

    getConfiguredProviders(): string[] {
        return this.providers.map(p => p.type);
    }

    getProviderCount(): number {
        return this.providers.length;
    }
}

// â”€â”€â”€ Singleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _manager: CalendarManager | null = null;

export async function getCalendarManager(): Promise<CalendarManager> {
    if (!_manager) {
        _manager = new CalendarManager();
        await _manager.initialize();
    }
    return _manager;
}

// Reset the singleton (call when calendar settings change)
export function resetCalendarManager(): void {
    _manager = null;
}
