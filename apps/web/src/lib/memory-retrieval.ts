// ============================================================
// Hands Free Memory Retrieval â€” SCHRITT 3
// ============================================================
// Synchronous lookup of relevant extracted memories for a
// given user message. Called inside agentDecide() BEFORE
// the LLM call. Must complete in < 100ms â€” no LLM calls.
//
// Algorithm:
//   score = keyword_overlap Ã— 0.70
//         + recency_score   Ã— 0.20
//         + category_boost  Ã— 0.10
//
// Returns max 5 memories with score > 0.
// Uses a 30-second in-memory cache to avoid repeated FS I/O.
// ============================================================

import fs from 'fs';
import path from 'path';
import type { ExtractedMemory, MemoryCategory } from './memory-scanner';

import { DATA_DIR } from '@/lib/paths';
const MEMORIES_DIR = path.join(DATA_DIR, 'memories');

// â”€â”€â”€ In-Memory Cache (30s TTL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let _cache: ExtractedMemory[] | null = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 30_000;

function loadMemoriesSync(): ExtractedMemory[] {
    const now = Date.now();
    if (_cache && now - _cacheTs < CACHE_TTL_MS) return _cache;

    if (!fs.existsSync(MEMORIES_DIR)) {
        _cache = [];
        _cacheTs = now;
        return _cache;
    }

    const files = fs.readdirSync(MEMORIES_DIR)
        .filter(f => f.endsWith('.json') && f !== '_state.json');

    const memories: ExtractedMemory[] = [];
    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(MEMORIES_DIR, file), 'utf-8');
            memories.push(JSON.parse(raw));
        } catch { /* skip corrupt files */ }
    }

    _cache = memories;
    _cacheTs = now;
    return memories;
}

/** Call this after adding/deleting memories to force a cache refresh. */
export function invalidateMemoryCache() {
    _cache = null;
    _cacheTs = 0;
}

// â”€â”€â”€ NLP Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STOP_WORDS = new Set([
    'a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
    'is','are','was','were','be','been','have','has','had','do','does','did','will',
    'would','could','should','may','might','that','this','it','i','you','he','she',
    'we','they','my','your','his','her','our','what','which','who','how','when',
    'where','why','not','no','so','as','if','then','about','also','just','very',
    'can','use','get','want','help','need','know','make','take','give','like',
]);

function tokenize(text: string): string[] {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

// â”€â”€â”€ Category Boost Rules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// If the user message contains these signals, boost that category.

const CATEGORY_SIGNALS: Partial<Record<MemoryCategory, string[]>> = {
    action_item: ['need', 'task', 'todo', 'remind', 'forget', 'done', 'finish', 'complete', 'deadline', 'later'],
    preference:  ['recommend', 'suggest', 'better', 'best', 'good', 'bad', 'prefer', 'favorite', 'option'],
    location:    ['where', 'place', 'city', 'country', 'travel', 'visit', 'location', 'near', 'local'],
    fact:        ['work', 'job', 'study', 'live', 'name', 'background', 'career', 'school'],
    contact:     ['email', 'contact', 'reach', 'send', 'message', 'write'],
    url:         ['link', 'website', 'site', 'url', 'page', 'visit'],
};

function categoryBoost(userKeywords: string[], category: MemoryCategory): number {
    const signals = CATEGORY_SIGNALS[category];
    if (!signals) return 0;
    const hits = userKeywords.filter(w => signals.includes(w)).length;
    return Math.min(hits / 2, 1); // normalize to 0..1
}

// â”€â”€â”€ Recency Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Full score (1.0) for memories from today; decays to ~0.1 after 30 days.

function recencyScore(extractedAt: number): number {
    const ageMs = Date.now() - extractedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return Math.exp(-ageDays / 14); // half-life â‰ˆ 10 days
}

// â”€â”€â”€ Keyword Overlap Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Dice coefficient between user query keywords and memory's relevance_keywords.

function keywordOverlap(queryWords: string[], memoryWords: string[]): number {
    if (queryWords.length === 0 || memoryWords.length === 0) return 0;
    const setA = new Set(queryWords);
    const setB = new Set(memoryWords);
    const intersection = [...setA].filter(x => setB.has(x)).length;
    return (2 * intersection) / (setA.size + setB.size);
}

// â”€â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Retrieve up to `maxResults` relevant memories for a given user message.
 * Fully synchronous â€” designed to complete in < 100ms.
 * Returns empty array when no memories are relevant (score = 0).
 */
export function retrieveRelevantMemories(
    userMessage: string,
    maxResults = 5,
): ExtractedMemory[] {
    const memories = loadMemoriesSync();
    if (memories.length === 0) return [];

    const queryWords = tokenize(userMessage);
    if (queryWords.length === 0) return [];

    const scored = memories.map(mem => {
        const kw = keywordOverlap(queryWords, mem.relevance_keywords || tokenize(mem.content));
        const recency = recencyScore(mem.extracted_at);
        const boost = categoryBoost(queryWords, mem.category);

        const score = kw * 0.70 + recency * 0.20 + boost * 0.10;
        return { mem, score };
    });

    return scored
        .filter(({ score }) => score > 0.05)     // exclude completely irrelevant
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(({ mem }) => mem);
}

/**
 * Format retrieved memories as a compact system-prompt block.
 * Call only when retrieveRelevantMemories() returns > 0 items.
 */
export function formatMemoriesForPrompt(memories: ExtractedMemory[]): string {
    if (memories.length === 0) return '';
    const lines = memories.map(m => `- [${m.category}] ${m.content}`).join('\n');
    return `\n**Recalled Memories (auto-learned):**\n${lines}\n`;
}
