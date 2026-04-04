'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { FileText, AlertCircle, Info, CheckCircle, XCircle, RefreshCw, Trash2, Download, FolderOpen } from 'lucide-react';
import { getRecentLogs, clearOldLogs, exportAllLogs, getLogFilePath, type LogEntry } from '@/actions/logs';

const Icon = ({ icon: I, ...props }: { icon: any;[key: string]: any }) => {
    const Component = I;
    return <Component {...props} />;
};

export default function LogsPage() {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'success'>('all');
    const [logFilePath, setLogFilePath] = useState('');

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const [data, filePath] = await Promise.all([
                getRecentLogs(200),
                getLogFilePath(),
            ]);
            setLogs(data);
            setLogFilePath(filePath);
        } catch (e) {
            console.error('Failed to load logs:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleDownload = async () => {
        try {
            const content = await exportAllLogs();
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `handsfree-logs-${new Date().toISOString().slice(0, 10)}.jsonl`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to download logs:', e);
        }
    };

    useEffect(() => {
        loadLogs();
        // Auto-refresh every 10 seconds
        const interval = setInterval(loadLogs, 10000);
        return () => clearInterval(interval);
    }, [loadLogs]);

    const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.level === filter);

    const getIcon = (level: string) => {
        switch (level) {
            case 'success': return CheckCircle;
            case 'error': return XCircle;
            case 'warn': return AlertCircle;
            default: return Info;
        }
    };

    const getColor = (level: string) => {
        switch (level) {
            case 'success': return 'text-green-500';
            case 'error': return 'text-red-500';
            case 'warn': return 'text-yellow-500';
            default: return 'text-blue-500';
        }
    };

    const handleClearOld = async () => {
        if (confirm('Clear logs older than the last 100 entries?')) {
            await clearOldLogs(100);
            await loadLogs();
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Icon icon={FileText} size={28} />
                        {t('logs.title')}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {t('logs.subtitle', { count: logs.length })}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadLogs} className="p-2 rounded-lg hover:bg-[var(--surface-light)]" title={t('logs.refresh')}>
                        <Icon icon={RefreshCw} size={18} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--text-muted)' }} />
                    </button>
                    <button
                        onClick={handleDownload}
                        className="px-3 py-2 rounded-lg hover:bg-[var(--surface-light)] flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        title="Download log report"
                    >
                        <Icon icon={Download} size={14} />
                        {t('logs.download')}
                    </button>
                    <button onClick={handleClearOld} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500" title="Clear old logs">
                        <Icon icon={Trash2} size={18} />
                    </button>
                </div>
            </div>

            {/* Log File Path */}
            {logFilePath && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <Icon icon={FolderOpen} size={12} />
                    <span>{t('logs.logFile')} <code className="font-mono">{logFilePath}</code></span>
                </div>
            )}

            {/* Filter */}
            <div className="flex gap-2">
                {(['all', 'info', 'success', 'warn', 'error'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f
                            ? 'bg-lime-500 text-black'
                            : 'hover:bg-[var(--surface-light)]'
                            }`}
                        style={filter !== f ? { color: 'var(--text-secondary)', border: '1px solid var(--border)' } : {}}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        {f !== 'all' && (
                            <span className="ml-1 text-xs opacity-70">
                                ({logs.filter(l => l.level === f).length})
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Logs */}
            <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                {loading && logs.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>{t('logs.loading')}</p>
                ) : filteredLogs.length === 0 ? (
                    <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                        {logs.length === 0 ? t('logs.empty') : t('logs.noMatch')}
                    </p>
                ) : (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {filteredLogs.map((log, idx) => (
                            <div key={idx} className="p-3 rounded-xl border flex items-start gap-3"
                                style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
                                <Icon icon={getIcon(log.level)} size={16} className={`mt-0.5 flex-shrink-0 ${getColor(log.level)}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium break-words" style={{ color: 'var(--text-primary)' }}>
                                        {log.message}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                        {log.context && (
                                            <span className="text-xs px-2 py-0.5 rounded-full"
                                                style={{ background: 'var(--surface-light)', color: 'var(--text-muted)' }}>
                                                {log.context}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
