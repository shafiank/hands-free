/**
 * Unified Calendar Provider Interface
 * All calendar providers (Google, Apple, Outlook) implement this interface.
 * Hands Free v7 â€” Session 13
 */

export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    startTime: string;      // ISO 8601
    endTime: string;        // ISO 8601
    allDay: boolean;
    location?: string;
    calendarId?: string;
    provider: 'google' | 'apple' | 'outlook';
    editable: boolean;
    color?: string;
    htmlLink?: string;
}

export interface CalendarProvider {
    name: string;
    type: 'google' | 'apple' | 'outlook';
    isConfigured(): Promise<boolean>;
    getEvents(date: string): Promise<CalendarEvent[]>;                              // YYYY-MM-DD
    getEventsRange(start: string, end: string): Promise<CalendarEvent[]>;
    createEvent(event: Omit<CalendarEvent, 'id' | 'provider'>): Promise<CalendarEvent>;
    updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent>;
    deleteEvent(id: string): Promise<boolean>;
}
