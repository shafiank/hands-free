'use server';

import fs from 'fs';
import path from 'path';

// â”€â”€â”€ twitter-api-v2 client factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Used specifically for media uploads which require the Twitter v1.1 chunked
// upload API â€” something that cannot be trivially replicated with raw OAuth
// signing because it involves multi-step chunked upload sequences.
async function getTwitterApiClient(config: TwitterConfig) {
    const { TwitterApi } = await import('twitter-api-v2');
    return new TwitterApi({
        appKey: config.apiKey,
        appSecret: config.apiSecret,
        accessToken: config.accessToken,
        accessSecret: config.accessSecret,
    });
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface TwitterConfig {
    apiKey: string;           // OAuth 1.0a Consumer Key (API Key)
    apiSecret: string;        // OAuth 1.0a Consumer Secret (API Secret)
    accessToken: string;      // OAuth 1.0a Access Token
    accessSecret: string;     // OAuth 1.0a Access Token Secret
    mode: 'send_only' | 'read_write' | 'full_autonomous';
    autoPost: boolean;        // Allow Hands Free to post proactively
}

export interface TwitterResult {
    success: boolean;
    data?: any;
    error?: string;
}

// â”€â”€â”€ Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { DATA_DIR } from '@/lib/paths';
const CONFIG_FILE = path.join(DATA_DIR, 'integrations', 'twitter.json');

function ensureDirs() {
    const dir = path.join(DATA_DIR, 'integrations');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function loadTwitterConfig(): Promise<TwitterConfig | null> {
    try {
        ensureDirs();
        if (!fs.existsSync(CONFIG_FILE)) return null;
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch {
        return null;
    }
}

export async function saveTwitterConfig(config: TwitterConfig): Promise<{ success: boolean; error?: string }> {
    try {
        ensureDirs();
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteTwitterConfig(): Promise<{ success: boolean }> {
    try {
        if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
        return { success: true };
    } catch {
        return { success: false };
    }
}

// â”€â”€â”€ OAuth 1.0a Signing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Twitter API v2 requires OAuth 1.0a for user-context endpoints.
// We implement it in pure Node.js without external dependencies.

function generateOAuthNonce(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function percentEncode(str: string): string {
    return encodeURIComponent(str)
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A');
}

async function signRequest(
    method: string,
    url: string,
    params: Record<string, string>,
    config: TwitterConfig
): Promise<string> {
    const { createHmac } = await import('crypto');

    const oauthTimestamp = Math.floor(Date.now() / 1000).toString();
    const oauthNonce = generateOAuthNonce();

    const oauthParams: Record<string, string> = {
        oauth_consumer_key: config.apiKey,
        oauth_nonce: oauthNonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: oauthTimestamp,
        oauth_token: config.accessToken,
        oauth_version: '1.0',
    };

    // Combine all params for signature base
    const allParams = { ...params, ...oauthParams };
    const sortedParams = Object.entries(allParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
        .join('&');

    const baseString = [
        method.toUpperCase(),
        percentEncode(url),
        percentEncode(sortedParams),
    ].join('&');

    const signingKey = `${percentEncode(config.apiSecret)}&${percentEncode(config.accessSecret)}`;
    const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

    oauthParams.oauth_signature = signature;

    const authHeader = 'OAuth ' + Object.entries(oauthParams)
        .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
        .join(', ');

    return authHeader;
}

// â”€â”€â”€ API Calls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TWITTER_API_BASE = 'https://api.twitter.com/2';

/**
 * Post a tweet. Returns the tweet ID on success.
 */
export async function postTweet(text: string, replyToId?: string): Promise<TwitterResult> {
    try {
        const config = await loadTwitterConfig();
        if (!config?.apiKey || !config?.accessToken) {
            return { success: false, error: 'Twitter not configured. Add API keys in Settings â†’ Twitter/X.' };
        }

        const url = `${TWITTER_API_BASE}/tweets`;
        const body: any = { text };
        if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };

        const authHeader = await signRequest('POST', url, {}, config);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
            return { success: false, error: data.detail || data.errors?.[0]?.message || `HTTP ${res.status}` };
        }

        return { success: true, data: { id: data.data?.id, text: data.data?.text } };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Read recent mentions for the authenticated user.
 */
export async function readMentions(maxResults = 10): Promise<TwitterResult> {
    try {
        const config = await loadTwitterConfig();
        if (!config?.apiKey || !config?.accessToken) {
            return { success: false, error: 'Twitter not configured.' };
        }
        if (config.mode === 'send_only') {
            return { success: false, error: 'Reading mentions requires Read & Write or Full Autonomous mode.' };
        }

        // First get authenticated user ID
        const meUrl = `${TWITTER_API_BASE}/users/me`;
        const meAuth = await signRequest('GET', meUrl, {}, config);
        const meRes = await fetch(meUrl, { headers: { 'Authorization': meAuth } });
        const meData = await meRes.json();
        const userId = meData.data?.id;
        if (!userId) return { success: false, error: 'Could not fetch user ID.' };

        // Get mentions
        const mentionsUrl = `${TWITTER_API_BASE}/users/${userId}/mentions`;
        const params = { max_results: String(maxResults), 'tweet.fields': 'created_at,author_id,text' };
        const mentionsAuth = await signRequest('GET', mentionsUrl, params, config);
        const urlWithParams = `${mentionsUrl}?${new URLSearchParams(params).toString()}`;
        const mentionsRes = await fetch(urlWithParams, { headers: { 'Authorization': mentionsAuth } });
        const mentionsData = await mentionsRes.json();

        if (!mentionsRes.ok) {
            return { success: false, error: mentionsData.detail || `HTTP ${mentionsRes.status}` };
        }

        return { success: true, data: mentionsData.data || [] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Read home timeline (recent tweets from followed accounts).
 */
export async function readTimeline(maxResults = 10): Promise<TwitterResult> {
    try {
        const config = await loadTwitterConfig();
        if (!config?.apiKey || !config?.accessToken) {
            return { success: false, error: 'Twitter not configured.' };
        }
        if (config.mode === 'send_only') {
            return { success: false, error: 'Reading timeline requires Read & Write or Full Autonomous mode.' };
        }

        const meUrl = `${TWITTER_API_BASE}/users/me`;
        const meAuth = await signRequest('GET', meUrl, {}, config);
        const meRes = await fetch(meUrl, { headers: { 'Authorization': meAuth } });
        const meData = await meRes.json();
        const userId = meData.data?.id;
        if (!userId) return { success: false, error: 'Could not fetch user ID.' };

        const timelineUrl = `${TWITTER_API_BASE}/users/${userId}/timelines/reverse_chronological`;
        const params = { max_results: String(maxResults), 'tweet.fields': 'created_at,author_id,text', expansions: 'author_id', 'user.fields': 'username,name' };
        const tlAuth = await signRequest('GET', timelineUrl, params, config);
        const urlWithParams = `${timelineUrl}?${new URLSearchParams(params).toString()}`;
        const tlRes = await fetch(urlWithParams, { headers: { 'Authorization': tlAuth } });
        const tlData = await tlRes.json();

        if (!tlRes.ok) {
            return { success: false, error: tlData.detail || `HTTP ${tlRes.status}` };
        }

        return { success: true, data: tlData.data || [] };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Reply to a specific tweet.
 */
export async function replyToTweet(tweetId: string, text: string): Promise<TwitterResult> {
    return postTweet(text, tweetId);
}

/**
 * Verify credentials â€” returns account username if valid.
 */
export async function verifyTwitterCredentials(): Promise<TwitterResult> {
    try {
        const config = await loadTwitterConfig();
        if (!config?.apiKey || !config?.accessToken) {
            return { success: false, error: 'No credentials configured.' };
        }

        const url = `${TWITTER_API_BASE}/users/me`;
        const authHeader = await signRequest('GET', url, {}, config);
        const res = await fetch(url, { headers: { 'Authorization': authHeader } });
        const data = await res.json();

        if (!res.ok) {
            return { success: false, error: data.detail || data.errors?.[0]?.message || `HTTP ${res.status}` };
        }

        return { success: true, data: { username: data.data?.username, name: data.data?.name, id: data.data?.id } };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Post a tweet with an attached media file (image or video).
 *
 * Replaces the previously broken Python/tweepy-based approach.
 * Uses twitter-api-v2 (pure Node.js):
 *   1. v1Client.uploadMedia()  â€” Twitter v1.1 chunked media upload
 *   2. v2Client.tweet()        â€” Twitter v2 tweet creation with media_ids
 *
 * @param text      Tweet text (up to 280 chars)
 * @param mediaPath Absolute local file path of the image/video to attach
 * @param mimeType  Optional MIME type override (e.g. 'image/png', 'video/mp4').
 *                  If omitted, twitter-api-v2 auto-detects from the file extension.
 */
export async function postTweetWithMedia(
    text: string,
    mediaPath: string,
    mimeType?: string,
): Promise<TwitterResult> {
    try {
        const config = await loadTwitterConfig();
        if (!config?.apiKey || !config?.accessToken) {
            return { success: false, error: 'Twitter not configured. Add API keys in Settings â†’ Twitter/X.' };
        }

        if (!fs.existsSync(mediaPath)) {
            return { success: false, error: `Media file not found: ${mediaPath}` };
        }

        // Build the twitter-api-v2 client (OAuth 1.0a user context)
        const client = await getTwitterApiClient(config);

        // Step 1 â€” Upload media via Twitter v1.1 (chunked upload, handles large files)
        const uploadOptions = mimeType ? { mimeType } : {};
        const mediaId = await client.v1.uploadMedia(mediaPath, uploadOptions);

        // Step 2 â€” Create tweet with the uploaded media_id
        const tweet = await client.v2.tweet({
            text,
            media: { media_ids: [mediaId] },
        });

        return {
            success: true,
            data: { id: tweet.data?.id, text: tweet.data?.text, mediaId },
        };
    } catch (e: any) {
        // twitter-api-v2 wraps API errors in ApiResponseError
        const apiError = e?.data?.detail ?? e?.data?.errors?.[0]?.message;
        return { success: false, error: apiError || e.message };
    }
}
