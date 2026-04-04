'use server';

// ============================================================
// Server Actions for Auto-Extracted Memories
// ============================================================
// Thin wrappers around memory-scanner functions so the
// memory page (client component) can call them as Server Actions.
// ============================================================

import { listExtractedMemories, deleteExtractedMemory } from '../lib/memory-scanner';
import { invalidateMemoryCache } from '../lib/memory-retrieval';
import type { ExtractedMemory } from '../lib/memory-scanner';

export type { ExtractedMemory };

export async function getExtractedMemories(): Promise<ExtractedMemory[]> {
    return listExtractedMemories();
}

export async function removeExtractedMemory(id: string): Promise<{ success: boolean }> {
    const deleted = deleteExtractedMemory(id);
    if (deleted) {
        invalidateMemoryCache(); // keep retrieval cache in sync
    }
    return { success: deleted };
}

export async function triggerMemoryScan(): Promise<{ scanned: number; extracted: number; skipped: boolean; error?: string }> {
    const { runMemoryScan } = await import('../lib/memory-scanner');
    const result = runMemoryScan();
    if (result.extracted > 0) {
        invalidateMemoryCache();
    }
    return result;
}
