'use server';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ─── VirusTotal Free API Integration ──────────────────────────────────────────
// API v3 free tier: 4 requests/min, 500 requests/day
// Docs: https://docs.virustotal.com/reference/overview
//
// Strategy (minimal API usage):
//  1. Compute SHA-256 of the file locally (no API call)
//  2. Check hash against VT (1 API call) — works for known malware instantly
//  3. Only upload the file if hash is not in VT database (1-2 more API calls)
//  4. Return a human-readable verdict
// ──────────────────────────────────────────────────────────────────────────────

import { DATA_DIR } from '@/lib/paths';
const VT_CONFIG_FILE = path.join(DATA_DIR, 'integrations', 'virustotal.json');
const VT_API_BASE = 'https://www.virustotal.com/api/v3';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface VTConfig {
    apiKey: string;
    enabled: boolean;
    savedAt: number;
}

function ensureDir() {
    const dir = path.dirname(VT_CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function loadVTConfig(): Promise<VTConfig | null> {
    try {
        if (!fs.existsSync(VT_CONFIG_FILE)) return null;
        return JSON.parse(fs.readFileSync(VT_CONFIG_FILE, 'utf-8')) as VTConfig;
    } catch {
        return null;
    }
}

export async function saveVTConfig(config: Omit<VTConfig, 'savedAt'>): Promise<{ success: boolean; error?: string }> {
    try {
        ensureDir();
        const full: VTConfig = { ...config, savedAt: Date.now() };
        fs.writeFileSync(VT_CONFIG_FILE, JSON.stringify(full, null, 2));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteVTConfig(): Promise<void> {
    try { if (fs.existsSync(VT_CONFIG_FILE)) fs.unlinkSync(VT_CONFIG_FILE); } catch {}
}

export async function testVTApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await fetch(`${VT_API_BASE}/users/current`, {
            headers: { 'x-apikey': apiKey },
        });
        if (res.ok) {
            const data = await res.json();
            const email = data?.data?.attributes?.email;
            return { success: true, message: email ? `Connected (${email})` : 'API key valid ✓' };
        }
        if (res.status === 401) return { success: false, message: 'Invalid API key - check your VirusTotal key.' };
        return { success: false, message: `API returned status ${res.status}` };
    } catch (e: any) {
        return { success: false, message: `Connection failed: ${e.message}` };
    }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VTScanResult {
    success: boolean;
    error?: string;
    // Populated on success
    sha256?: string;
    filename?: string;
    status?: 'clean' | 'malicious' | 'suspicious' | 'unknown' | 'pending';
    maliciousCount?: number;
    suspiciousCount?: number;
    totalEngines?: number;
    permalink?: string;
    verdict?: string;          // Human-readable summary
    detectionNames?: string[]; // AV engine names that flagged the file
    analysisId?: string;       // If pending (queued for scan)
}

// ─── Core Helpers ────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of a base64-encoded file (no API call needed).
 */
function sha256FromBase64(base64: string): string {
    const buf = Buffer.from(base64, 'base64');
    return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Look up a file hash in VirusTotal.
 * Returns null if hash is unknown (not in VT database).
 */
async function lookupHash(apiKey: string, sha256: string): Promise<any | null> {
    const res = await fetch(`${VT_API_BASE}/files/${sha256}`, {
        headers: { 'x-apikey': apiKey },
        signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404) return null;   // Not found - needs upload
    if (!res.ok) throw new Error(`VT hash lookup failed: ${res.status} ${res.statusText}`);
    return await res.json();
}

/**
 * Upload a file to VirusTotal for scanning.
 * Returns the analysis object (may be 'queued').
 */
async function uploadFile(apiKey: string, base64: string, filename: string): Promise<any> {
    const buf = Buffer.from(base64, 'base64');

    // Files > 32MB require a different upload URL endpoint — not supported on free tier
    if (buf.byteLength > 32 * 1024 * 1024) {
        throw new Error('File too large for VirusTotal scan (max 32 MB on free tier).');
    }

    const form = new FormData();
    const blob = new Blob([buf]);
    form.append('file', blob, filename || 'attachment');

    const res = await fetch(`${VT_API_BASE}/files`, {
        method: 'POST',
        headers: { 'x-apikey': apiKey },
        body: form,
        signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`VT upload failed: ${res.status} ${res.statusText}. ${text}`);
    }
    return await res.json();
}

/**
 * Poll an analysis result by analysis ID.
 */
async function getAnalysis(apiKey: string, analysisId: string): Promise<any> {
    const res = await fetch(`${VT_API_BASE}/analyses/${analysisId}`, {
        headers: { 'x-apikey': apiKey },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`VT analysis fetch failed: ${res.status} ${res.statusText}`);
    return await res.json();
}

// ─── Parse VT Response → Friendly Result ────────────────────────────────────

function parseVTFileReport(data: any, sha256: string, filename: string): VTScanResult {
    const stats = data?.data?.attributes?.last_analysis_stats;
    const results = data?.data?.attributes?.last_analysis_results || {};

    if (!stats) {
        return {
            success: true,
            sha256,
            filename,
            status: 'unknown',
            verdict: 'VirusTotal returned an unexpected response. Please check the permalink.',
            permalink: `https://www.virustotal.com/gui/file/${sha256}`,
        };
    }

    const maliciousCount: number = stats.malicious || 0;
    const suspiciousCount: number = stats.suspicious || 0;
    const totalEngines: number = Object.keys(results).length || (stats.malicious + stats.suspicious + stats.undetected + stats.harmless + stats.timeout) || 0;

    // Collect detection names
    const detectionNames: string[] = Object.entries(results)
        .filter(([, v]: any) => v.category === 'malicious' || v.category === 'suspicious')
        .map(([engine, v]: any) => `${engine}: ${v.result}`)
        .slice(0, 10); // Cap at 10

    let status: VTScanResult['status'];
    let verdict: string;

    if (maliciousCount > 0) {
        status = 'malicious';
        verdict = `🚨 **DANGEROUS** - ${maliciousCount} of ${totalEngines} antivirus engines flagged this file as malicious. Do NOT open it.`;
    } else if (suspiciousCount > 0) {
        status = 'suspicious';
        verdict = `⚠️ **SUSPICIOUS** - ${suspiciousCount} of ${totalEngines} engines flagged this file as suspicious. Treat with caution.`;
    } else {
        status = 'clean';
        verdict = `✅ **CLEAN** - 0 of ${totalEngines} antivirus engines flagged this file. It appears safe.`;
    }

    return {
        success: true,
        sha256,
        filename,
        status,
        maliciousCount,
        suspiciousCount,
        totalEngines,
        verdict,
        detectionNames,
        permalink: `https://www.virustotal.com/gui/file/${sha256}`,
    };
}

// ─── Main Export: Scan an Email Attachment ───────────────────────────────────

/**
 * Scan a file (base64-encoded) against VirusTotal.
 *
 * Flow:
 *  1. Compute SHA-256 locally
 *  2. Hash lookup (free, instant if file is known)
 *  3. If not found: upload file for scan
 *  4. If scan is queued (pending): return analysisId so caller can poll later
 *
 * @param base64     - Base64-encoded file content (no data URL prefix)
 * @param filename   - Original filename (used for display + upload)
 */
export async function scanAttachment(base64: string, filename: string): Promise<VTScanResult> {
    const config = await loadVTConfig();

    if (!config?.enabled || !config?.apiKey) {
        return {
            success: false,
            error: 'VirusTotal is not configured. Add your free API key in Settings → Security.',
        };
    }

    // Strip data URL prefix if present
    const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const sha256 = sha256FromBase64(cleanBase64);

    try {
        // Step 1: Hash lookup (cheapest — 1 API call, instant for known files)
        let data = await lookupHash(config.apiKey, sha256);

        if (data) {
            // File is known to VT — return cached result immediately
            return parseVTFileReport(data, sha256, filename);
        }

        // Step 2: Hash unknown — upload file for scan (costs 1 more API call)
        const uploadResult = await uploadFile(config.apiKey, cleanBase64, filename);
        const analysisId: string = uploadResult?.data?.id;

        if (!analysisId) {
            return {
                success: false,
                sha256,
                filename,
                error: 'VirusTotal upload succeeded but returned no analysis ID.',
            };
        }

        // Step 3: Try to get the analysis result (may still be queued)
        const analysis = await getAnalysis(config.apiKey, analysisId);
        const analysisStatus = analysis?.data?.attributes?.status;

        if (analysisStatus === 'completed') {
            // Re-fetch the file report now that it's been scanned
            const freshData = await lookupHash(config.apiKey, sha256);
            if (freshData) return parseVTFileReport(freshData, sha256, filename);
        }

        // Analysis is queued / in-progress
        return {
            success: true,
            sha256,
            filename,
            status: 'pending',
            analysisId,
            verdict: `⏳ **Scan queued** - VirusTotal is scanning this file. Check back in a few minutes via the permalink.`,
            permalink: `https://www.virustotal.com/gui/file/${sha256}`,
        };

    } catch (e: any) {
        return {
            success: false,
            sha256,
            filename,
            error: e.message || 'Unknown VirusTotal error.',
        };
    }
}

/**
 * Poll for a pending scan result (call this after receiving status='pending').
 */
export async function pollScanResult(sha256: string, analysisId: string, filename: string): Promise<VTScanResult> {
    const config = await loadVTConfig();
    if (!config?.enabled || !config?.apiKey) {
        return { success: false, error: 'VirusTotal is not configured.' };
    }

    try {
        const analysis = await getAnalysis(config.apiKey, analysisId);
        const analysisStatus = analysis?.data?.attributes?.status;

        if (analysisStatus === 'completed') {
            const freshData = await lookupHash(config.apiKey, sha256);
            if (freshData) return parseVTFileReport(freshData, sha256, filename);
        }

        return {
            success: true,
            sha256,
            filename,
            status: 'pending',
            analysisId,
            verdict: `⏳ **Still scanning...** VirusTotal is processing the file. Try again in a moment.`,
            permalink: `https://www.virustotal.com/gui/file/${sha256}`,
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
