'use server';

import fs from 'fs';
import path from 'path';

import { DATA_DIR } from '@/lib/paths';

export async function shutdownServer() {
    console.log('[Hands Free] Shutting down server per user request...');
    // Give the server a moment to respond to the client before exiting
    setTimeout(() => {
        process.exit(0);
    }, 500);
    return { success: true, message: 'Server is shutting down...' };
}

// Delete specific data category.
// category='all' nukes the entire DATA_DIR (i.e. ~/.handsfree-data).
export async function deleteAllData(category: 'settings' | 'sessions' | 'agents' | 'all') {
    const targets: Record<string, string[]> = {
        settings: [path.join(DATA_DIR, 'settings.json')],
        sessions: [path.join(DATA_DIR, 'sessions')],
        agents: [path.join(DATA_DIR, 'agents', 'definitions')],
        all: [DATA_DIR],
    };

    const toDelete = targets[category] || [];
    for (const target of toDelete) {
        if (fs.existsSync(target)) {
            console.log(`[Hands Free] Deleting: ${target}`);
            if (fs.statSync(target).isDirectory()) {
                fs.rmSync(target, { recursive: true, force: true });
            } else {
                fs.unlinkSync(target);
            }
        }
    }

    const message =
        category === 'all'
            ? 'All data deleted. Please restart Hands Free.'
            : `${category} data deleted.`;
    return { success: true, message };
}
