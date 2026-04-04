'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle, Zap, Shield } from 'lucide-react';
import { checkForUpdates, type UpdateCheckResult } from '@/actions/updates';
import { useTranslation } from '@/lib/i18n';

const Icon = ({ icon: I, ...props }: { icon: any; [key: string]: any }) => {
    const C = I;
    return <C {...props} />;
};

export default function UpdatePage() {
    const { t } = useTranslation();
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<UpdateCheckResult | null>(null);

    const handleCheck = async () => {
        setChecking(true);
        try { setResult(await checkForUpdates()); }
        catch { /* ignore */ }
        finally { setChecking(false); }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-5">

            {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    ðŸ”„ {t('updates.autoUpdates')}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t('updates.autoUpdatesDescription')}
                </p>
            </div>

            {/* â”€â”€ Auto-update badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="rounded-2xl border p-5 flex items-start gap-4"
                style={{ background: 'var(--surface)', borderColor: 'rgba(132,204,22,0.35)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(132,204,22,0.12)', border: '1px solid rgba(132,204,22,0.3)' }}>
                    <Icon icon={Zap} size={20} className="text-lime-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-lime-400">Built-in auto-updater active</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Hands Free uses <code className="px-1 rounded" style={{ background: 'var(--surface-light)' }}>electron-updater</code> to
                        check for new versions automatically. When an update is available,
                        you'll be notified to download it from handsfree.app.
                    </p>
                </div>
            </div>

            {/* â”€â”€ Version status after manual check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {result && (
                <div className={`rounded-2xl border p-4 flex items-center gap-3 ${result.updateAvailable ? 'text-lime-400' : 'text-green-400'}`}
                    style={{
                        background: result.updateAvailable ? 'rgba(132,204,22,0.07)' : 'rgba(34,197,94,0.07)',
                        borderColor: result.updateAvailable ? 'rgba(132,204,22,0.4)' : 'rgba(34,197,94,0.3)',
                    }}>
                    <Icon icon={CheckCircle} size={18} className="shrink-0" />
                    <div>
                        {result.updateAvailable
                            ? <p className="text-sm font-semibold">Update available: v{result.updateInfo?.version}. <a href="https://handsfree.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-lime-300">Download at handsfree.app</a></p>
                            : <p className="text-sm font-semibold">You&apos;re on the latest version (v{result.currentVersion}).</p>
                        }
                        {result.error && <p className="text-xs mt-0.5 text-red-400">{result.error}</p>}
                    </div>
                </div>
            )}

            {/* â”€â”€ Check Now button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <button
                onClick={handleCheck}
                disabled={checking}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold text-sm transition-all disabled:opacity-50">
                <Icon icon={RefreshCw} size={15} className={checking ? 'animate-spin' : ''} />
                {checking ? t('update.checking') : t('updates.checkNow')}
            </button>

            {/* â”€â”€ Security note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="rounded-xl border px-4 py-3 flex items-start gap-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <Icon icon={Shield} size={15} className="text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{t('update.security')} </span>
                    Updates fetched from <code className="px-1 rounded" style={{ background: 'var(--surface-light)' }}>handsfree.app</code> (hardcoded).
                    SHA-256 verified. Your <code className="px-1 rounded" style={{ background: 'var(--surface-light)' }}>.handsfree-data/</code> is never touched during updates.
                </p>
            </div>

            {/* â”€â”€ Social links â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
                <a href="https://x.com/handsfree_ai" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--text-secondary)', transition: 'color 0.15s' }}
                   onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                   onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://instagram.com/handsfree.app" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--text-secondary)', transition: 'color 0.15s' }}
                   onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                   onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>
                <a href="https://tiktok.com/@handsfree.app" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--text-secondary)', transition: 'color 0.15s' }}
                   onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                   onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.51a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.83 4.83 0 0 1-1-.15z"/></svg>
                </a>
                <a href="https://youtube.com/@handsfreeai" target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--text-secondary)', transition: 'color 0.15s' }}
                   onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                   onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path d="M9.545 15.568V8.432L15.818 12z" fill="var(--bg-base, #0b0f19)"/></svg>
                </a>
            </div>

        </div>
    );
}
