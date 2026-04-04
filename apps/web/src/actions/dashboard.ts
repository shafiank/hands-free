'use server';

import { loadSettings, listSessions, type HandsFreeSettings } from './chat';

// ============================================================
// Hands Free Dashboard Server Actions â€” v2.0
// ============================================================
// Returns REAL data from settings and sessions.
// ============================================================

export async function getDashboardData() {
    try {
        const settings = await loadSettings();
        const sessions = await listSessions();

        const activeProvider = settings.activeProvider;
        const providerConfig = settings.providers[activeProvider];
        const hasApiKey = activeProvider === 'ollama'
            ? true
            : !!providerConfig?.apiKey;

        // Check Ollama connection
        let ollamaStatus = false;
        if (settings.providers.ollama.enabled || activeProvider === 'ollama') {
            try {
                const url = (settings.providers.ollama.baseUrl || 'http://localhost:11434/v1').replace('/v1', '');
                const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
                ollamaStatus = res.ok;
            } catch { ollamaStatus = false; }
        }

        // Count enabled providers
        const enabledProviders = Object.entries(settings.providers)
            .filter(([_, cfg]) => cfg.enabled && (cfg.apiKey || _ === 'ollama'))
            .map(([name]) => name);

        // Check Telegram status
        let telegramConnected = false;
        try {
            const { loadTelegramConfig } = await import('./telegram');
            const tgConfig = await loadTelegramConfig();
            telegramConnected = !!(tgConfig?.enabled && tgConfig?.botToken);
        } catch (e) {
            console.warn('Telegram status check failed:', e);
        }

        // Check WhatsApp status
        let whatsappConnected = false;
        let whatsappPhone: string | undefined;
        try {
            const { getWhatsAppStatus } = await import('./whatsapp');
            const waStatus = await getWhatsAppStatus();
            whatsappConnected = waStatus?.state === 'ready';
            if (whatsappConnected) whatsappPhone = waStatus?.phoneNumber || undefined;
        } catch (e) {
            console.warn('WhatsApp status check failed:', e);
        }

        return {
            persona: settings.persona || 'default',
            activeProvider,
            model: providerConfig?.model || 'unknown',
            connected: hasApiKey,
            ollamaRunning: ollamaStatus,
            telegramConnected,
            whatsappConnected,
            whatsappPhone,
            enabledProviders,
            sessions: sessions.slice(0, 5),
            stats: {
                totalSessions: sessions.length,
                totalMessages: sessions.reduce((sum, s) => sum + s.messageCount, 0),
                enabledProviderCount: enabledProviders.length,
            },
        };
    } catch (error: any) {
        console.error('[Hands Free] Dashboard data error:', error.message);
        return {
            persona: 'default',
            activeProvider: 'openrouter' as const,
            model: 'unknown',
            connected: false,
            ollamaRunning: false,
            telegramConnected: false,
            whatsappConnected: false,
            enabledProviders: [],
            sessions: [],
            stats: {
                totalSessions: 0,
                totalMessages: 0,
                enabledProviderCount: 0,
            },
        };
    }
}
