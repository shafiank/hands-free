/**
 * POST /api/voice/transcribe
 *
 * Accepts a multipart/form-data audio blob and returns the transcript.
 *
 * Provider selection (in order of preference):
 *   1. Groq   — groq/whisper-large-v3  (fastest, free tier)
 *   2. OpenAI — whisper-1              (most accurate)
 *   3. OpenRouter — with whisper model
 *
 * Request body (multipart/form-data):
 *   audio    : Blob   — audio file (webm/ogg/mp4/wav/mp3)
 *   language : string — optional BCP-47 language code, e.g. "en"
 *   provider : string — optional override: "groq" | "openai" | "openrouter"
 *
 * Response:
 *   { success: true, text: string }
 *   { success: false, error: string }
 */
import { NextResponse }               from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { loadSettings }               from '@/actions/chat';

export const dynamic    = 'force-dynamic';
export const revalidate = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TranscriptionOptions {
    audioBuffer: Buffer;
    mimeType:    string;
    language?:   string;
    provider:    string;
    apiKey:      string;
}

/** Call Groq Whisper API */
async function transcribeGroq(opts: TranscriptionOptions): Promise<string> {
    const form = new FormData();
    form.append('file',  new Blob([opts.audioBuffer.buffer as ArrayBuffer], { type: opts.mimeType }), 'audio.webm');
    form.append('model', 'whisper-large-v3');
    if (opts.language) form.append('language', opts.language);
    form.append('response_format', 'json');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method:  'POST',
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        body:    form,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq transcription error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return (data.text ?? '').trim();
}

/** Call OpenAI Whisper API */
async function transcribeOpenAI(opts: TranscriptionOptions): Promise<string> {
    const form = new FormData();
    form.append('file',  new Blob([opts.audioBuffer.buffer as ArrayBuffer], { type: opts.mimeType }), 'audio.webm');
    form.append('model', 'whisper-1');
    if (opts.language) form.append('language', opts.language);
    form.append('response_format', 'json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method:  'POST',
        headers: { Authorization: `Bearer ${opts.apiKey}` },
        body:    form,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI transcription error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return (data.text ?? '').trim();
}

/** Call local STT endpoint (OpenAI-compatible) */
async function transcribeLocal(opts: { audioBuffer: Buffer; mimeType: string; localUrl: string }): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([opts.audioBuffer.buffer as ArrayBuffer], { type: opts.mimeType }), 'audio.webm');
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');

    const res = await fetch(opts.localUrl, {
        method: 'POST',
        body: form,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Local STT error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return (data.text ?? '').trim();
}

/** Determine which provider + key to use, then call the right API */
async function transcribeAudio(opts: {
    audioBuffer: Buffer;
    mimeType:    string;
    language?:   string;
    preferredProvider?: string;
}): Promise<string> {
    const settings = await loadSettings();
    const providers = settings.providers ?? {};
    const localSttUrl = (settings as any).localSttUrl as string | undefined;

    // Try local STT first if configured
    if (localSttUrl && localSttUrl.trim()) {
        try {
            return await transcribeLocal({ audioBuffer: opts.audioBuffer, mimeType: opts.mimeType, localUrl: localSttUrl });
        } catch (err) {
            console.error('[voice/transcribe] Local STT failed:', err);
            // Fall through to cloud providers
        }
    }

    // Priority order: user preference → groq → openai → openrouter
    const order: Array<'groq' | 'openai' | 'openrouter'> = opts.preferredProvider
        ? [opts.preferredProvider as any, 'groq', 'openai', 'openrouter']
        : ['groq', 'openai', 'openrouter'];

    const seen = new Set<string>();
    for (const p of order) {
        if (seen.has(p)) continue;
        seen.add(p);
        const cfg = providers[p as keyof typeof providers];
        if (!cfg?.apiKey) continue;

        const baseOpts: TranscriptionOptions = {
            audioBuffer: opts.audioBuffer,
            mimeType:    opts.mimeType,
            language:    opts.language,
            provider:    p,
            apiKey:      cfg.apiKey,
        };

        try {
            if (p === 'groq')       return await transcribeGroq(baseOpts);
            if (p === 'openai')     return await transcribeOpenAI(baseOpts);
            if (p === 'openrouter') return await transcribeOpenAI({ ...baseOpts, apiKey: cfg.apiKey });
        } catch (err) {
            // Try next provider
            console.error(`[voice/transcribe] ${p} failed:`, err);
        }
    }

    throw new Error(
        'No speech-to-text provider available. Please configure a local STT URL in Settings, or set up a Groq/OpenAI API key.',
    );
}

// ─── Route handler ─────────────────────────────────────────────────────────────

// Allow up to 60s for slow transcription providers
export const maxDuration = 60;

export async function POST(req: Request) {
    noStore();

    // Accept BOTH JSON+base64 (preferred) and legacy multipart/form-data.
    // JSON+base64 avoids Next.js App Router body-size issues: API routes do NOT
    // inherit the serverActions.bodySizeLimit (50mb), so large multipart uploads
    // fail with a parsing error. The client now sends JSON by default.
    const contentType = req.headers.get('content-type') ?? '';

    let audioBuffer: Buffer;
    let mimeType: string;
    let language: string | undefined;
    let preferredProvider: string | undefined;

    if (contentType.includes('application/json')) {
        // ── JSON + base64 (primary path) ──────────────────────────────────────
        let body: any;
        try { body = await req.json(); } catch {
            return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
        }
        if (!body?.audio) {
            return NextResponse.json({ success: false, error: 'Missing "audio" field (base64 string)' }, { status: 400 });
        }
        try {
            audioBuffer       = Buffer.from(body.audio as string, 'base64');
            mimeType          = (body.mimeType as string) ?? 'audio/webm';
            language          = (body.language as string | undefined) ?? undefined;
            preferredProvider = (body.provider as string | undefined) ?? undefined;
        } catch {
            return NextResponse.json({ success: false, error: 'Invalid base64 audio data' }, { status: 400 });
        }
    } else {
        // ── Legacy multipart/form-data (fallback) ─────────────────────────────
        let formData: FormData;
        try { formData = await req.formData(); } catch {
            return NextResponse.json({
                success: false,
                error: 'Audio upload failed - recording may be too large or format unsupported.',
            }, { status: 400 });
        }
        const audioFile = formData.get('audio') as File | null;
        if (!audioFile) {
            return NextResponse.json({ success: false, error: 'No audio file provided' }, { status: 400 });
        }
        language          = (formData.get('language') as string | null) ?? undefined;
        preferredProvider = (formData.get('provider') as string | null) ?? undefined;
        mimeType          = audioFile.type || 'audio/webm';
        audioBuffer       = Buffer.from(await audioFile.arrayBuffer());
    }

    if (audioBuffer.length === 0) {
        return NextResponse.json({
            success: false,
            error: 'Empty recording - please speak into the microphone before stopping.',
        }, { status: 400 });
    }

    try {
        const text = await transcribeAudio({ audioBuffer, mimeType, language, preferredProvider });

        if (!text) {
            return NextResponse.json({
                success: false,
                error: 'Transcription returned empty result. Please speak more clearly and try again.',
            }, { status: 422 });
        }

        return NextResponse.json({ success: true, text });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message ?? 'Transcription failed' }, { status: 500 });
    }
}
