export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getProject } from '@/actions/code-builder';
import { ftpUploadFiles, type DeployConfig } from '@/lib/ftp-client';

/**
 * POST /api/code/project/[id]/deploy
 * Deploys a completed Hands Free Studio project to a configured FTP server.
 * Supports incremental uploads (only changed files since last deploy).
 * Hands Free v7 â€” Session 15
 */
export async function POST(
    _req: NextRequest,
    { params }: { params: { id: string } },
) {
    try {
        const project = await getProject(params.id);
        if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        if (project.status !== 'complete') return NextResponse.json({ error: 'Project not complete' }, { status: 400 });

        // Load deploy config
        const deployConfigPath = path.join(project.projectDir, 'deploy-config.json');
        if (!fs.existsSync(deployConfigPath)) {
            return NextResponse.json({ error: 'No deploy config. Configure FTP in project settings.' }, { status: 400 });
        }
        const config: DeployConfig = JSON.parse(fs.readFileSync(deployConfigPath, 'utf-8'));

        // Get deployable files (exclude metadata)
        const EXCLUDED = ['project.json', 'deploy-config.json'];
        const allFiles = fs.readdirSync(project.projectDir)
            .filter(f => !EXCLUDED.includes(f) && !f.startsWith('.') && !f.startsWith('_'));

        // Incremental: only upload changed files since last deploy
        let filesToUpload = allFiles;
        let incremental = false;
        if (config.lastDeployedAt) {
            const changedFiles = allFiles.filter(f => {
                try {
                    const stat = fs.statSync(path.join(project.projectDir, f));
                    return stat.mtimeMs > (config.lastDeployedAt || 0);
                } catch { return true; }
            });
            if (changedFiles.length > 0 && changedFiles.length < allFiles.length) {
                filesToUpload = changedFiles;
                incremental = true;
            }
        }

        const files = filesToUpload.map(f => ({
            localPath: path.join(project.projectDir, f),
            remotePath: f, // Flat directory â€” filename only
        }));

        const result = await ftpUploadFiles(config, files);

        // Save last deploy timestamp
        config.lastDeployedAt = Date.now();
        config.lastDeployedFiles = allFiles;
        fs.writeFileSync(deployConfigPath, JSON.stringify(config, null, 2));

        return NextResponse.json({
            success: true,
            filesUploaded: result.uploaded,
            filesTotal: files.length,
            incremental,
            errors: result.errors,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
