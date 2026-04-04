/**
 * Outlook Calendar Provider (Microsoft Graph API)
 * Uses OAuth 2.0 with Azure AD for authentication.
 * Microsoft Graph endpoint: https://graph.microsoft.com/v1.0
 * Required scopes: Calendars.ReadWrite, User.Read
 * Hands Free v7 â€” Session 13
 */

import { CalendarProvider, CalendarEvent } from './calendar-provider';
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './paths';

const OUTLOOK_TOKEN_FILE = path.join(DATA_DIR, 'integrations', 'outlook-calendar.json');
const GRAPH_URL = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

export interface OutlookCalendarConfig {
    clientId: string;
    clientSecret?: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiry: number;        // Unix timestamp ms
    tenantId?: string;          // default: 'common'
}

export class OutlookCalendarProvider implements CalendarProvider {
    name = 'Outlook Calendar';
    type = 'outlook' as const;
    private config: OutlookCalendarConfig | null = null;

    constructor() {
        this.loadConfig();
    }

    private loadConfig(): void {
        try {
            if (fs.existsSync(OUTLOOK_TOKEN_FILE)) {
                this.config = JSON.parse(fs.readFileSync(OUTLOOK_TOKEN_FILE, 'utf-8'));
            }
        } catch {
            this.config = null;
        }
    }

    private saveConfig(): void {
        try {
            const dir = path.dirname(OUTLOOK_TOKEN_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(OUTLOOK_TOKEN_FILE, JSON.stringify(this.config, null, 2));
        } catch { /* best-effort */ }
    }

    async isConfigured(): Promise<boolean> {
        this.loadConfig();
        return !!(this.config?.accessToken && this.config?.refreshToken);
    }

    async getEvents(date: string): Promise<CalendarEvent[]> {
        const start = `${date}T00:00:00`;
        const end = `${date}T23:59:59`;
        return this.getEventsRange(start, end);
    }

    async getEventsRange(start: string, end: string): Promise<CalendarEvent[]> {
        await this.ensureValidToken();

        const params = new URLSearchParams({
            startDateTime: start,
            endDateTime: end,
            $select: 'id,subject,start,end,location,bodyPreview,isAllDay',
            $orderby: 'start/dateTime',
            $top: '50',
        });

        const response = await fetch(`${GRAPH_URL}/me/calendarview?${params}`, {
            headers: { 'Authorization': `Bearer ${this.config!.accessToken}` },
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Graph API error: ${response.status} â€” ${errText.slice(0, 200)}`);
        }

        const data = await response.json();
        return (data.value || []).map((e: any) => this.mapGraphEvent(e));
    }

    async createEvent(event: Omit<CalendarEvent, 'id' | 'provider'>): Promise<CalendarEvent> {
        await this.ensureValidToken();

        const body: Record<string, any> = {
            subject: event.title,
            body: { contentType: 'Text', content: event.description || '' },
            start: { dateTime: event.startTime, timeZone: 'UTC' },
            end: { dateTime: event.endTime, timeZone: 'UTC' },
            isAllDay: event.allDay,
        };
        if (event.location) body.location = { displayName: event.location };

        const response = await fetch(`${GRAPH_URL}/me/events`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config!.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Graph API create error: ${response.status} â€” ${errText.slice(0, 200)}`);
        }

        const created = await response.json();
        return this.mapGraphEvent(created);
    }

    async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
        await this.ensureValidToken();

        const body: Record<string, any> = {};
        if (updates.title) body.subject = updates.title;
        if (updates.description !== undefined) body.body = { contentType: 'Text', content: updates.description };
        if (updates.startTime) body.start = { dateTime: updates.startTime, timeZone: 'UTC' };
        if (updates.endTime) body.end = { dateTime: updates.endTime, timeZone: 'UTC' };
        if (updates.location !== undefined) body.location = { displayName: updates.location };

        const response = await fetch(`${GRAPH_URL}/me/events/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${this.config!.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Graph API update error: ${response.status} â€” ${errText.slice(0, 200)}`);
        }

        const updated = await response.json();
        return this.mapGraphEvent(updated);
    }

    async deleteEvent(id: string): Promise<boolean> {
        await this.ensureValidToken();

        const response = await fetch(`${GRAPH_URL}/me/events/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.config!.accessToken}` },
        });

        return response.ok || response.status === 204;
    }

    // â”€â”€â”€ OAuth Token Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    private async ensureValidToken(): Promise<void> {
        if (!this.config) {
            this.loadConfig();
            if (!this.config) throw new Error('Outlook Calendar not configured');
        }

        // Token still valid (with 60s buffer)
        if (this.config.tokenExpiry && Date.now() < this.config.tokenExpiry - 60_000) {
            return;
        }

        // Refresh the token
        if (!this.config.refreshToken || !this.config.clientId) {
            throw new Error('Cannot refresh Outlook token â€” missing refresh token or client ID');
        }

        const params: Record<string, string> = {
            client_id: this.config.clientId,
            refresh_token: this.config.refreshToken,
            grant_type: 'refresh_token',
            scope: 'Calendars.ReadWrite User.Read offline_access',
        };
        if (this.config.clientSecret) {
            params.client_secret = this.config.clientSecret;
        }

        const resp = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params),
        });

        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            throw new Error(`Outlook token refresh failed: ${resp.status} â€” ${errText.slice(0, 200)}`);
        }

        const data = await resp.json();
        this.config.accessToken = data.access_token;
        this.config.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
        if (data.refresh_token) this.config.refreshToken = data.refresh_token;
        this.saveConfig();
    }

    // â”€â”€â”€ Internal: map Graph API event â†’ unified CalendarEvent â”€â”€
    private mapGraphEvent(e: any): CalendarEvent {
        return {
            id: e.id || '',
            title: e.subject || 'Untitled',
            description: e.bodyPreview || e.body?.content,
            startTime: e.start?.dateTime || '',
            endTime: e.end?.dateTime || '',
            allDay: e.isAllDay || false,
            location: e.location?.displayName,
            provider: 'outlook',
            editable: true,
        };
    }
}

// â”€â”€â”€ OAuth helpers (used by Settings UI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function getOutlookAuthUrl(clientId: string): string {
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        scope: 'Calendars.ReadWrite User.Read offline_access',
        response_mode: 'query',
        prompt: 'consent',
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeOutlookAuthCode(
    code: string,
    clientId: string,
    clientSecret?: string,
): Promise<{ success: boolean; error?: string }> {
    const params: Record<string, string> = {
        client_id: clientId,
        code,
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        grant_type: 'authorization_code',
        scope: 'Calendars.ReadWrite User.Read offline_access',
    };
    if (clientSecret) params.client_secret = clientSecret;

    const resp = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        return { success: false, error: `Token exchange failed: ${errText.slice(0, 200)}` };
    }

    const data = await resp.json();

    // Save tokens
    const config: OutlookCalendarConfig = {
        clientId,
        clientSecret,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenExpiry: Date.now() + (data.expires_in || 3600) * 1000,
    };

    const dir = path.dirname(OUTLOOK_TOKEN_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(OUTLOOK_TOKEN_FILE, JSON.stringify(config, null, 2));

    return { success: true };
}

export async function deleteOutlookConfig(): Promise<void> {
    try {
        if (fs.existsSync(OUTLOOK_TOKEN_FILE)) fs.unlinkSync(OUTLOOK_TOKEN_FILE);
    } catch { /* ignore */ }
}

export async function testOutlookConnection(): Promise<{ success: boolean; error?: string }> {
    try {
        const provider = new OutlookCalendarProvider();
        if (!(await provider.isConfigured())) {
            return { success: false, error: 'Outlook Calendar not configured' };
        }
        const today = new Date().toISOString().split('T')[0];
        await provider.getEvents(today);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
