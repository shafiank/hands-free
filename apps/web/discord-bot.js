#!/usr/bin/env node
// ============================================================
// Hands Free Discord Bot
// ============================================================
// Flow:
//   1. Bot connects to Discord gateway via discord.js
//   2. Users @mention the bot in the configured channel
//   3. Message Ã¢â€ â€™ /api/chat (Hands Free brain)
//   4. AI response Ã¢â€ â€™ sent back to Discord
//   5. Checks for config every 30s if not yet configured
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const DATA_DIR = process.env.HANDSFREE_DATA_DIR || path.join(os.homedir(), '.handsfree-data');
const DISCORD_FILE = path.join(DATA_DIR, 'integrations', 'discord.json');
const LOCK_FILE = path.join(DATA_DIR, '.discord-bot.lock');
const LOG_FILE = path.join(DATA_DIR, 'discord-bot-error.log');

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Process Lock Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
(function acquireLock() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').trim(), 10);
            if (!isNaN(existingPid) && existingPid !== process.pid) {
                try {
                    process.kill(existingPid, 0);
                    console.error(`[Lock] Discord Bot already running (PID ${existingPid}). Exiting.`);
                    process.exit(0);
                } catch {
                    console.log(`[Lock] Stale lock (PID ${existingPid}). Taking over...`);
                }
            }
        }
        fs.writeFileSync(LOCK_FILE, process.pid.toString());
        const releaseLock = () => { try { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); } catch { } };
        process.on('exit', releaseLock);
        process.on('SIGTERM', () => { releaseLock(); process.exit(0); });
        process.on('SIGINT', () => { releaseLock(); process.exit(0); });
    } catch { }
})();

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch { }
}

function loadConfig() {
    try {
        if (fs.existsSync(DISCORD_FILE)) return JSON.parse(fs.readFileSync(DISCORD_FILE, 'utf-8'));
    } catch { }
    return null;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Send message to Hands Free brain Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function sendToHandsFree(message, userId, username) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            messages: [{ role: 'user', content: message }],
            sessionId: `discord-${userId}`,
            source: 'discord',
            username,
        });
        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/chat',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch { resolve({ response: data }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(90000, () => { req.destroy(); reject(new Error('Timeout after 90s')); });
        req.write(body);
        req.end();
    });
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Split long messages Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function splitMessage(text, maxLen = 1900) {
    if (text.length <= maxLen) return [text];
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        let cut = maxLen;
        // Try to cut at a newline
        const nl = remaining.lastIndexOf('\n', maxLen);
        if (nl > maxLen / 2) cut = nl + 1;
        chunks.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut);
    }
    return chunks;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Main Bot Logic Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let activeClient = null;

async function startBot(config) {
    // Dynamically require discord.js to avoid crashing if not installed
    let discordjs;
    try {
        discordjs = require('discord.js');
    } catch (e) {
        log('[Discord] discord.js not installed. Run: npm install (in apps/web). Retrying in 60s...');
        setTimeout(() => startOrWait(), 60000);
        return;
    }

    const { Client, GatewayIntentBits, Events } = discordjs;

    if (activeClient) {
        try { activeClient.destroy(); } catch { }
        activeClient = null;
    }

    log(`[Discord] Starting bot...`);

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,
        ],
    });

    activeClient = client;

    client.once(Events.ClientReady, (c) => {
        log(`[Discord] Bot ready: ${c.user.tag} (${c.user.id})`);
        // Update config with botName/botId
        try {
            const cfg = loadConfig();
            if (cfg) {
                cfg.botName = c.user.username;
                cfg.botId = c.user.id;
                fs.mkdirSync(path.dirname(DISCORD_FILE), { recursive: true });
                fs.writeFileSync(DISCORD_FILE, JSON.stringify(cfg, null, 2));
            }
        } catch { }
    });

    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot) return;
        // Guild channel check
        if (config.channelId && message.channelId !== config.channelId) return;
        if (config.guildId && message.guildId !== config.guildId) return;
        // Only respond to: DMs, or @mentions
        const isMention = message.mentions.has(client.user.id);
        const isDM = !message.guildId;
        if (!isMention && !isDM) return;

        const content = message.content.replace(/<@!?\d+>/g, '').trim();
        if (!content) {
            await message.reply('Hiya! Mention me with a message and I\'ll help Ã°Å¸Â¦Å½').catch(() => {});
            return;
        }

        log(`[Discord] ${message.author.username}: ${content.slice(0, 120)}`);
        try {
            await message.channel.sendTyping();
            const result = await sendToHandsFree(content, message.author.id, message.author.username);
            const response = (result.response || result.message || 'I had trouble with that request.').trim();
            const chunks = splitMessage(response);
            await message.reply(chunks[0]);
            for (let i = 1; i < chunks.length; i++) {
                await message.channel.send(chunks[i]);
            }
        } catch (e) {
            log(`[Discord] Error handling message: ${e.message}`);
            await message.reply('Ã¢Å¡Â Ã¯Â¸Â Trouble reaching Hands Free. Is the dashboard running?').catch(() => {});
        }
    });

    client.on('error', (err) => log(`[Discord] Client error: ${err.message}`));

    client.on('disconnect', () => {
        log('[Discord] Disconnected. Reconnecting in 30s...');
        activeClient = null;
        setTimeout(() => startOrWait(), 30000);
    });

    try {
        await client.login(config.botToken);
    } catch (e) {
        log(`[Discord] Login failed: ${e.message}. Retrying in 60s...`);
        activeClient = null;
        client.destroy();
        setTimeout(() => startOrWait(), 60000);
    }
}

function startOrWait() {
    const config = loadConfig();
    if (!config || !config.botToken) {
        log('[Discord] No config found. Waiting for configuration in Settings Ã¢â€ â€™ Skills Ã¢â€ â€™ Discord Bot...');
        setTimeout(() => startOrWait(), 30000);
        return;
    }
    startBot(config).catch(e => {
        log(`[Discord] Unexpected error: ${e.message}`);
        setTimeout(() => startOrWait(), 60000);
    });
}

log('[Discord] Hands Free Discord Bot starting...');
startOrWait();
