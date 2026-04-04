'use server';

import * as fs from 'fs';
import * as path from 'path';

import { DATA_DIR } from '@/lib/paths';
const CALENDAR_FILE = path.join(DATA_DIR, 'integrations', 'calendar.json');

export interface CalendarConfig {
    // Read-only mode: API Key only
    apiKey?: string;
    calendarId?: string;    // default: 'primary'
    // OAuth mode: full read/write
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    accessToken?: string;
    tokenExpiry?: number;
    savedAt?: number;
}

export interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    location?: string;
    htmlLink?: string;
}

function ensureDirs() {
    const intDir = path.join(DATA_DIR, 'integrations');
    if (!fs.existsSync(intDir)) fs.mkdirSync(intDir, { recursive: true });
}

export async function loadCalendarConfig(): Promise<CalendarConfig | null> {
    ensureDirs();
    try {
        if (fs.existsSync(CALENDAR_FILE)) {
            return JSON.parse(fs.readFileSync(CALENDAR_FILE, 'utf-8'));
        }
    } catch { }
    return null;
}

export async function saveCalendarConfig(config: Omit<CalendarConfig, 'savedAt'>): Promise<{ success: boolean; error?: string }> {
    ensureDirs();
    try {
        const existing = await loadCalendarConfig();
        const toSave: CalendarConfig = { ...existing, ...config, savedAt: Date.now() };
        fs.writeFileSync(CALENDAR_FILE, JSON.stringify(toSave, null, 2));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteCalendarConfig(): Promise<{ success: boolean }> {
    try {
        if (fs.existsSync(CALENDAR_FILE)) fs.unlinkSync(CALENDAR_FILE);
        return { success: true };
    } catch { return { success: true }; }
}

// ─── Internal: resolve access token ──────────────────────────
async function resolveToken(config: CalendarConfig): Promise<{ token: string; mode: 'apikey' | 'oauth' } | null> {
    if (config.apiKey && !config.clientId) {
        return { token: config.apiKey, mode: 'apikey' };
    }
    // OAuth: check if still valid
    if (config.accessToken && config.tokenExpiry && Date.now() < config.tokenExpiry - 60_000) {
        return { token: config.accessToken, mode: 'oauth' };
    }
    // Refresh
    if (!config.refreshToken || !config.clientId || !config.clientSecret) return null;
    try {
        const resp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                refresh_token: config.refreshToken,
                grant_type: 'refresh_token',
            }),
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        await saveCalendarConfig({ ...config, accessToken: data.access_token, tokenExpiry: Date.now() + data.expires_in * 1000 });
        return { token: data.access_token, mode: 'oauth' };
    } catch { return null; }
}

// ─── List events ──────────────────────────────────────────────
export async function listCalendarEvents(daysAhead: number = 7): Promise<{ success: boolean; events?: CalendarEvent[]; error?: string }> {
    try {
        const config = await loadCalendarConfig();
        if (!config) return { success: false, error: 'Google Calendar not configured. Go to Settings → Skills → Google Calendar.' };
        const calId = encodeURIComponent(config.calendarId || 'primary');
        const now = new Date().toISOString();
        const future = new Date(Date.now() + daysAhead * 86_400_000).toISOString();
        const tokenResult = await resolveToken(config);
        if (!tokenResult) return { success: false, error: 'Could not get Google access token. Please reconfigure in Settings → Skills → Google Calendar.' };
        let url: string;
        const headers: Record<string, string> = {};
        if (tokenResult.mode === 'apikey') {
            url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?key=${tokenResult.token}&timeMin=${now}&timeMax=${future}&orderBy=startTime&singleEvents=true&maxResults=20`;
        } else {
            url = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${now}&timeMax=${future}&orderBy=startTime&singleEvents=true&maxResults=20`;
            headers['Authorization'] = `Bearer ${tokenResult.token}`;
        }
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
            const err = await resp.text();
            return { success: false, error: `Calendar API (${resp.status}): ${err.slice(0, 200)}` };
        }
        const data = await resp.json();
        return { success: true, events: data.items || [] };
    } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── Create event ─────────────────────────────────────────────
export async function createCalendarEvent(
    summary: string,
    startDateTime: string,
    endDateTime: string,
    description?: string,
    location?: string,
): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
    try {
        const config = await loadCalendarConfig();
        if (!config) return { success: false, error: 'Google Calendar not configured.' };
        const tokenResult = await resolveToken(config);
        if (!tokenResult || tokenResult.mode === 'apikey') {
            return { success: false, error: 'Creating events requires OAuth (not just an API key). Set up OAuth in Settings → Skills → Google Calendar.' };
        }
        const calId = encodeURIComponent(config.calendarId || 'primary');
        const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenResult.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary, description, location, start: { dateTime: startDateTime }, end: { dateTime: endDateTime } }),
        });
        if (!resp.ok) {
            const err = await resp.text();
            return { success: false, error: `Failed to create event (${resp.status}): ${err.slice(0, 200)}` };
        }
        const event = await resp.json();
        return { success: true, event };
    } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── Update event ─────────────────────────────────────────────
export async function updateCalendarEvent(
    eventId: string,
    updates: {
        summary?: string;
        startDateTime?: string;
        endDateTime?: string;
        description?: string;
        location?: string;
    },
): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
    try {
        const config = await loadCalendarConfig();
        if (!config) return { success: false, error: 'Google Calendar not configured.' };
        const tokenResult = await resolveToken(config);
        if (!tokenResult || tokenResult.mode === 'apikey') {
            return { success: false, error: 'Updating events requires OAuth authentication. Set up OAuth in Settings → Skills → Google Calendar.' };
        }
        const calId = encodeURIComponent(config.calendarId || 'primary');
        // Build partial update body — only include fields that were provided
        const body: Record<string, any> = {};
        if (updates.summary) body.summary = updates.summary;
        if (updates.description !== undefined) body.description = updates.description;
        if (updates.location !== undefined) body.location = updates.location;
        if (updates.startDateTime) body.start = { dateTime: updates.startDateTime };
        if (updates.endDateTime) body.end = { dateTime: updates.endDateTime };
        const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${tokenResult.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const err = await resp.text();
            return { success: false, error: `Failed to update event (${resp.status}): ${err.slice(0, 200)}` };
        }
        const event = await resp.json();
        return { success: true, event };
    } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── Delete event ─────────────────────────────────────────────
export async function deleteCalendarEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const config = await loadCalendarConfig();
        if (!config) return { success: false, error: 'Google Calendar not configured.' };
        const tokenResult = await resolveToken(config);
        if (!tokenResult || tokenResult.mode === 'apikey') {
            return { success: false, error: 'Deleting events requires OAuth authentication.' };
        }
        const calId = encodeURIComponent(config.calendarId || 'primary');
        const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${tokenResult.token}` },
        });
        if (!resp.ok && resp.status !== 204) {
            const err = await resp.text();
            return { success: false, error: `Failed to delete event (${resp.status}): ${err.slice(0, 200)}` };
        }
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── OAuth helpers ────────────────────────────────────────────
export async function getCalendarAuthUrl(clientId: string): Promise<string> {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar',
        access_type: 'offline',
        prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCalendarAuthCode(
    code: string,
    clientId: string,
    clientSecret: string,
): Promise<{ success: boolean; refreshToken?: string; accessToken?: string; tokenExpiry?: number; error?: string }> {
    try {
        const resp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
                grant_type: 'authorization_code',
            }),
        });
        if (!resp.ok) {
            const err = await resp.text();
            return { success: false, error: `Token exchange failed: ${err.slice(0, 200)}` };
        }
        const data = await resp.json();
        return {
            success: true,
            refreshToken: data.refresh_token,
            accessToken: data.access_token,
            tokenExpiry: Date.now() + data.expires_in * 1000,
        };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function testCalendarConnection(): Promise<{ success: boolean; eventCount?: number; error?: string }> {
    const result = await listCalendarEvents(14);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, eventCount: result.events?.length ?? 0 };
}
