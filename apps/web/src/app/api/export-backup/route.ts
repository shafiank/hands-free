export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs';
import { getLatestExportPath } from '@/actions/backup';

export async function GET() {
    try {
        const zipPath = await getLatestExportPath();
        if (!zipPath || !fs.existsSync(zipPath)) {
            return NextResponse.json({ error: 'No export found. Generate one first in Settings → Export/Import.' }, { status: 404 });
        }

        const filename = zipPath.split('/').pop()!;
        const fileBuffer = fs.readFileSync(zipPath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': String(fileBuffer.length),
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
