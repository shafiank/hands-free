export const dynamic = 'force-dynamic';
// ============================================================
// POST /api/export-backup/generate â€” Trigger backup export
// ============================================================
// Creates a fresh .handsfree-data ZIP and returns the filename.
// Used by the Telegram /export command so the bot can then
// read the file and send it as a Telegram document.
// ============================================================

import { NextResponse } from 'next/server';
import { exportData } from '@/actions/backup';

export async function POST() {
    try {
        const result = await exportData();
        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || 'Export failed' },
                { status: 500 }
            );
        }
        return NextResponse.json({
            success: true,
            filename: result.filename,
            sizeBytes: result.sizeBytes,
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
