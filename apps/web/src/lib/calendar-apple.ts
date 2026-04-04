/**
 * Apple Calendar Provider (CalDAV / iCloud)
 * Implements CalDAV protocol (RFC 4791) with raw HTTP requests â€” no npm packages needed.
 * Apple Calendar / iCloud uses CalDAV at https://caldav.icloud.com/
 * Requires an App-Specific Password (generated at appleid.apple.com â†’ Security).
 * Hands Free v7 â€” Session 13
 */

import { CalendarProvider, CalendarEvent } from './calendar-provider';
import crypto from 'crypto';

export interface AppleCalendarConfig {
    caldavUrl: string;      // https://caldav.icloud.com/  (default for iCloud)
    username: string;       // Apple ID email
    password: string;       // App-specific password (NOT Apple ID password)
}

export class AppleCalendarProvider implements CalendarProvider {
    name = 'Apple Calendar';
    type = 'apple' as const;
    private caldavUrl: string;
    private username: string;
    private password: string;

    constructor(config: AppleCalendarConfig) {
        // Ensure trailing slash on CalDAV URL
        this.caldavUrl = config.caldavUrl.endsWith('/') ? config.caldavUrl : config.caldavUrl + '/';
        this.username = config.username;
        this.password = config.password;
    }

    async isConfigured(): Promise<boolean> {
        return !!(this.caldavUrl && this.username && this.password);
    }

    async getEvents(date: string): Promise<CalendarEvent[]> {
        const start = `${date}T00:00:00Z`;
        const end = `${date}T23:59:59Z`;
        return this.getEventsRange(start, end);
    }

    async getEventsRange(start: string, end: string): Promise<CalendarEvent[]> {
        const body = `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${formatCalDAVDate(start)}" end="${formatCalDAVDate(end)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

        const response = await fetch(this.caldavUrl, {
            method: 'REPORT',
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Depth': '1',
                'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64'),
            },
            body,
        });

        if (!response.ok) throw new Error(`CalDAV error: ${response.status} ${response.statusText}`);

        const xml = await response.text();
        return parseCalDAVResponse(xml);
    }

    async createEvent(event: Omit<CalendarEvent, 'id' | 'provider'>): Promise<CalendarEvent> {
        const uid = crypto.randomUUID();
        const ical = buildICalEvent(uid, event);

        const response = await fetch(`${this.caldavUrl}${uid}.ics`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64'),
                'If-None-Match': '*',
            },
            body: ical,
        });

        if (!response.ok) throw new Error(`CalDAV create error: ${response.status} ${response.statusText}`);

        return {
            ...event,
            id: uid,
            provider: 'apple',
            editable: true,
        };
    }

    async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
        // CalDAV update: GET existing â†’ modify â†’ PUT back with ETag
        const getResponse = await fetch(`${this.caldavUrl}${id}.ics`, {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64'),
            },
        });

        if (!getResponse.ok) throw new Error(`CalDAV get error: ${getResponse.status}`);

        const existingIcal = await getResponse.text();
        const etag = getResponse.headers.get('ETag') || '*';

        // Parse existing event and apply updates
        let modifiedIcal = existingIcal;
        if (updates.title) {
            modifiedIcal = modifiedIcal.replace(/SUMMARY:.*/, `SUMMARY:${updates.title}`);
        }
        if (updates.startTime) {
            const dtstart = updates.startTime.replace(/[-:]/g, '').replace('.000', '');
            modifiedIcal = modifiedIcal.replace(/DTSTART[^:]*:.*/, `DTSTART:${dtstart}`);
        }
        if (updates.endTime) {
            const dtend = updates.endTime.replace(/[-:]/g, '').replace('.000', '');
            modifiedIcal = modifiedIcal.replace(/DTEND[^:]*:.*/, `DTEND:${dtend}`);
        }
        if (updates.description !== undefined) {
            if (modifiedIcal.includes('DESCRIPTION:')) {
                modifiedIcal = modifiedIcal.replace(/DESCRIPTION:.*/, `DESCRIPTION:${updates.description}`);
            } else {
                modifiedIcal = modifiedIcal.replace('END:VEVENT', `DESCRIPTION:${updates.description}\r\nEND:VEVENT`);
            }
        }
        if (updates.location !== undefined) {
            if (modifiedIcal.includes('LOCATION:')) {
                modifiedIcal = modifiedIcal.replace(/LOCATION:.*/, `LOCATION:${updates.location}`);
            } else {
                modifiedIcal = modifiedIcal.replace('END:VEVENT', `LOCATION:${updates.location}\r\nEND:VEVENT`);
            }
        }

        const putResponse = await fetch(`${this.caldavUrl}${id}.ics`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64'),
                'If-Match': etag,
            },
            body: modifiedIcal,
        });

        if (!putResponse.ok) throw new Error(`CalDAV update error: ${putResponse.status}`);

        // Parse the updated event back
        const parsed = parseICalString(modifiedIcal);
        return {
            id,
            title: updates.title || parsed.title || 'Untitled',
            description: updates.description ?? parsed.description,
            startTime: updates.startTime || parsed.startTime || '',
            endTime: updates.endTime || parsed.endTime || '',
            allDay: parsed.allDay || false,
            location: updates.location ?? parsed.location,
            provider: 'apple',
            editable: true,
        };
    }

    async deleteEvent(id: string): Promise<boolean> {
        const response = await fetch(`${this.caldavUrl}${id}.ics`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64'),
            },
        });
        return response.ok || response.status === 204;
    }
}

// â”€â”€â”€ Helper: format date for CalDAV (YYYYMMDDTHHmmssZ) â”€â”€â”€â”€â”€â”€â”€â”€
function formatCalDAVDate(iso: string): string {
    // Accept ISO 8601 â†’ convert to CalDAV format
    const clean = iso.replace(/[-:]/g, '').replace('.000', '');
    // Ensure Z suffix
    return clean.endsWith('Z') ? clean : clean + 'Z';
}

// â”€â”€â”€ Helper: parse CalDAV XML multistatus response â†’ CalendarEvent[] â”€â”€
function parseCalDAVResponse(xml: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    // CalDAV returns XML with embedded iCalendar (VCALENDAR/VEVENT) data
    const calDataBlocks = xml.match(/<C:calendar-data[^>]*>([\s\S]*?)<\/C:calendar-data>/gi)
        || xml.match(/<cal:calendar-data[^>]*>([\s\S]*?)<\/cal:calendar-data>/gi)
        || [];

    for (const block of calDataBlocks) {
        // Strip XML tags to get raw iCalendar text
        const ical = block.replace(/<[^>]+>/g, '').trim();
        const parsed = parseICalString(ical);
        if (parsed.startTime) {
            events.push({
                id: parsed.uid || crypto.randomUUID(),
                title: parsed.title || 'Untitled',
                description: parsed.description,
                startTime: parsed.startTime,
                endTime: parsed.endTime || parsed.startTime,
                allDay: parsed.allDay || false,
                location: parsed.location,
                provider: 'apple',
                editable: true,
            });
        }
    }
    return events;
}

// â”€â”€â”€ Helper: parse single iCalendar string â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface ParsedICal {
    uid?: string;
    title?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    allDay?: boolean;
    location?: string;
}

function parseICalString(ical: string): ParsedICal {
    const summary = ical.match(/SUMMARY:(.*)/)?.[1]?.trim();
    const dtstart = ical.match(/DTSTART[^:]*:(.*)/)?.[1]?.trim();
    const dtend = ical.match(/DTEND[^:]*:(.*)/)?.[1]?.trim();
    const uid = ical.match(/UID:(.*)/)?.[1]?.trim();
    const location = ical.match(/LOCATION:(.*)/)?.[1]?.trim();
    const description = ical.match(/DESCRIPTION:(.*)/)?.[1]?.trim();

    return {
        uid,
        title: summary,
        description,
        startTime: dtstart ? parseICalDate(dtstart) : undefined,
        endTime: dtend ? parseICalDate(dtend) : undefined,
        allDay: dtstart ? dtstart.length === 8 : false,
        location,
    };
}

// â”€â”€â”€ Helper: parse iCalendar date format â†’ ISO string â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function parseICalDate(ical: string): string {
    // 20260319T100000Z â†’ 2026-03-19T10:00:00Z
    // 20260319 â†’ 2026-03-19 (all-day)
    if (ical.length === 8) {
        return `${ical.slice(0, 4)}-${ical.slice(4, 6)}-${ical.slice(6, 8)}`;
    }
    const clean = ical.replace('Z', '');
    if (clean.length >= 15) {
        return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}Z`;
    }
    return ical; // Return as-is if format is unknown
}

// â”€â”€â”€ Helper: build iCalendar event string â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildICalEvent(uid: string, event: Omit<CalendarEvent, 'id' | 'provider'>): string {
    const now = new Date().toISOString().replace(/[-:]/g, '').replace('.000', '').slice(0, 15) + 'Z';

    let dtstart: string;
    let dtend: string;

    if (event.allDay) {
        // All-day events use VALUE=DATE format: YYYYMMDD
        dtstart = event.startTime.replace(/-/g, '').slice(0, 8);
        dtend = event.endTime.replace(/-/g, '').slice(0, 8);
    } else {
        dtstart = event.startTime.replace(/[-:]/g, '').replace('.000', '');
        dtend = event.endTime.replace(/[-:]/g, '').replace('.000', '');
        if (!dtstart.endsWith('Z')) dtstart += 'Z';
        if (!dtend.endsWith('Z')) dtend += 'Z';
    }

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Hands Free//v7//EN',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        event.allDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`,
        event.allDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`,
        `SUMMARY:${event.title}`,
    ];

    if (event.description) lines.push(`DESCRIPTION:${event.description}`);
    if (event.location) lines.push(`LOCATION:${event.location}`);

    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n');
}
