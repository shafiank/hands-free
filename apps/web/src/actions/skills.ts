'use server';

import path from 'path';
import fs from 'fs';
import { loadSettings, saveAllSettings } from './chat';

import { DATA_DIR } from '@/lib/paths';
const SKILLS_FILE = path.join(DATA_DIR, 'skills.json');

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface SkillConfig {
    id: string;
    enabled: boolean;
    // Image generation options
    imageProvider?: 'imagen3'; // Placeholder for future AI selection
    // Video generation options
    videoProvider?: 'veo2'; // Placeholder for future AI selection
}

export interface SkillsState {
    skills: Record<string, SkillConfig>;
}

const DEFAULT_SKILLS_STATE: SkillsState = {
    skills: {
        image_generation: { id: 'image_generation', enabled: false, imageProvider: 'imagen3' },
        video_generation: { id: 'video_generation', enabled: false, videoProvider: 'veo2' },
        summarize: { id: 'summarize', enabled: false },
        weather: { id: 'weather', enabled: true }, // Always on Ã¢â‚¬â€ no key required
        googleCalendar: { id: 'googleCalendar', enabled: false },
        group_chat: { id: 'group_chat', enabled: false },
        handsfree_studio: { id: 'handsfree_studio', enabled: false },
        email: { id: 'email', enabled: false },
        telegram: { id: 'telegram', enabled: false },
        whatsapp: { id: 'whatsapp', enabled: false },
        discord: { id: 'discord', enabled: false },
        webhooks: { id: 'webhooks', enabled: false },
        virustotal: { id: 'virustotal', enabled: false },
        gif_sticker: { id: 'gif_sticker', enabled: false },
        web_search: { id: 'web_search', enabled: false },
        browser_control: { id: 'browser_control', enabled: false },
        vision_screenshots: { id: 'vision_screenshots', enabled: false },
        twitter:            { id: 'twitter',            enabled: false },
        // Phase 4 Skills
        google_places:      { id: 'google_places',      enabled: false },
        documents:          { id: 'documents',          enabled: false },
        voice_chat:         { id: 'voice_chat',         enabled: false },
        network_scanner:    { id: 'network_scanner',    enabled: false },
        casting:            { id: 'casting',            enabled: false },
    },
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Group Chat Config Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export interface GroupChatParticipant {
    name: string;
    provider: string;
    model: string;
    persona: string;
}

export interface GroupChatConfig {
    language: string;
    rounds: number;                      // 1Ã¢â‚¬â€œ5
    participants: GroupChatParticipant[]; // 3Ã¢â‚¬â€œ5
    participantTimeoutSeconds?: number;  // per-participant LLM timeout; default 120
}

const GROUP_CHAT_CONFIG_FILE = path.join(DATA_DIR, 'group-chat-config.json');

const DEFAULT_GROUP_CHAT_CONFIG: GroupChatConfig = {
    language: 'English',
    rounds: 3,
    participantTimeoutSeconds: 120,
    participants: [
        {
            name: 'Participant A',
            provider: 'openrouter',
            model: 'openai/gpt-4o',
            persona: 'An analytical and skeptical thinker who critically examines ideas and asks probing questions. Challenges assumptions and seeks evidence.',
        },
        {
            name: 'Participant B',
            provider: 'openrouter',
            model: 'anthropic/claude-3.5-sonnet',
            persona: 'A creative and enthusiastic contributor who proposes innovative solutions and brings fresh, unconventional perspectives to every topic.',
        },
        {
            name: 'Participant C',
            provider: 'openrouter',
            model: 'google/gemini-2.0-flash-001',
            persona: 'A pragmatic synthesizer who focuses on practical implications, real-world applications, and finding common ground between different viewpoints.',
        },
    ],
};

export async function loadGroupChatConfig(): Promise<GroupChatConfig> {
    ensureDir();
    try {
        if (fs.existsSync(GROUP_CHAT_CONFIG_FILE)) {
            const raw = JSON.parse(fs.readFileSync(GROUP_CHAT_CONFIG_FILE, 'utf-8'));
            // Ensure at least 3 participants by merging with defaults
            if (!raw.participants || raw.participants.length < 3) {
                raw.participants = DEFAULT_GROUP_CHAT_CONFIG.participants;
            }
            return {
                language: raw.language || DEFAULT_GROUP_CHAT_CONFIG.language,
                rounds: raw.rounds || DEFAULT_GROUP_CHAT_CONFIG.rounds,
                participants: raw.participants,
                participantTimeoutSeconds: raw.participantTimeoutSeconds ?? DEFAULT_GROUP_CHAT_CONFIG.participantTimeoutSeconds,
            };
        }
    } catch { /* fallback */ }
    return { ...DEFAULT_GROUP_CHAT_CONFIG };
}

export async function saveGroupChatConfig(config: GroupChatConfig): Promise<{ success: boolean; error?: string }> {
    try {
        ensureDir();
        if (!config.participants || config.participants.length < 3) {
            return { success: false, error: 'At least 3 participants are required.' };
        }
        if (config.rounds < 1 || config.rounds > 5) {
            return { success: false, error: 'Rounds must be between 1 and 5.' };
        }
        fs.writeFileSync(GROUP_CHAT_CONFIG_FILE, JSON.stringify(config, null, 2));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Load / Save Skills Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export async function loadSkills(): Promise<SkillsState> {
    ensureDir();
    try {
        if (fs.existsSync(SKILLS_FILE)) {
            const raw = JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf-8'));
            // Merge with defaults so new skills appear automatically
            return {
                skills: {
                    ...DEFAULT_SKILLS_STATE.skills,
                    ...raw.skills,
                },
            };
        }
    } catch { /* fallback to defaults */ }
    return { ...DEFAULT_SKILLS_STATE };
}

export async function toggleSkill(skillId: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        ensureDir();
        const state = await loadSkills();
        if (!state.skills[skillId]) {
            return { success: false, error: `Unknown skill: ${skillId}` };
        }
        // Weather is always-on, can't disable
        if (skillId === 'weather') {
            return { success: true };
        }
        state.skills[skillId].enabled = enabled;
        fs.writeFileSync(SKILLS_FILE, JSON.stringify(state, null, 2));

        // Rebuild capabilities.json so Hands Free knows its current state immediately
        try {
            const { rebuildCapabilities } = await import('./capabilities');
            await rebuildCapabilities();
        } catch { /* non-fatal */ }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getActiveSkills(): Promise<string[]> {
    const state = await loadSkills();
    return Object.entries(state.skills)
        .filter(([, cfg]) => cfg.enabled)
        .map(([id]) => id);
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Image Generation (Google Imagen 3 / Nano Banana Pro) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Uses the same Google AI API key as Gemini

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Nano Banana Models Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Both use the same Google AI Studio key (from Settings Ã¢â€ â€™ AI Provider Ã¢â€ â€™ Google).
// Standard: gemini-2.5-flash-image Ã¢â‚¬â€ native image generation, works with any Google AI Studio key.
// Pro:      gemini-3-pro-image-preview Ã¢â‚¬â€ higher quality, text precision, 4K output.
const NANO_BANANA_MODELS = {
    standard: {
        id: 'gemini-2.5-flash-image',
        name: 'Nano Banana (Standard)',
        description: 'Gemini 2.5 Flash Image Ã¢â‚¬â€ works with any Google AI Studio key',
        apiStyle: 'gemini' as const,
    },
    pro: {
        id: 'gemini-3-pro-image-preview',
        name: 'Nano Banana Pro',
        description: 'Gemini 3 Pro Image Ã¢â‚¬â€ highest quality, 4K, text accuracy',
        apiStyle: 'gemini' as const,
    },
} as const;

type NanoBananaModel = keyof typeof NANO_BANANA_MODELS;

export interface ImageGenOptions {
    prompt: string;
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    style?: 'auto' | 'photorealistic' | 'digital-art' | 'illustration' | 'sketch';
    sampleCount?: number;
    nanoBananaModel?: NanoBananaModel; // 'standard' | 'pro'
}

export interface ImageGenResult {
    success: boolean;
    images?: { base64: string; mimeType: string; filename?: string }[];
    error?: string;
    modelUsed?: string;
}

export async function generateImage(options: ImageGenOptions): Promise<ImageGenResult> {
    try {
        const settings = await loadSettings();
        const googleApiKey = settings.providers.google?.apiKey;

        if (!googleApiKey) {
            return {
                success: false,
                error: 'Google AI API key required for image generation. Add it in Settings Ã¢â€ â€™ AI Provider Ã¢â€ â€™ Google.\n\nUse your Google AI Studio key (same as for Gemini chat).',
            };
        }

        // Build style-aware prompt
        const stylePrefix: Record<string, string> = {
            photorealistic: 'Photorealistic photo: ',
            'digital-art': 'Digital art illustration: ',
            illustration: 'Colorful illustration: ',
            sketch: 'Pencil sketch drawing: ',
            auto: '',
        };
        const prefix = stylePrefix[options.style || 'auto'] || '';
        const fullPrompt = `${prefix}${options.prompt}`;

        const modelKey = options.nanoBananaModel || 'standard';
        const modelConfig = NANO_BANANA_MODELS[modelKey];

        // Ã¢â€â‚¬Ã¢â€â‚¬ Helper: save base64 image to visible Workspace/images/ Ã¢â€â‚¬Ã¢â€â‚¬
        const saveImageToDisk = (base64: string, mimeType: string): string => {
            try {
                const imagesDir = path.join(DATA_DIR, 'workspace', 'images');
                if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
                const ext = mimeType?.split('/')[1]?.split(';')[0] || 'png';
                const filename = `img_${Date.now()}.${ext}`;
                fs.writeFileSync(path.join(imagesDir, filename), Buffer.from(base64, 'base64'));
                return filename;
            } catch (e) {
                console.error('[Hands Free] Failed to save image to disk:', e);
                return '';
            }
        };

        // Ã¢â€â‚¬Ã¢â€â‚¬ Gemini Native Image Generation (Standard) Ã¢â€â‚¬Ã¢â€â‚¬
        if (modelConfig.apiStyle === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.id}:generateContent?key=${googleApiKey}`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }],
                    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
                }),
                signal: AbortSignal.timeout(60000),
            });

            if (!resp.ok) {
                const errText = await resp.text();
                let errMsg = `Image generation error (${resp.status})`;
                try { errMsg = JSON.parse(errText).error?.message || errMsg; } catch { /* ignore */ }
                return { success: false, error: `${errMsg}\n\nMake sure your Google AI Studio key is set in Settings Ã¢â€ â€™ AI Provider Ã¢â€ â€™ Google.` };
            }

            const data = await resp.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

            if (!imagePart) {
                const textPart = parts.find((p: any) => p.text);
                return { success: false, error: textPart?.text || 'No image generated. Prompt may have been filtered by safety settings.' };
            }

            const b64 = imagePart.inlineData.data as string;
            const mime = imagePart.inlineData.mimeType || 'image/png';
            const filename = saveImageToDisk(b64, mime);

            return {
                success: true,
                modelUsed: modelConfig.id,
                images: [{ base64: b64, mimeType: mime, filename }],
            };
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ Imagen 3 API (Pro) Ã¢â€â‚¬Ã¢â€â‚¬
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.id}:predict?key=${googleApiKey}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: fullPrompt }],
                parameters: {
                    sampleCount: options.sampleCount || 1,
                    aspectRatio: options.aspectRatio || '1:1',
                    safetyFilterLevel: 'block_some',
                    personGeneration: 'allow_adult',
                },
            }),
            signal: AbortSignal.timeout(60000),
        });

        if (!resp.ok) {
            const errText = await resp.text();
            let errMsg = `Imagen 3 Pro error (${resp.status})`;
            try { errMsg = JSON.parse(errText).error?.message || errMsg; } catch { /* ignore */ }
            // 404 = no Imagen 3 access Ã¢â€ â€™ auto-fallback to standard
            if (resp.status === 404 || resp.status === 403) {
                console.warn('[Hands Free] Imagen 3 Pro not accessible, falling back to standard model...');
                return generateImage({ ...options, nanoBananaModel: 'standard' });
            }
            return { success: false, error: `${errMsg}\n\nNano Banana Pro (Imagen 3) requires special Google AI Studio access. Try Standard instead.` };
        }

        const data = await resp.json();
        const predictions = data.predictions || [];
        if (!predictions.length) {
            return { success: false, error: 'No images generated. Prompt may have been filtered.' };
        }

        return {
            success: true,
            modelUsed: modelConfig.id,
            images: predictions.map((p: any) => {
                const b64 = p.bytesBase64Encoded as string;
                const mime = p.mimeType || 'image/png';
                const filename = saveImageToDisk(b64, mime);
                return { base64: b64, mimeType: mime, filename };
            }),
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Video Generation (Google Veo 2) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Long-running operation Ã¢â‚¬â€ requires polling

export interface VideoGenOptions {
    prompt: string;
    aspectRatio?: '16:9' | '9:16';
    durationSeconds?: 5 | 8;
    quality?: 'standard' | 'high';
    veoModel?: 'standard' | 'fast' | 'legacy'; // veo-3.1-generate-preview | veo-3.1-fast-generate-preview | veo-3.0-generate-001
    provider?: 'veo';
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Veo 2 Model IDs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const VEO_MODELS = {
    standard: 'veo-2.0-generate-001',  // Veo 2 Standard (default)
    fast: 'veo-2.0-generate-001',       // Veo 2 Fast
    legacy: 'veo-2.0-generate-001',     // Veo 2 Legacy fallback
} as const;

export interface VideoGenResult {
    success: boolean;
    operationName?: string; // For polling
    videoUri?: string;
    filename?: string;      // Local file saved to workspace/files/videos/
    base64?: string;
    mimeType?: string;
    error?: string;
    status?: 'pending' | 'done' | 'error';
}

export async function startVideoGeneration(options: VideoGenOptions): Promise<VideoGenResult> {
    try {
        const settings = await loadSettings();
        const googleApiKey = settings.providers.google?.apiKey;

        if (!googleApiKey) {
            return {
                success: false,
                error: 'Google AI API key required for video generation. Add it in Settings Ã¢â€ â€™ AI Provider Ã¢â€ â€™ Google.',
            };
        }

        const model = VEO_MODELS[options.veoModel || 'standard'];

        // Use @google/genai SDK for Veo 2 (official Google AI Studio endpoint)
        // webpackIgnore prevents the "Critical dependency: expression in import()" build warning
        // @ts-ignore
        const { GoogleGenAI } = await import(/* webpackIgnore: true */ '@google/genai');
        const genai = new GoogleGenAI({ apiKey: googleApiKey });

        let operation: any;
        try {
            operation = await (genai as any).models.generateVideos({
                model,
                prompt: options.prompt,
                config: {
                    aspectRatio: options.aspectRatio || '16:9',
                    numberOfVideos: 1,
                    durationSeconds: options.durationSeconds || 5,
                },
            });
        } catch (startErr: any) {
            return { success: false, error: startErr.message };
        }

        // operation.name is the operation ID for polling
        return {
            success: true,
            operationName: operation.name,
            status: 'pending',
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Single-shot poll (NO blocking while loop) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// The frontend calls this every 8 s via setTimeout Ã¢â‚¬â€ we just check once and return
// immediately so the HTTP connection never hangs for minutes.
export async function pollVideoGeneration(operationName: string): Promise<VideoGenResult> {
    try {
        const settings = await loadSettings();
        const googleApiKey = settings.providers.google?.apiKey;
        if (!googleApiKey) return { success: false, error: 'No Google API key.', status: 'error' };

        const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${googleApiKey}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!resp.ok) {
            return { success: false, error: `Poll error: ${resp.status}`, status: 'error' };
        }

        const data = await resp.json();

        // Ã¢â€â‚¬Ã¢â€â‚¬ Check for terminal failure Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        if (data.state === 'FAILED' || data?.metadata?.state === 'FAILED' || data.error) {
            return {
                success: false,
                error: data.error?.message || 'Video generation failed on Google servers.',
                status: 'error',
            };
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ Still processing Ã¢â‚¬â€ return pending so the frontend polls again Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        const isDone =
            data.done === true ||
            data.state === 'SUCCEEDED' ||
            data?.metadata?.state === 'SUCCEEDED';

        if (!isDone) {
            return { success: true, status: 'pending' };
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ Done Ã¢â‚¬â€ extract URI from all known response shapes Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        // Shape 1 (classic REST): data.response.generatedSamples[0].video.uri
        // Shape 2 (metadata wrapper): data.metadata.response.generatedSamples[0].video.uri
        // Shape 3 (flat): data.generatedSamples[0].video.uri
        // Shape 4 (new SDK): data.response.videos[0].uri  or  data.videos[0].uri
        const sample =
            data.response?.generatedSamples?.[0] ||
            data.metadata?.response?.generatedSamples?.[0] ||
            data?.generatedSamples?.[0];

        const videoUri: string | undefined =
            sample?.video?.uri ||
            data.response?.videos?.[0]?.uri ||
            data?.videos?.[0]?.uri;

        if (!videoUri) {
            return {
                success: false,
                error: 'Video generation completed but no video URI was found in the response. ' +
                       'Your Google AI key may not have Veo access enabled. ' +
                       'Visit aistudio.google.com Ã¢â€ â€™ Veo to check access.',
                status: 'error',
            };
        }

        // Ã¢â€â‚¬Ã¢â€â‚¬ Download and save video to workspace/videos/ Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
        let savedFilename = '';
        try {
            const videosDir = path.join(DATA_DIR, 'workspace', 'videos');
            if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
            const filename = `video_${Date.now()}.mp4`;
            const downloadUrl = videoUri.includes('?')
                ? `${videoUri}&key=${googleApiKey}`
                : `${videoUri}?key=${googleApiKey}`;
            const videoResp = await fetch(downloadUrl, { signal: AbortSignal.timeout(120000) });
            if (videoResp.ok) {
                const buffer = Buffer.from(await videoResp.arrayBuffer());
                fs.writeFileSync(path.join(videosDir, filename), buffer);
                savedFilename = filename;
            }
        } catch (e) {
            console.error('[Hands Free] Failed to save video to disk:', e);
        }

        return {
            success: true,
            videoUri,
            filename: savedFilename || undefined,
            status: 'done',
        };
    } catch (e: any) {
        return { success: false, error: e.message, status: 'error' };
    }
}
