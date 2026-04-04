// ============================================================
// Hands Free Memory Scanner â€” SCHRITT 2
// ============================================================
// Scans new conversations since last scan, extracts memories
// using regex-based NLP (no LLM needed for most patterns).
// Runs every 90 minutes via /api/memory/scan endpoint.
// Stores extracted memories in .handsfree-data/memories/{id}.json
// ============================================================

import fs from 'fs';
import path from 'path';

import { DATA_DIR } from '@/lib/paths';
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const MEMORIES_DIR = path.join(DATA_DIR, 'memories');
const STATE_FILE = path.join(MEMORIES_DIR, '_state.json');

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type MemoryCategory =
    | 'preference'    // "I like/love/hate..."
    | 'fact'          // "I work at/live in/am a..."
    | 'action_item'   // "I need to/remind me to..."
    | 'contact'       // email addresses
    | 'url'           // URLs mentioned
    | 'location'      // cities, places
    | 'topic';        // recurring topics of interest

export interface ExtractedMemory {
    id: string;
    category: MemoryCategory;
    content: string;
    source_conversation_id: string;
    extracted_at: number;
    relevance_keywords: string[];
}

interface ScannerState {
    lastScanTimestamp: number;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ensureDir() {
    if (!fs.existsSync(MEMORIES_DIR)) fs.mkdirSync(MEMORIES_DIR, { recursive: true });
}

function loadState(): ScannerState {
    if (fs.existsSync(STATE_FILE)) {
        try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); } catch { /* ignore */ }
    }
    return { lastScanTimestamp: 0 };
}

function saveState(state: ScannerState) {
    ensureDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadExistingMemories(): ExtractedMemory[] {
    ensureDir();
    const files = fs.readdirSync(MEMORIES_DIR).filter(f => f.endsWith('.json') && f !== '_state.json');
    return files.map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(MEMORIES_DIR, f), 'utf-8')); }
        catch { return null; }
    }).filter(Boolean) as ExtractedMemory[];
}

function tokenize(text: string): string[] {
    const STOP_WORDS = new Set([
        'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
        'is','are','was','were','be','been','have','has','had','do','does','did','will',
        'would','could','should','may','might','that','this','it','i','you','he','she',
        'we','they','my','your','his','her','our','what','which','who','how','when',
        'where','why','not','no','so','as','if','then','about','also','just','very',
    ]);
    return text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

// Jaccard similarity â€” returns 0..1
function jaccardSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 && b.length === 0) return 1;
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

// Check if a near-duplicate already exists (>= 55% similarity)
function isDuplicate(content: string, existing: ExtractedMemory[]): boolean {
    const newWords = tokenize(content);
    return existing.some(m => jaccardSimilarity(newWords, tokenize(m.content)) >= 0.55);
}

function saveMemory(memory: ExtractedMemory) {
    ensureDir();
    const filePath = path.join(MEMORIES_DIR, `${memory.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
}

// â”€â”€â”€ Extraction Patterns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ExtractionRule {
    pattern: RegExp;
    category: MemoryCategory;
    transform: (match: RegExpMatchArray) => string | null;
}

const EXTRACTION_RULES: ExtractionRule[] = [
    // â”€â”€ Preferences â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        pattern: /\bi (?:really )?(?:like|love|enjoy|adore|prefer)\s+([^.!?,\n]{4,60})/gi,
        category: 'preference',
        transform: m => `User likes ${m[1].trim()}`,
    },
    {
        pattern: /\bmy (?:favourite|favorite)\s+([^.!?,\n]{3,40})\s+is\s+([^.!?,\n]{2,40})/gi,
        category: 'preference',
        transform: m => `Favorite ${m[1].trim()}: ${m[2].trim()}`,
    },
    {
        pattern: /\bi (?:hate|dislike|(?:don't|do not|never) like|can't stand)\s+([^.!?,\n]{4,60})/gi,
        category: 'preference',
        transform: m => `User dislikes ${m[1].trim()}`,
    },
    {
        pattern: /\bi prefer\s+([^.!?,\n]{4,60})/gi,
        category: 'preference',
        transform: m => `Preference: ${m[1].trim()}`,
    },

    // â”€â”€ Facts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        pattern: /\bi (?:work|worked) (?:at|for|with)\s+([^.!?,\n]{3,50})/gi,
        category: 'fact',
        transform: m => `Works at: ${m[1].trim()}`,
    },
    {
        pattern: /\bi (?:live|lived|stay|am based|am located) in\s+([^.!?,\n]{3,40})/gi,
        category: 'fact',
        transform: m => `Lives in: ${m[1].trim()}`,
    },
    {
        pattern: /\bi(?:'m| am) (?:a|an)\s+([^.!?,\n]{3,50})/gi,
        category: 'fact',
        transform: m => {
            const role = m[1].trim();
            // Skip generic phrases
            if (['student','person','human','guy','girl','man','woman'].includes(role.toLowerCase())) return null;
            return `Occupation/role: ${role}`;
        },
    },
    {
        pattern: /\bmy (?:name is|name's)\s+([A-Z][a-z]+)/gi,
        category: 'fact',
        transform: m => `Name: ${m[1].trim()}`,
    },
    {
        pattern: /\bi(?:'m| am) from\s+([^.!?,\n]{3,40})/gi,
        category: 'fact',
        transform: m => `From: ${m[1].trim()}`,
    },
    {
        pattern: /\bi (?:study|studied|go to school|attend) (?:at|in)?\s+([^.!?,\n]{3,50})/gi,
        category: 'fact',
        transform: m => `Studies at: ${m[1].trim()}`,
    },

    // â”€â”€ Action Items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        pattern: /\bi need to\s+([^.!?,\n]{5,80})/gi,
        category: 'action_item',
        transform: m => `Task: ${m[1].trim()}`,
    },
    {
        pattern: /\bremind me (?:to|about)\s+([^.!?,\n]{5,80})/gi,
        category: 'action_item',
        transform: m => `Reminder: ${m[1].trim()}`,
    },
    {
        pattern: /\bdon['']t forget (?:to|about|that)?\s+([^.!?,\n]{5,80})/gi,
        category: 'action_item',
        transform: m => `Don't forget: ${m[1].trim()}`,
    },
    {
        pattern: /\bi (?:have to|must|should)\s+([^.!?,\n]{5,80})/gi,
        category: 'action_item',
        transform: m => `Should do: ${m[1].trim()}`,
    },
    {
        pattern: /\bi want to (?:start|build|create|make|learn|finish|complete)\s+([^.!?,\n]{5,80})/gi,
        category: 'action_item',
        transform: m => `Goal: ${m[1].trim()}`,
    },

    // â”€â”€ Contact (email) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        pattern: /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g,
        category: 'contact',
        transform: m => `Email contact: ${m[1]}`,
    },

    // â”€â”€ Location â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        pattern: /\b(?:visiting|traveling to|going to|live in|based in|located in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g,
        category: 'location',
        transform: m => `Location mentioned: ${m[1].trim()}`,
    },
];

// â”€â”€â”€ URL extraction (separate from rules) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function extractUrls(text: string): string[] {
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]{5,}/g;
    const matches = text.match(urlPattern) || [];
    return matches.slice(0, 3); // max 3 URLs per message to avoid noise
}

// â”€â”€â”€ Main Extraction Function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function extractFromText(text: string, sessionId: string, existing: ExtractedMemory[]): ExtractedMemory[] {
    const found: ExtractedMemory[] = [];

    // Apply all rules
    for (const rule of EXTRACTION_RULES) {
        rule.pattern.lastIndex = 0; // reset regex state
        let match: RegExpMatchArray | null;
        const seenContents = new Set<string>();

        while ((match = rule.pattern.exec(text)) !== null) {
            const content = rule.transform(match);
            if (!content || content.length < 8) continue;
            if (seenContents.has(content.toLowerCase())) continue;
            seenContents.add(content.toLowerCase());

            // Skip duplicates against already-stored memories
            if (isDuplicate(content, [...existing, ...found])) continue;

            const keywords = tokenize(content);
            found.push({
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                category: rule.category,
                content,
                source_conversation_id: sessionId,
                extracted_at: Date.now(),
                relevance_keywords: [...new Set(keywords)].slice(0, 12),
            });
        }
    }

    // Extract URLs separately
    const urls = extractUrls(text);
    for (const url of urls) {
        const content = `URL mentioned: ${url}`;
        if (!isDuplicate(content, [...existing, ...found])) {
            found.push({
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                category: 'url',
                content,
                source_conversation_id: sessionId,
                extracted_at: Date.now(),
                relevance_keywords: tokenize(url.replace(/https?:\/\//, '').replace(/[/._-]/g, ' ')).slice(0, 8),
            });
        }
    }

    return found;
}

// â”€â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ScanResult {
    scanned: number;      // sessions scanned
    extracted: number;    // new memories extracted
    skipped: boolean;     // true if no new sessions found
    error?: string;
}

export function runMemoryScan(): ScanResult {
    const startTime = Date.now();
    const MAX_MS = 5000; // 5-second hard limit for local extraction

    try {
        ensureDir();
        const state = loadState();
        const existing = loadExistingMemories();

        if (!fs.existsSync(SESSIONS_DIR)) {
            return { scanned: 0, extracted: 0, skipped: true };
        }

        // Find sessions modified since last scan
        const sessionFiles = fs.readdirSync(SESSIONS_DIR)
            .filter(f => f.endsWith('.json'));

        const newSessionFiles = sessionFiles.filter(f => {
            try {
                const stat = fs.statSync(path.join(SESSIONS_DIR, f));
                return stat.mtimeMs > state.lastScanTimestamp;
            } catch { return false; }
        });

        if (newSessionFiles.length === 0) {
            return { scanned: 0, extracted: 0, skipped: true };
        }

        let totalExtracted = 0;

        for (const file of newSessionFiles) {
            // Timeout guard
            if (Date.now() - startTime > MAX_MS) break;

            try {
                const session = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8'));
                const sessionId: string = session.id || file.replace('.json', '');

                // Collect all user messages from this session
                const userMessages: string[] = (session.messages || [])
                    .filter((m: any) => m.role === 'user')
                    .map((m: any) => (typeof m.content === 'string' ? m.content : ''))
                    .filter((c: string) => c.length > 15); // skip trivial messages

                const combinedText = userMessages.join('\n');
                if (!combinedText.trim()) continue;

                const newMemories = extractFromText(combinedText, sessionId, existing);
                for (const mem of newMemories) {
                    saveMemory(mem);
                    existing.push(mem); // Update local cache to prevent intra-scan dupes
                    totalExtracted++;
                }
            } catch {
                // Skip corrupt session files silently
            }
        }

        // Update state
        saveState({ lastScanTimestamp: Date.now() });

        return { scanned: newSessionFiles.length, extracted: totalExtracted, skipped: false };
    } catch (e: any) {
        return { scanned: 0, extracted: 0, skipped: false, error: e.message };
    }
}

// â”€â”€â”€ Delete a single extracted memory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function deleteExtractedMemory(id: string): boolean {
    const filePath = path.join(MEMORIES_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
}

// â”€â”€â”€ List all extracted memories (for UI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function listExtractedMemories(): ExtractedMemory[] {
    return loadExistingMemories()
        .sort((a, b) => b.extracted_at - a.extracted_at);
}
