/**
 * GET / POST / PUT / DELETE  /api/ftp/profiles
 *
 * Central FTP/SFTP profile management.
 * Profiles are stored in ~/.handsfree-data/ftp-profiles.json
 * and shared across Hands Free Studio, orchestrator, and any future FTP consumer.
 *
 * Hands Free v7 - Session 17
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '@/lib/paths';

const PROFILES_FILE = path.join(DATA_DIR, 'ftp-profiles.json');

export interface FtpProfile {
    id: string;
    alias: string;
    host: string;
    port: number;
    username: string;
    password: string;
    protocol: 'ftp' | 'sftp';
    remotePath: string;
    enabled: boolean;
    savedAt: number;
}

function loadProfiles(): FtpProfile[] {
    try {
        if (fs.existsSync(PROFILES_FILE)) {
            return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
        }
    } catch { /* first run */ }
    return [];
}

function saveProfiles(profiles: FtpProfile[]): void {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
}

/** GET - list all profiles (passwords masked) */
export async function GET() {
    const profiles = loadProfiles();
    const masked = profiles.map(p => ({
        ...p,
        password: p.password ? '******' : '',
    }));
    return NextResponse.json({ profiles: masked });
}

/** POST - create a new profile */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const profiles = loadProfiles();

        if (profiles.length >= 10) {
            return NextResponse.json({ error: 'Maximum 10 FTP profiles allowed' }, { status: 400 });
        }

        const profile: FtpProfile = {
            id: body.id || `ftp_${Date.now().toString(36)}`,
            alias: body.alias || '',
            host: body.host || '',
            port: body.port || 21,
            username: body.username || '',
            password: body.password || '',
            protocol: body.protocol || 'ftp',
            remotePath: body.remotePath || '/',
            enabled: body.enabled !== false,
            savedAt: Date.now(),
        };

        profiles.push(profile);
        saveProfiles(profiles);

        return NextResponse.json({ success: true, id: profile.id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/** PUT - update an existing profile */
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const profiles = loadProfiles();
        const idx = profiles.findIndex(p => p.id === body.id);
        if (idx === -1) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        // Preserve existing password if masked value sent
        const password = (body.password && body.password !== '******')
            ? body.password
            : profiles[idx].password;

        profiles[idx] = {
            ...profiles[idx],
            alias: body.alias ?? profiles[idx].alias,
            host: body.host ?? profiles[idx].host,
            port: body.port ?? profiles[idx].port,
            username: body.username ?? profiles[idx].username,
            password,
            protocol: body.protocol ?? profiles[idx].protocol,
            remotePath: body.remotePath ?? profiles[idx].remotePath,
            enabled: body.enabled ?? profiles[idx].enabled,
            savedAt: Date.now(),
        };

        saveProfiles(profiles);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/** DELETE - remove a profile by id (passed as ?id=xxx) */
export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        const profiles = loadProfiles();
        const filtered = profiles.filter(p => p.id !== id);
        if (filtered.length === profiles.length) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        saveProfiles(filtered);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
