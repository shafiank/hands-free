'use client';

import { getDashboardData } from '@/actions/dashboard';
import { isFirstRun } from '@/actions/identity';
import Link from 'next/link';
import {
    Zap, Clock, Brain, MessageCircle, Settings as SettingsIcon,
    Loader2, Activity, Bot, Wifi, WifiOff, BarChart3,
    ArrowRight, Plus, Sparkles, TrendingUp, Server, ChevronRight,
    Wrench, FolderPlus, FileText, Terminal, Globe, ListTodo, Download, X,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getRecentMemoriesWithFilenames } from '@/actions/identity';
import { silentCheckForUpdates, loadUpdateSettings } from '@/actions/updates';
import { useTranslation } from '@/lib/i18n';

const Icon = ({ icon: I, ...props }: { icon: any;[key: string]: any }) => {
    const Component = I;
    return <Component {...props} />;
};

export default function DashboardPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [greeting, setGreeting] = useState('');
    const [memoryWords, setMemoryWords] = useState<Array<{ word: string; count: number }>>([]);
    const [updateBanner, setUpdateBanner] = useState<{ version: string } | null>(null);
    const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false);

    useEffect(() => {
        // Check if first run and redirect to bootstrap
        isFirstRun()
            .then(firstRun => {
                if (firstRun) {
                    router.push('/bootstrap');
                    return;
                }

                const hour = new Date().getHours();
                if (hour < 12) setGreeting(t('onboarding.greeting.morning'));
                else if (hour < 18) setGreeting(t('onboarding.greeting.afternoon'));
                else setGreeting(t('onboarding.greeting.evening'));

                getDashboardData()
                    .then(res => setData(res))
                    .catch(e => console.error("Dashboard data error:", e))
                    .finally(() => setLoading(false));

                // Silently check for updates (only if auto-check enabled)
                loadUpdateSettings().then(updateSettings => {
                    if (updateSettings.autoCheckOnStartup) {
                        silentCheckForUpdates().then(updateResult => {
                            if (updateResult?.updateAvailable && updateResult.updateInfo) {
                                setUpdateBanner({ version: updateResult.updateInfo.version });
                            }
                        }).catch(() => { /* ignore network errors */ });
                    }
                }).catch(() => { });

                // Load memory words for cluster (fire-and-forget)
                Promise.all([
                    getRecentMemoriesWithFilenames('short-term', 30),
                    getRecentMemoriesWithFilenames('long-term', 20),
                ]).then(([stm, ltm]) => {
                    const STOP = new Set([
                        'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
                        'from','is','are','was','were','be','been','being','have','has','had','do',
                        'does','did','will','would','could','should','may','might','that','this',
                        'these','those','it','its','i','you','he','she','we','they','me','him','her',
                        'us','them','my','your','his','our','their','what','which','who','how','when',
                        'where','why','not','no','so','as','if','then','than','about','up','out','also',
                        'chat','handsfree','user','timestamp','summary','content','context','null','undefined',
                    ]);
                    const freq: Record<string, number> = {};
                    for (const { data: d } of [...stm, ...ltm]) {
                        const texts = [d.summary, d.content, d.user, d.ai, d.context].filter(Boolean).join(' ');
                        texts.toLowerCase().replace(/[^a-z0-9Ã¤Ã¶Ã¼ÃŸ ]/g, ' ').split(/\s+/)
                            .filter(w => w.length > 3 && !STOP.has(w))
                            .forEach(w => { freq[w] = (freq[w] || 0) + 1; });
                    }
                    setMemoryWords(Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([word, count]) => ({ word, count })));
                }).catch(() => { });
            })
            .catch(err => {
                console.error("Critical Init Error:", err);
                setLoading(false);
                // Set a special error state in data to render the error
                setData({
                    error: true,
                    message: err.message || "Failed to connect to Hands Free Core.",
                    details: JSON.stringify(err, null, 2)
                });
            });
    }, [router]);

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-lime-500/10 border border-lime-500/20 flex items-center justify-center animate-float">
                <span className="text-2xl">ðŸ¦Ž</span>
            </div>
            <p className="text-sm font-medium animate-pulse" style={{ color: 'var(--text-muted)' }}>
                {t('common.loading')}
            </p>
        </div>
    );

    if (data?.error) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
                <Activity size={32} />
            </div>
            <h1 className="text-2xl font-bold text-red-500">{t('dashboard.startupFailed')}</h1>
            <div className="max-w-lg bg-red-950/20 border border-red-500/20 rounded-xl p-4 overflow-auto text-left">
                <p className="font-mono text-xs text-red-300 whitespace-pre-wrap">
                    {data.message}
                </p>
                {data.details && data.details !== '{}' && (
                    <pre className="mt-2 text-[10px] text-red-400/70">{data.details}</pre>
                )}
            </div>
            <p className="text-muted-foreground text-sm">
                {t('dashboard.startupFailedHint')}
            </p>
            <Link href="/settings" className="px-4 py-2 bg-secondary rounded-lg text-sm">
                {t('dashboard.goToSettings')}
            </Link>
        </div>
    );

    const d = data || {
        persona: 'default',
        activeProvider: 'openrouter',
        model: 'unknown',
        connected: false,
        ollamaRunning: false,
        enabledProviders: [],
        sessions: [],
        stats: { totalSessions: 0, totalMessages: 0, enabledProviderCount: 0 },
    };

    return (
        <div className="min-h-screen p-6 lg:p-8">

            {/* â”€â”€ Update Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {updateBanner && !updateBannerDismissed && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border mb-5 animate-fadeIn"
                    style={{ background: 'rgba(132,204,22,0.08)', borderColor: 'rgba(132,204,22,0.3)' }}>
                    <div className="flex items-center gap-2 text-sm">
                        <Icon icon={Download} size={15} className="text-lime-400 shrink-0" />
                        <span style={{ color: 'var(--text-secondary)' }}>
                            <span className="font-semibold text-lime-400">Hands Free v{updateBanner.version}</span> {t('dashboard.updateAvailable')}
                        </span>
                        <Link href="/update"
                            className="font-semibold text-lime-400 hover:text-lime-300 underline underline-offset-2 transition-colors">
                            {t('dashboard.viewUpdate')}
                        </Link>
                    </div>
                    <button
                        onClick={() => setUpdateBannerDismissed(true)}
                        className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--surface-light)] transition-all"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label="Dismiss update banner"
                    >
                        <Icon icon={X} size={13} />
                    </button>
                </div>
            )}

            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl border mb-8 animate-fadeIn"
                style={{
                    borderColor: 'var(--border)',
                    background: 'linear-gradient(135deg, var(--surface) 0%, var(--background) 100%)',
                }}>
                <div className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at top right, rgba(132,204,22,0.08), transparent 70%)' }} />
                <div className="relative p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                            {greeting}! ðŸ‘‹
                        </h1>
                        <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {t('onboarding.heroDescription')}
                            {d.connected
                                ? ` ${t('onboarding.connected', { provider: d.activeProvider })}`
                                : ` ${t('onboarding.notConnected')}`
                            }
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                style={{ background: 'rgba(132, 204, 22, 0.15)', color: '#84cc16' }}>
                                <Wrench size={10} /> {t('onboarding.agentModeActive')}
                            </span>
                        </div>
                    </div>
                    <Link
                        href="/chat"
                        className="px-6 py-3 bg-lime-500 hover:bg-lime-400 rounded-xl font-bold text-black transition-all shadow-lg shadow-lime-500/20 hover:scale-[1.03] active:scale-95 flex items-center gap-2 shrink-0 group"
                    >
                        <MessageCircle size={20} className="group-hover:-translate-y-0.5 transition-transform" />
                        {t('onboarding.newChat')}
                    </Link>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
                <StatCard
                    icon={<Activity size={18} className="text-lime-500" />}
                    label={t('onboarding.status.online')}
                    value={d.connected ? t('onboarding.status.online') : t('onboarding.status.offline')}
                    detail={d.connected ? d.activeProvider : t('onboarding.status.noApiKey')}
                    color={d.connected ? 'lime' : 'red'}
                />
                <StatCard
                    icon={<MessageCircle size={18} className="text-blue-500" />}
                    label={t('onboarding.stats.sessionsLabel')}
                    value={d.stats.totalMessages.toString()}
                    detail={t('onboarding.stats.sessions', { count: d.stats.totalSessions })}
                    color="blue"
                />
                <StatCard
                    icon={<Server size={18} className="text-purple-500" />}
                    label={t('onboarding.connections.title')}
                    value={d.stats.enabledProviderCount.toString()}
                    detail={d.enabledProviders.join(', ') || t('onboarding.connections.notConfigured')}
                    color="purple"
                />
                <StatCard
                    icon={<Bot size={18} className="text-amber-500" />}
                    label={t('onboarding.stats.activePersonality')}
                    value={d.persona.charAt(0).toUpperCase() + d.persona.slice(1)}
                    detail={t('onboarding.stats.activePersonality')}
                    color="amber"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 stagger-children">
                {/* Connection Hub */}
                <div className="lg:col-span-1 rounded-2xl border p-6 card-interactive"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <h2 className="text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}>
                        <Wifi size={16} className="text-lime-500" />
                        {t('onboarding.connections.title')}
                    </h2>
                    <div className="space-y-3">
                        {/* LLM Connection */}
                        <ConnectionItem
                            label={t('dashboard.connections.aiBrain')}
                            detail={d.connected ? `${d.activeProvider} Â· ${d.model}` : t('onboarding.connections.notConfigured')}
                            connected={d.connected}
                            activeLabel={t('dashboard.connections.active')}
                            offLabel={t('dashboard.connections.off')}
                        />
                        {/* Ollama */}
                        <ConnectionItem
                            label={t('dashboard.connections.localAI')}
                            detail={d.ollamaRunning ? t('onboarding.connections.runningLocally') : t('onboarding.connections.notRunning')}
                            connected={d.ollamaRunning}
                            activeLabel={t('dashboard.connections.active')}
                            offLabel={t('dashboard.connections.off')}
                        />
                        {/* Messenger integrations */}
                        <ConnectionItem
                            label={t('dashboard.connections.telegram')}
                            detail={d.telegramConnected ? t('onboarding.connections.active') : t('onboarding.connections.notConfigured')}
                            connected={d.telegramConnected}
                            activeLabel={t('dashboard.connections.active')}
                            offLabel={t('dashboard.connections.off')}
                        />
                        <ConnectionItem
                            label={t('dashboard.connections.whatsapp')}
                            detail={d.whatsappConnected ? (d.whatsappPhone ? `+${d.whatsappPhone}` : t('onboarding.connections.active')) : t('onboarding.connections.notConfigured')}
                            connected={d.whatsappConnected}
                            activeLabel={t('dashboard.connections.active')}
                            offLabel={t('dashboard.connections.off')}
                        />

                        <Link href="/settings"
                            className="flex items-center justify-center gap-2 mt-4 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all hover:border-lime-500/50 hover:bg-lime-500/5"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                            <Plus size={14} />
                            {t('onboarding.connections.manageConnections')}
                        </Link>
                    </div>
                </div>

                {/* Memory Topics Word Cluster */}
                <div className="lg:col-span-1 rounded-2xl border p-6 flex flex-col"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <h2 className="text-sm font-bold mb-1 flex items-center gap-2 uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}>
                        <Brain size={16} className="text-purple-500" />
                        {t('onboarding.memoryTopics.title')}
                    </h2>
                    <p className="text-[10px] mb-4" style={{ color: 'var(--text-muted)' }}>
                        {t('onboarding.memoryTopics.subtitle')}
                    </p>
                    {memoryWords.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                            <Brain size={28} className="mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('onboarding.memoryTopics.noMemories')}</p>
                            <Link href="/memory" className="text-[10px] mt-2 text-lime-500 hover:text-lime-400">
                                {t('onboarding.memoryTopics.goToMemory')}
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 flex flex-wrap gap-1.5 items-center justify-center content-center min-h-[120px]">
                                {(() => {
                                    const maxC = memoryWords[0]?.count || 1;
                                    const minC = memoryWords[memoryWords.length - 1]?.count || 1;
                                    return memoryWords.map(({ word, count }) => {
                                        const norm = maxC === minC ? 0.5 : (count - minC) / (maxC - minC);
                                        const fontSize = Math.round(10 + norm * 12);
                                        const opacity = 0.45 + norm * 0.55;
                                        const lightness = Math.round(45 + norm * 25);
                                        return (
                                            <span key={word} title={`${count}Ã—`}
                                                style={{
                                                    fontSize: `${fontSize}px`,
                                                    opacity,
                                                    color: `hsl(85, 65%, ${lightness}%)`,
                                                    fontWeight: norm > 0.6 ? 700 : norm > 0.3 ? 600 : 400,
                                                    cursor: 'default',
                                                    lineHeight: '1.7',
                                                }}>
                                                {word}
                                            </span>
                                        );
                                    });
                                })()}
                            </div>
                            <Link href="/memory"
                                className="mt-4 text-[10px] text-center font-medium hover:text-lime-500 transition-colors"
                                style={{ color: 'var(--text-muted)' }}>
                                {t('onboarding.memoryTopics.viewAll')}
                            </Link>
                        </>
                    )}
                </div>

                {/* Recent Sessions */}
                <div className="lg:col-span-2 rounded-2xl border p-6"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider"
                            style={{ color: 'var(--text-muted)' }}>
                            <MessageCircle size={16} className="text-blue-500" />
                            {t('onboarding.recentSessions.title')}
                        </h2>
                        <Link href="/chat" className="text-xs font-medium text-lime-500 hover:text-lime-400 flex items-center gap-1">
                            {t('onboarding.recentSessions.viewAll')} <ChevronRight size={12} />
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {d.sessions.length === 0 ? (
                            <div className="text-center py-12 rounded-xl border border-dashed"
                                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                                <MessageCircle size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                    {t('onboarding.recentSessions.noConversations')}
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                    {t('onboarding.recentSessions.startChat')}
                                </p>
                                <Link href="/chat"
                                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-lime-500 hover:bg-lime-400 text-black text-sm font-bold rounded-xl transition-all">
                                    <Plus size={14} /> {t('onboarding.recentSessions.startChatButton')}
                                </Link>
                            </div>
                        ) : d.sessions.map((s: any) => (
                            <Link key={s.id} href={`/chat?session=${s.id}`}
                                className="flex items-center gap-4 p-4 rounded-xl border transition-all hover:border-lime-500/30 group"
                                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: 'var(--surface-light)' }}>
                                    <MessageCircle size={16} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                        {s.title}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {t('onboarding.recentSessions.messageCount', { count: s.messageCount, date: new Date(s.updatedAt).toLocaleDateString() })}
                                    </p>
                                </div>
                                <ArrowRight size={14} className="text-lime-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Agent Capabilities */}
            <div className="mt-8 rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    <Wrench size={16} className="text-lime-500" />
                    {t('onboarding.capabilities.title')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <CapabilityItem icon={<FolderPlus size={16} />} label={t('onboarding.capabilities.fileSystem')} desc={t('onboarding.capabilities.fileSystemDesc')} />
                    <CapabilityItem icon={<Terminal size={16} />} label={t('onboarding.capabilities.commands')} desc={t('onboarding.capabilities.commandsDesc')} />
                    <CapabilityItem icon={<Globe size={16} />} label={t('onboarding.capabilities.webAccess')} desc={t('onboarding.capabilities.webAccessDesc')} />
                    <CapabilityItem icon={<ListTodo size={16} />} label={t('onboarding.capabilities.tasks')} desc={t('onboarding.capabilities.tasksDesc')} />
                    <CapabilityItem icon={<Brain size={16} />} label={t('onboarding.capabilities.memory')} desc={t('onboarding.capabilities.memoryDesc')} />
                    <CapabilityItem icon={<Bot size={16} />} label={t('onboarding.capabilities.multiAgent')} desc={t('onboarding.capabilities.multiAgentDesc')} />
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-children">
                <QuickAction href="/tasks" icon={<Zap size={20} />} label={t('onboarding.quickActions.createTask')} color="amber" />
                <QuickAction href="/chat" icon={<MessageCircle size={20} />} label={t('onboarding.quickActions.chat')} color="lime" />
                <QuickAction href="/agents" icon={<Bot size={20} />} label={t('onboarding.quickActions.agents')} color="purple" />
                <QuickAction href="/settings" icon={<SettingsIcon size={20} />} label={t('onboarding.quickActions.settings')} color="gray" />
            </div>
        </div>
    );
}

// â”€â”€â”€ Sub-Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatCard({ icon, label, value, detail, color }: {
    icon: React.ReactNode; label: string; value: string; detail: string; color: string;
}) {
    const colorMap: Record<string, string> = {
        lime: 'rgba(132,204,22,0.08)',
        blue: 'rgba(59,130,246,0.08)',
        purple: 'rgba(168,85,247,0.08)',
        amber: 'rgba(245,158,11,0.08)',
        red: 'rgba(239,68,68,0.08)',
        gray: 'rgba(107,114,128,0.08)',
    };
    return (
        <div className="rounded-2xl border p-5 transition-all hover:shadow-md"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: colorMap[color] || colorMap.gray }}>
                    {icon}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {label}
                </span>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{detail}</p>
        </div>
    );
}

function ConnectionItem({ label, detail, connected, activeLabel, offLabel }: {
    label: string; detail: string; connected: boolean; activeLabel?: string; offLabel?: string;
}) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl border transition-all"
            style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <div className={`status-dot ${connected ? 'online' : 'offline'}`} />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{detail}</p>
            </div>
            <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
                {connected ? (activeLabel || 'Active') : (offLabel || 'Off')}
            </span>
        </div>
    );
}

function QuickAction({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color: string }) {
    const colorMap: Record<string, string> = {
        amber: 'rgba(245,158,11,0.08)',
        blue: 'rgba(59,130,246,0.08)',
        purple: 'rgba(168,85,247,0.08)',
        gray: 'rgba(107,114,128,0.08)',
        lime: 'rgba(132,204,22,0.08)',
    };
    return (
        <Link href={href}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl border text-center transition-all hover:shadow-md hover:border-lime-500/30 hover:-translate-y-0.5 group"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: colorMap[color] || colorMap.gray, color: 'var(--text-secondary)' }}>
                {icon}
            </div>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        </Link>
    );
}

function CapabilityItem({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
    return (
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all hover:border-lime-500/30"
            style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(132,204,22,0.1)', color: '#84cc16' }}>
                {icon}
            </div>
            <span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>{label}</span>
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{desc}</span>
        </div>
    );
}
