'use server';

import fs from 'fs';
import path from 'path';

import { DATA_DIR } from '@/lib/paths';
const IDENTITY_DIR = path.join(DATA_DIR, 'identity');
const MEMORY_DIR = path.join(DATA_DIR, 'memory');

// Ensure directories exist
function ensureDirs() {
    [DATA_DIR, IDENTITY_DIR, MEMORY_DIR,
        path.join(MEMORY_DIR, 'short-term'),
        path.join(MEMORY_DIR, 'long-term'),
        path.join(MEMORY_DIR, 'episodic')
    ].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
}

// Soul: AI's persistent identity
interface Soul {
    version: string;
    createdAt: number;
    lastUpdated: number;
    personality: {
        basePrompt: string;
        traits: string[];
        learnings: string[];
    };
    preferences: {
        communicationStyle: string;
        responseLength: 'concise' | 'detailed' | 'adaptive';
        emoji: boolean;
    };
    capabilities: string[];
    memory: {
        totalInteractions: number;
        knownFacts: Record<string, any>;
    };
}

// Human: User's profile
interface Human {
    name?: string;
    emoji?: string; // User avatar emoji
    content?: string; // Agent-generated summary of user knowledge
    preferences: {
        language: string;
        timezone: string;
        workingHours?: { start: string; end: string };
    };
    interests: string[];
    projects: Array<{ name: string; description: string; lastActive: number }>;
    context: {
        occupation?: string;
        goals: string[];
        challenges: string[];
    };
    relationship: {
        since: number;
        interactionCount: number;
        trustLevel: number; // 0-100
        rapport: string[];
    };
}

// Default Soul
const DEFAULT_SOUL: Soul = {
    version: '0.7.5',
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    personality: {
        basePrompt: "You are Hands Free, a helpful AI assistant focused on productivity and creativity.",
        traits: ['helpful', 'curious', 'adaptive', 'empathetic'],
        learnings: []
    },
    preferences: {
        communicationStyle: 'friendly-professional',
        responseLength: 'adaptive',
        emoji: true
    },
    capabilities: ['chat', 'code', 'analysis', 'planning'],
    memory: {
        totalInteractions: 0,
        knownFacts: {}
    }
};

// Default Human
// NOTE: Intl.DateTimeFormat() on the server always returns 'UTC' (Node.js default).
// The real timezone is set client-side at /bootstrap and saved to the identity file.
// We use a safe default of 'Europe/Vienna' here so reminders/cron are correct
// until the bootstrap page writes the actual timezone. Overridden immediately on first run.
const DEFAULT_HUMAN: Human = {
    preferences: {
        language: 'auto',
        timezone: 'Europe/Vienna'
    },
    interests: [],
    projects: [],
    context: {
        goals: [],
        challenges: []
    },
    relationship: {
        since: Date.now(),
        interactionCount: 0,
        trustLevel: 50,
        rapport: []
    }
};

export async function loadSoul(): Promise<Soul> {
    ensureDirs();
    const soulPath = path.join(IDENTITY_DIR, 'soul.json');
    if (fs.existsSync(soulPath)) {
        return JSON.parse(fs.readFileSync(soulPath, 'utf-8'));
    }
    return DEFAULT_SOUL;
}

export async function saveSoul(soul: Soul) {
    ensureDirs();
    soul.lastUpdated = Date.now();
    const json = JSON.stringify(soul, null, 2);
    // Validate before writing â€” prevents a bad AI response from corrupting the file
    try {
        JSON.parse(json);
    } catch (e) {
        console.error('[saveSoul] Invalid JSON â€” file will NOT be overwritten:', e);
        throw new Error('saveSoul aborted: invalid JSON output');
    }
    fs.writeFileSync(path.join(IDENTITY_DIR, 'soul.json'), json);
}

export async function loadHuman(): Promise<Human> {
    ensureDirs();
    const humanPath = path.join(IDENTITY_DIR, 'human.json');
    if (fs.existsSync(humanPath)) {
        return JSON.parse(fs.readFileSync(humanPath, 'utf-8'));
    }
    return DEFAULT_HUMAN;
}

export async function saveHuman(human: Human) {
    ensureDirs();
    const json = JSON.stringify(human, null, 2);
    // Validate before writing â€” prevents a bad AI response from corrupting the file
    try {
        JSON.parse(json);
    } catch (e) {
        console.error('[saveHuman] Invalid JSON â€” file will NOT be overwritten:', e);
        throw new Error('saveHuman aborted: invalid JSON output');
    }
    fs.writeFileSync(path.join(IDENTITY_DIR, 'human.json'), json);
}

export async function updateRelationship(incrementInteraction: boolean = true) {
    const human = await loadHuman();
    if (incrementInteraction) {
        human.relationship.interactionCount++;
        // Increase trust slightly with each interaction (max 100)
        human.relationship.trustLevel = Math.min(100, human.relationship.trustLevel + 0.1);
    }
    await saveHuman(human);
}

// Memory: Short-term context
export async function addMemory(type: 'short-term' | 'long-term' | 'episodic', content: any) {
    ensureDirs();
    const memPath = path.join(MEMORY_DIR, type, `${Date.now()}.json`);
    fs.writeFileSync(memPath, JSON.stringify({ timestamp: Date.now(), ...content }, null, 2));
}

export async function getRecentMemories(type: 'short-term' | 'long-term' | 'episodic', limit: number = 10): Promise<any[]> {
    ensureDirs();
    const memDir = path.join(MEMORY_DIR, type);
    if (!fs.existsSync(memDir)) return [];

    const files = fs.readdirSync(memDir)
        .filter((f: string) => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

    return files.map((f: string) => JSON.parse(fs.readFileSync(path.join(memDir, f), 'utf-8')));
}

// Build context string for AI â€” fluid narrative format (v5)
export async function buildContext(): Promise<string> {
    const soul = await loadSoul();
    const human = await loadHuman();
    const recentMemories = await getRecentMemories('short-term', 5);

    const LANGUAGE_NAMES: Record<string, string> = {
        en: 'English', de: 'German (Deutsch)', fr: 'French (FranÃ§ais)',
        es: 'Spanish (EspaÃ±ol)', it: 'Italian (Italiano)', pt: 'Portuguese',
        nl: 'Dutch (Nederlands)', pl: 'Polish', ru: 'Russian', tr: 'Turkish',
        ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
    };
    const langCode = human.preferences?.language || 'auto';
    const langName = LANGUAGE_NAMES[langCode] || langCode;

    // â”€â”€ Timezone-aware current date/time â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const userTz = human.preferences?.timezone || 'Europe/Vienna';
    let timeStr = '';
    try {
        const now = new Date();
        const localDateStr = now.toLocaleDateString('en-GB', { timeZone: userTz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const localTimeStr = now.toLocaleTimeString('en-GB', { timeZone: userTz, hour: '2-digit', minute: '2-digit' });
        timeStr = `${localDateStr}, ${localTimeStr} (${userTz})`;
    } catch {
        timeStr = new Date().toISOString();
    }

    // â”€â”€ Language instruction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const langInstruction = langCode === 'auto'
        ? `Always reply in the same language the user writes in â€” never default to English. If asked how you detect the language, be honest: you simply mirror whatever language the user writes in. Do NOT claim to read system files, desktop.ini, locale settings, or timezone data â€” none of that is used.`
        : `Always reply in ${langName} unless the user explicitly writes in a different language. The language was set explicitly by the user in Settings.`;

    // â”€â”€ Fluid narrative identity block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let narrative = ``;

    // Self description
    narrative += `You are Hands Free â€” ${soul.personality.basePrompt} `;
    narrative += `Your character is built from these traits: ${soul.personality.traits.join(', ')}. `;
    if (soul.memory.totalInteractions > 0) {
        narrative += `You have had ${soul.memory.totalInteractions} conversations with this user. `;
    }

    // User knowledge
    if (human.name) {
        narrative += `The person you are talking to is ${human.name}`;
        if (human.context.occupation) narrative += `, a ${human.context.occupation}`;
        narrative += `. `;
        if (human.interests.length > 0) {
            narrative += `They are interested in ${human.interests.slice(0, 5).join(', ')}. `;
        }
        const trustLevel = Math.round(human.relationship.trustLevel);
        narrative += `You have built a relationship over ${human.relationship.interactionCount} interactions (trust level: ${trustLevel}%). `;
    }

    // User-generated profile summary (agent-written)
    if (human.content) {
        narrative += `\n\nWhat you know about this user: ${human.content}`;
    }

    // Known facts â€” email, phone, address, preferences, etc.
    // These are stored when the user says "remember that my email is â€¦" or similar.
    // IMPORTANT: always use these exact values â€” never fabricate contact details.
    const knownFacts = soul.memory?.knownFacts ?? {};
    const factEntries = Object.entries(knownFacts).filter(([, v]) => v != null && String(v).trim().length > 0);
    if (factEntries.length > 0) {
        const factLines = factEntries
            .slice(0, 30)  // cap to avoid token bloat
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n');
        narrative += `\n\nFacts you know about this user (use these values exactly â€” never guess):\n${factLines}`;
    }

    // Key learnings
    if (soul.personality.learnings.length > 0) {
        narrative += `\n\nThings you have learned and remember: ${soul.personality.learnings.slice(-5).join('; ')}.`;
    }

    // Recent conversation context
    if (recentMemories.length > 0) {
        const memSummaries = recentMemories
            .map(m => m.summary || '')
            .filter(Boolean)
            .slice(0, 3);
        if (memSummaries.length > 0) {
            narrative += `\n\nRecent context from past conversations: ${memSummaries.join(' | ')}.`;
        }
    }

    // Compose final context block
    let context = `<!-- IDENTITY CONTEXT â€” injected automatically, do not quote back to user -->\n`;
    context += `Language rule: ${langInstruction}\n`;
    context += `Current time: ${timeStr} â€” use this for scheduling, reminders, and cron expressions.\n\n`;
    context += narrative.trim();
    context += `\n<!-- END IDENTITY CONTEXT -->`;

    return context;
}

export async function isFirstRun(): Promise<boolean> {
    ensureDirs();
    const soulPath = path.join(IDENTITY_DIR, 'soul.json');
    const humanPath = path.join(IDENTITY_DIR, 'human.json');
    return !fs.existsSync(soulPath) && !fs.existsSync(humanPath);
}

export async function completeBootstrap(userData: Partial<Human>) {
    const soul = DEFAULT_SOUL;
    const human = { ...DEFAULT_HUMAN, ...userData };
    await saveSoul(soul);
    await saveHuman(human);
}

export async function resetBootstrap() {
    ensureDirs();
    const soulPath = path.join(IDENTITY_DIR, 'soul.json');
    const humanPath = path.join(IDENTITY_DIR, 'human.json');

    try {
        if (fs.existsSync(soulPath)) fs.unlinkSync(soulPath);
        if (fs.existsSync(humanPath)) fs.unlinkSync(humanPath);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Clear all memories of a given type
export async function clearMemories(type: 'short-term' | 'long-term' | 'episodic' | 'all') {
    ensureDirs();
    const types = type === 'all' ? ['short-term', 'long-term', 'episodic'] : [type];
    let cleared = 0;

    for (const t of types) {
        const dir = path.join(MEMORY_DIR, t);
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter((f: string) => f.endsWith('.json'));
            files.forEach((f: string) => {
                fs.unlinkSync(path.join(dir, f));
                cleared++;
            });
        }
    }
    return { success: true, cleared };
}

// Get memory statistics
export async function getMemoryStats(): Promise<{
    shortTerm: number;
    longTerm: number;
    episodic: number;
    total: number;
}> {
    ensureDirs();
    const countFiles = (dir: string) => {
        const fullDir = path.join(MEMORY_DIR, dir);
        if (!fs.existsSync(fullDir)) return 0;
        return fs.readdirSync(fullDir).filter((f: string) => f.endsWith('.json')).length;
    };

    const shortTerm = countFiles('short-term');
    const longTerm = countFiles('long-term');
    const episodic = countFiles('episodic');

    return {
        shortTerm,
        longTerm,
        episodic,
        total: shortTerm + longTerm + episodic,
    };
}

// Update human profile from UI (and Soul's known facts)
export async function saveHumanProfile(profile: {
    name?: string;
    emoji?: string;
    content?: string;
    language?: string;
    timezone?: string;
    occupation?: string;
    interests?: string[];
    goals?: string[];
    knownFacts?: Record<string, any>;
}) {
    const human = await loadHuman();
    const soul = await loadSoul();

    if (profile.name !== undefined) human.name = profile.name;
    if (profile.emoji !== undefined) human.emoji = profile.emoji;
    if (profile.content !== undefined) human.content = profile.content;
    if (profile.language) human.preferences.language = profile.language;
    if (profile.timezone) human.preferences.timezone = profile.timezone;
    if (profile.occupation !== undefined) human.context.occupation = profile.occupation;
    if (profile.interests) human.interests = profile.interests;
    if (profile.goals) human.context.goals = profile.goals;

    if (profile.knownFacts) {
        soul.memory.knownFacts = { ...soul.memory.knownFacts, ...profile.knownFacts };
        await saveSoul(soul);
    }

    await saveHuman(human);
    return { success: true };
}

// Delete a specific memory entry by filename
export async function deleteMemory(type: 'short-term' | 'long-term' | 'episodic', filename: string) {
    ensureDirs();
    const filePath = path.join(MEMORY_DIR, type, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
    }
    return { success: false, error: 'Memory entry not found' };
}

// Get recent memories WITH their filenames (for deletion)
export async function getRecentMemoriesWithFilenames(type: 'short-term' | 'long-term' | 'episodic', limit: number = 50): Promise<Array<{ filename: string; data: any }>> {
    ensureDirs();
    const memDir = path.join(MEMORY_DIR, type);
    if (!fs.existsSync(memDir)) return [];

    const files = fs.readdirSync(memDir)
        .filter((f: string) => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

    return files.map((f: string) => ({
        filename: f,
        data: JSON.parse(fs.readFileSync(path.join(memDir, f), 'utf-8'))
    }));
}

// â”€â”€â”€ Semantic Memory Extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function extractMemoriesFromInteraction(
    lastUserMessage: string,
    lastAssistantMessage: string,
    settings: any // Pass settings if needed
) {
    // 1. Keyword Heuristics for immediate value (MVP)
    const lowerMsg = lastUserMessage.toLowerCase();
    const newFacts: Record<string, any> = {};

    // Detect environment questions or statements
    if (lowerMsg.includes('where are you') || lowerMsg.includes('environment') || lowerMsg.includes('server')) {
        // Hands Free realizes it is running locally.
        await addMemory('long-term', {
            summary: 'Environment Awareness: Localhost execution detected.',
            content: 'I am running as a local instance on the user\'s machine (Windows).',
            context: 'system'
        });
    }

    // Detect Name
    if ((lowerMsg.includes('my name is') || lowerMsg.includes('call me')) && !lowerMsg.includes('what')) {
        const parts = lastUserMessage.split(/is|me/);
        if (parts.length > 1) {
            const name = parts[1].trim().split(' ')[0].replace(/[.,!?]/g, '');
            if (name && name.length > 2) {
                newFacts['name'] = name;
                await addMemory('long-term', {
                    summary: `User Identity: Name is ${name}`,
                    content: `User prefers to be called ${name}.`,
                    context: 'identity'
                });
            }
        }
    }

    // Detect "Remember that..."
    if (lowerMsg.includes('remember that') || lowerMsg.includes('save this') || lowerMsg.includes('note:')) {
        const fact = lastUserMessage.replace(/please|remember|that|save|this|note:/gi, '').trim();
        if (fact.length > 5) {
            await addMemory('long-term', {
                summary: `User Fact: ${fact.slice(0, 50)}...`,
                content: fact,
                context: 'user-instructed'
            });
            // Also add as a "known fact" if it looks like a key-value pair
            if (fact.includes(' is ')) {
                const [k, v] = fact.split(' is ');
                if (k && v) newFacts[k.trim()] = v.trim();
            }
        }
    }

    // Save Generic Episodic Memory of this interaction
    await addMemory('episodic', {
        summary: `Chat: ${lastUserMessage.slice(0, 60)}...`,
        user: lastUserMessage,
        ai: lastAssistantMessage.slice(0, 200) + (lastAssistantMessage.length > 200 ? '...' : ''),
        timestamp: Date.now()
    });

    // Update Human Profile if we found facts
    if (Object.keys(newFacts).length > 0) {
        // Use existing saveHumanProfile to merge facts
        await saveHumanProfile({ knownFacts: newFacts });
    }

    return { success: true, extracted: Object.keys(newFacts) };
}
