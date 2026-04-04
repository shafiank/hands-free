/**
 * Minimal FTP Client for Hands Free
 * Uses Node.js `net` module â€” no npm packages required.
 * Supports: PASV mode, upload, directory listing, basic navigation.
 * Does NOT support SFTP (requires ssh2 package â€” not installed in v7).
 * Hands Free v7 â€” Session 15
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

export interface DeployConfig {
    host: string;
    port: number;           // default 21
    username: string;
    password: string;
    protocol: 'ftp' | 'sftp';
    remotePath: string;     // e.g. '/public_html/'
    secure: boolean;        // TLS (not supported in minimal client)
    lastDeployedAt?: number;
    lastDeployedFiles?: string[];
}

// â”€â”€â”€ FTP Protocol Implementation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class MinimalFTP {
    private socket: net.Socket | null = null;
    private buffer = '';
    private responseQueue: ((response: string) => void)[] = [];

    async connect(host: string, port: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('FTP connection timeout')), 15000);
            this.socket = net.createConnection(port, host, () => {
                clearTimeout(timeout);
            });
            this.socket.setEncoding('utf-8');
            this.socket.on('data', (data: string) => this.handleData(data));
            this.socket.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });

            // Wait for the welcome message (220)
            this.waitResponse().then(resolve).catch(reject);
        });
    }

    private handleData(data: string): void {
        this.buffer += data;
        // FTP responses end with \r\n and start with 3 digits
        const lines = this.buffer.split('\r\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.length >= 3 && /^\d{3}[ -]/.test(line)) {
                // Multi-line response: "xxx-" continues, "xxx " terminates
                if (line[3] === ' ' && this.responseQueue.length > 0) {
                    const handler = this.responseQueue.shift()!;
                    handler(line);
                }
            }
        }
    }

    private waitResponse(): Promise<string> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('FTP response timeout')), 30000);
            this.responseQueue.push((response) => {
                clearTimeout(timeout);
                resolve(response);
            });
        });
    }

    async sendCommand(cmd: string): Promise<string> {
        if (!this.socket) throw new Error('Not connected');
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error(`FTP command timeout: ${cmd.split(' ')[0]}`)), 30000);
            this.responseQueue.push((response) => {
                clearTimeout(timeout);
                resolve(response);
            });
            this.socket!.write(cmd + '\r\n');
        });
    }

    async login(username: string, password: string): Promise<void> {
        const userResp = await this.sendCommand(`USER ${username}`);
        if (!userResp.startsWith('331') && !userResp.startsWith('230')) {
            throw new Error(`FTP login failed (USER): ${userResp}`);
        }
        if (userResp.startsWith('230')) return; // Already logged in

        const passResp = await this.sendCommand(`PASS ${password}`);
        if (!passResp.startsWith('230')) {
            throw new Error(`FTP login failed (PASS): ${passResp}`);
        }
    }

    async pasv(): Promise<{ host: string; port: number }> {
        const resp = await this.sendCommand('PASV');
        if (!resp.startsWith('227')) throw new Error(`PASV failed: ${resp}`);

        // Parse "227 Entering Passive Mode (h1,h2,h3,h4,p1,p2)"
        const match = resp.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
        if (!match) throw new Error(`Cannot parse PASV response: ${resp}`);

        const host = `${match[1]}.${match[2]}.${match[3]}.${match[4]}`;
        const port = parseInt(match[5]) * 256 + parseInt(match[6]);
        return { host, port };
    }

    async type(mode: 'A' | 'I'): Promise<void> {
        const resp = await this.sendCommand(`TYPE ${mode}`);
        if (!resp.startsWith('200')) throw new Error(`TYPE failed: ${resp}`);
    }

    async cwd(dir: string): Promise<void> {
        const resp = await this.sendCommand(`CWD ${dir}`);
        if (!resp.startsWith('250')) throw new Error(`CWD failed: ${resp}`);
    }

    async mkd(dir: string): Promise<void> {
        const resp = await this.sendCommand(`MKD ${dir}`);
        // 257 = created, 550 = already exists (some servers)
        if (!resp.startsWith('257') && !resp.startsWith('550')) {
            throw new Error(`MKD failed: ${resp}`);
        }
    }

    async ensureDir(remotePath: string): Promise<void> {
        const parts = remotePath.split('/').filter(Boolean);
        for (const part of parts) {
            try { await this.mkd(part); } catch { /* ignore â€” may already exist */ }
            try { await this.cwd(part); } catch { /* try to continue */ }
        }
        // Go back to root
        try { await this.cwd('/'); } catch { /* ignore */ }
    }

    async uploadFile(localPath: string, remotePath: string): Promise<void> {
        await this.type('I'); // Binary mode
        const pasv = await this.pasv();

        // Open data connection
        const dataSocket = await new Promise<net.Socket>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Data connection timeout')), 15000);
            const sock = net.createConnection(pasv.port, pasv.host, () => {
                clearTimeout(timeout);
                resolve(sock);
            });
            sock.on('error', (err) => { clearTimeout(timeout); reject(err); });
        });

        // Send STOR command
        const storPromise = this.sendCommand(`STOR ${remotePath}`);

        // Wait for "150 Opening" response
        const storResp = await storPromise;
        if (!storResp.startsWith('150') && !storResp.startsWith('125')) {
            dataSocket.destroy();
            throw new Error(`STOR failed: ${storResp}`);
        }

        // Stream the file
        const fileStream = fs.createReadStream(localPath);
        await new Promise<void>((resolve, reject) => {
            fileStream.pipe(dataSocket);
            fileStream.on('error', reject);
            dataSocket.on('finish', resolve);
            dataSocket.on('error', reject);
        });

        // Wait for "226 Transfer complete"
        const transferResp = await this.waitResponse();
        if (!transferResp.startsWith('226')) {
            console.warn(`FTP transfer warning: ${transferResp}`);
        }
    }

    async quit(): Promise<void> {
        try {
            await this.sendCommand('QUIT');
        } catch { /* ignore */ }
        this.socket?.destroy();
        this.socket = null;
    }

    destroy(): void {
        this.socket?.destroy();
        this.socket = null;
    }
}

// â”€â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function ftpUploadFiles(
    config: DeployConfig,
    files: { localPath: string; remotePath: string }[],
    onProgress?: (file: string, index: number, total: number) => void,
): Promise<{ uploaded: number; errors: string[] }> {
    if (config.protocol === 'sftp') {
        throw new Error('SFTP is not supported in this version. The ssh2 package is not installed. Use FTP instead, or install ssh2 via npm.');
    }

    // â”€â”€ Path traversal prevention â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for (const file of files) {
        if (file.remotePath.includes('..')) {
            throw new Error(`Security: remote path "${file.remotePath}" contains path traversal`);
        }
        const resolvedLocal = path.resolve(file.localPath);
        if (resolvedLocal.includes('..')) {
            throw new Error(`Security: local path "${file.localPath}" contains path traversal`);
        }
    }

    const client = new MinimalFTP();
    const errors: string[] = [];
    let uploaded = 0;

    try {
        await client.connect(config.host, config.port || 21);
        await client.login(config.username, config.password);

        // Navigate to remote path
        if (config.remotePath && config.remotePath !== '/') {
            try { await client.cwd(config.remotePath); } catch {
                // Try to create the directory
                await client.ensureDir(config.remotePath);
                await client.cwd(config.remotePath);
            }
        }

        for (let i = 0; i < files.length; i++) {
            try {
                onProgress?.(files[i].remotePath, i, files.length);

                // Ensure parent directories exist
                const dir = path.posix.dirname(files[i].remotePath);
                if (dir && dir !== '.' && dir !== '/') {
                    await client.ensureDir(dir);
                    if (config.remotePath && config.remotePath !== '/') {
                        await client.cwd(config.remotePath);
                    }
                }

                await client.uploadFile(files[i].localPath, files[i].remotePath);
                uploaded++;
            } catch (e: any) {
                errors.push(`${files[i].remotePath}: ${e.message}`);
            }
        }

        await client.quit();
    } catch (e: any) {
        client.destroy();
        throw new Error(`FTP connection failed: ${e.message}`);
    }

    return { uploaded, errors };
}

export async function ftpTestConnection(config: DeployConfig): Promise<string> {
    if (config.protocol === 'sftp') {
        throw new Error('SFTP is not supported in this version.');
    }

    const client = new MinimalFTP();
    try {
        await client.connect(config.host, config.port || 21);
        await client.login(config.username, config.password);

        if (config.remotePath && config.remotePath !== '/') {
            await client.cwd(config.remotePath);
        }

        await client.quit();
        return `Connected to ${config.host}:${config.port || 21} â€” remote path "${config.remotePath || '/'}" accessible.`;
    } catch (e: any) {
        client.destroy();
        throw new Error(`FTP test failed: ${e.message}`);
    }
}
