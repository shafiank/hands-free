/**
 * BugReportModal â€” "Report a Bug" dialog
 *
 * Collects a free-text bug description from the user and POSTs it to
 * https://handsfree.app/api/collect.php  (type: "bugreport").
 *
 * Privacy rules (same as telemetry):
 *  - Never sends API keys, conversations, file contents, stack traces,
 *    or any user-identifiable information.
 *  - Only sends: app version, OS platform, anonymous UUID from settings,
 *    and the user-typed description.
 *
 * Fallback: if the network request fails the report is appended locally
 * to <DATA_DIR>/bugreports.jsonl so it can be reviewed later.
 *
 * NOTE (Mario): ensure "bugreport" is in the allowed types list in collect.php
 */

'use client';

import { useState }          from 'react';
import { Bug, X, Send }      from 'lucide-react';
import { useTranslation }    from '@/lib/i18n';
import { APP_VERSION }       from '@/lib/meta';

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Routes through a server-side Next.js API endpoint so the Electron renderer
// never makes a direct cross-origin fetch (which would be blocked by CORS/CSP).
// The server-side route proxies to https://handsfree.app/api/collect.php â€” same
// pattern as /api/handsfree-plus/waitlist which already works correctly.
const BUG_REPORT_ENDPOINT = '/api/bug-report';
const MIN_LENGTH           = 20; // characters

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface BugReportModalProps {
    open:    boolean;
    onClose: () => void;
}

export default function BugReportModal({ open, onClose }: BugReportModalProps) {
    const { t } = useTranslation();
    const [description, setDescription] = useState('');
    const [includeSystemInfo, setIncludeSystemInfo] = useState(true);
    const [status, setStatus]   = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    if (!open) return null;

    const handleClose = () => {
        if (status === 'sending') return;
        setDescription('');
        setStatus('idle');
        setErrorMsg('');
        onClose();
    };

    const handleSend = async () => {
        const trimmed = description.trim();
        if (trimmed.length < MIN_LENGTH) {
            setErrorMsg(t('bugReport.tooShort'));
            return;
        }

        setStatus('sending');
        setErrorMsg('');

        const payload: Record<string, string> = {
            type:        'bugreport',
            version:     APP_VERSION,
            description: trimmed,
        };

        if (includeSystemInfo) {
            payload.os = (typeof navigator !== 'undefined') ? navigator.platform : 'unknown';
        }

        // POST to the server-side proxy route (same origin â€” no CORS issues).
        // The route forwards the report to collect.php server-to-server and
        // saves it locally as a fallback if the remote call fails.
        try {
            console.log('[BugReport] Submitting via /api/bug-reportâ€¦');
            const res = await fetch(BUG_REPORT_ENDPOINT, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            console.log('[BugReport] Route response:', data);
        } catch (err) {
            // Network error reaching our own API route â€” extremely unlikely
            console.error('[BugReport] Failed to reach /api/bug-report:', err);
        }

        setStatus('success');

        // Auto-close after 2.5 s
        setTimeout(() => {
            handleClose();
        }, 2500);
    };

    // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
        >
            {/* Dialog */}
            <div
                className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Bug size={20} style={{ color: 'var(--text-primary)' }} />
                        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {t('bugReport.title')}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1 rounded-lg transition-all hover:bg-[var(--surface-raised)]"
                        style={{ color: 'var(--text-muted)' }}
                        disabled={status === 'sending'}
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {status === 'success' ? (
                    /* Success state */
                    <div className="py-8 flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(74,222,128,0.15)' }}>
                            <Send size={22} className="text-green-400" />
                        </div>
                        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                            {t('bugReport.success')}
                        </p>
                    </div>
                ) : (
                    /* Form */
                    <>
                        <textarea
                            className="w-full rounded-xl border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                            style={{
                                background:   'var(--surface-raised)',
                                borderColor:  'var(--border)',
                                color:        'var(--text-primary)',
                                minHeight:    '120px',
                            }}
                            placeholder={t('bugReport.placeholder')}
                            value={description}
                            onChange={e => { setDescription(e.target.value); setErrorMsg(''); }}
                            disabled={status === 'sending'}
                            maxLength={2000}
                        />

                        {/* Include system info toggle */}
                        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={includeSystemInfo}
                                onChange={e => setIncludeSystemInfo(e.target.checked)}
                                disabled={status === 'sending'}
                                className="rounded"
                            />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {t('bugReport.includeSystemInfo')}
                            </span>
                        </label>

                        {/* Error */}
                        {errorMsg && (
                            <p className="text-xs text-red-400 mt-2">{errorMsg}</p>
                        )}

                        {/* Send button */}
                        <button
                            onClick={handleSend}
                            disabled={status === 'sending' || description.trim().length < MIN_LENGTH}
                            className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'sending' ? (
                                <span className="animate-pulse">{t('bugReport.send')}â€¦</span>
                            ) : (
                                <>
                                    <Send size={15} />
                                    {t('bugReport.send')}
                                </>
                            )}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
