/**
 * /feedback â€” Unified Feedback Page
 *
 * Three sections:
 *   1. Rate Hands Free (emoji buttons â†’ immediate send)
 *   2. Report a Bug (copy of bug-report modal form)
 *   3. Request a Feature (text + category dropdown)
 *
 * GDPR: All submissions check telemetry opt-in BEFORE sending.
 * If opt-in is disabled, UI renders normally but shows a note and
 * does NOT transmit any data.
 */

'use client';

import { useState, useEffect }          from 'react';
import Link                             from 'next/link';
import { ArrowLeft, Bug, Send, Lightbulb, Star, ChevronDown } from 'lucide-react';
import { useTranslation }               from '@/lib/i18n';
import { APP_VERSION }                  from '@/lib/meta';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type RatingValue = 'love_it' | 'great' | 'needs_improvement' | 'unnecessary';

const RATINGS: { value: RatingValue; emoji: string; colorClass: string; bgStyle: string }[] = [
    { value: 'love_it',            emoji: 'ðŸŸ¢', colorClass: 'text-green-400',  bgStyle: 'rgba(74,222,128,0.15)' },
    { value: 'great',              emoji: 'ðŸ”µ', colorClass: 'text-blue-400',   bgStyle: 'rgba(96,165,250,0.15)' },
    { value: 'needs_improvement',  emoji: 'ðŸŸ¡', colorClass: 'text-yellow-400', bgStyle: 'rgba(250,204,21,0.15)' },
    { value: 'unnecessary',        emoji: 'ðŸ”´', colorClass: 'text-red-400',    bgStyle: 'rgba(248,113,113,0.15)' },
];

const CATEGORIES = ['performance', 'new_integration', 'ui_ux', 'other'] as const;
type Category = typeof CATEGORIES[number];

const FEEDBACK_ENDPOINT    = '/api/feedback';
const BUG_REPORT_ENDPOINT  = '/api/bug-report';
const MIN_BUG_LENGTH       = 20;
const MIN_FEATURE_LENGTH   = 10;

// â”€â”€â”€ Helper: read settings client-side â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function loadClientSettings(): Promise<{ telemetryEnabled: boolean; anonymousId: string; os: string }> {
    try {
        const res = await fetch('/api/settings/get');
        if (!res.ok) return { telemetryEnabled: false, anonymousId: '', os: '' };
        const data = await res.json();
        return {
            telemetryEnabled: !!data.telemetry_enabled,
            anonymousId:      data.telemetry_anonymous_id ?? '',
            os:               (typeof navigator !== 'undefined') ? navigator.platform : 'unknown',
        };
    } catch {
        return { telemetryEnabled: false, anonymousId: '', os: '' };
    }
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function FeedbackPage() {
    const { t } = useTranslation();

    // Global state
    const [telemetryEnabled, setTelemetryEnabled] = useState<boolean | null>(null); // null = loading
    const [anonymousId, setAnonymousId]           = useState('');
    const [osInfo, setOsInfo]                     = useState('');

    // Section 1: Rating
    const [selectedRating, setSelectedRating]     = useState<RatingValue | null>(null);
    const [ratingMessage, setRatingMessage]       = useState('');
    const [ratingStatus, setRatingStatus]         = useState<'idle' | 'sending' | 'done'>('idle');

    // Section 2: Bug Report
    const [bugDesc, setBugDesc]                   = useState('');
    const [bugSystemInfo, setBugSystemInfo]       = useState(true);
    const [bugStatus, setBugStatus]               = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
    const [bugError, setBugError]                 = useState('');

    // Section 3: Feature Request
    const [featureText, setFeatureText]           = useState('');
    const [featureCategory, setFeatureCategory]   = useState<Category>('other');
    const [featureStatus, setFeatureStatus]       = useState<'idle' | 'sending' | 'done'>('idle');

    // â”€â”€ Load settings on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        loadClientSettings().then(s => {
            setTelemetryEnabled(s.telemetryEnabled);
            setAnonymousId(s.anonymousId);
            setOsInfo(s.os);
        });
    }, []);

    // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const sendFeedback = async (payload: Record<string, string>) => {
        if (!telemetryEnabled) return;
        try {
            await fetch(FEEDBACK_ENDPOINT, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });
        } catch {
            // Silent fail â€” feedback is non-critical
        }
    };

    // â”€â”€ Section 1: Handle rating click â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const handleRating = async (rating: RatingValue) => {
        setSelectedRating(rating);
        if (!telemetryEnabled) return;
        setRatingStatus('sending');
        await sendFeedback({
            subtype:      'rating',
            rating,
            version:      APP_VERSION,
            os:           osInfo,
            anonymous_id: anonymousId,
            timestamp:    new Date().toISOString(),
        });
        setRatingStatus('done');
    };

    const handleRatingMessageSubmit = async () => {
        if (!telemetryEnabled || !selectedRating || !ratingMessage.trim()) return;
        await sendFeedback({
            subtype:      'rating',
            rating:       selectedRating,
            message:      ratingMessage.trim(),
            version:      APP_VERSION,
            os:           osInfo,
            anonymous_id: anonymousId,
            timestamp:    new Date().toISOString(),
        });
        setRatingMessage('');
    };

    // â”€â”€ Section 2: Handle bug report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const handleBugSubmit = async () => {
        const trimmed = bugDesc.trim();
        if (trimmed.length < MIN_BUG_LENGTH) {
            setBugError(t('bugReport.tooShort'));
            return;
        }
        setBugStatus('sending');
        setBugError('');

        const payload: Record<string, string> = {
            type:        'bugreport',
            version:     APP_VERSION,
            description: trimmed,
        };
        if (bugSystemInfo) {
            payload.os = osInfo;
        }

        try {
            await fetch(BUG_REPORT_ENDPOINT, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
            });
        } catch {
            // Bug reports don't require telemetry opt-in (sent to /api/bug-report)
        }
        setBugStatus('done');
        setTimeout(() => { setBugStatus('idle'); setBugDesc(''); }, 3000);
    };

    // â”€â”€ Section 3: Handle feature request â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const handleFeatureSubmit = async () => {
        if (!telemetryEnabled) return;
        if (featureText.trim().length < MIN_FEATURE_LENGTH) return;
        setFeatureStatus('sending');
        await sendFeedback({
            subtype:      'feature_request',
            category:     featureCategory,
            message:      featureText.trim(),
            version:      APP_VERSION,
            os:           osInfo,
            anonymous_id: anonymousId,
            timestamp:    new Date().toISOString(),
        });
        setFeatureStatus('done');
        setTimeout(() => { setFeatureStatus('idle'); setFeatureText(''); }, 3000);
    };

    // â”€â”€ Category i18n keys â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const categoryLabel = (cat: Category) => {
        const map: Record<Category, string> = {
            performance:     t('feedback.categoryPerformance'),
            new_integration: t('feedback.categoryIntegration'),
            ui_ux:           t('feedback.categoryUiUx'),
            other:           t('feedback.categoryOther'),
        };
        return map[cat];
    };

    const ratingLabel = (val: RatingValue) => {
        const map: Record<RatingValue, string> = {
            love_it:            t('feedback.loveIt'),
            great:              t('feedback.great'),
            needs_improvement:  t('feedback.needsImprovement'),
            unnecessary:        t('feedback.unnecessary'),
        };
        return map[val];
    };

    // â”€â”€ Shared styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const cardStyle = {
        background:  'var(--surface)',
        border:      '1px solid var(--border)',
        borderRadius: '16px',
        padding:     '24px',
    };

    const inputStyle = {
        background:  'var(--surface-raised)',
        borderColor: 'var(--border)',
        color:       'var(--text-primary)',
    };

    // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    return (
        <div className="min-h-screen p-6 md:p-10" style={{ background: 'var(--bg)' }}>
            <div className="max-w-2xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                    <Link href="/settings"
                        className="p-2 rounded-xl transition-all hover:bg-[var(--surface-raised)]"
                        style={{ color: 'var(--text-muted)' }}>
                        <ArrowLeft size={18} />
                    </Link>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {t('feedback.title')}
                    </h1>
                </div>

                {/* Telemetry toggle â€” always visible, two-way */}
                {telemetryEnabled !== null && (
                    <div className="rounded-xl px-4 py-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {t('feedback.telemetrySection')}
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                    {t('feedback.telemetrySectionDesc')}
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    const next = !telemetryEnabled;
                                    try {
                                        const { saveAllSettings } = await import('@/actions/chat');
                                        await saveAllSettings({ telemetry_enabled: next } as any);
                                        setTelemetryEnabled(next);
                                    } catch { setTelemetryEnabled(next); }
                                }}
                                className="relative flex-shrink-0 w-12 h-6 rounded-full transition-all duration-200"
                                style={{ background: telemetryEnabled ? '#84cc16' : 'var(--surface-raised)', border: '1px solid var(--border)' }}
                                aria-label={telemetryEnabled ? t('feedback.telemetryOn') : t('feedback.telemetryOff')}
                            >
                                <span
                                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
                                    style={{ left: telemetryEnabled ? '26px' : '2px' }}
                                />
                            </button>
                        </div>
                        <p className="text-xs mt-2" style={{ color: telemetryEnabled ? '#84cc16' : 'var(--text-muted)' }}>
                            {telemetryEnabled ? t('feedback.telemetryOn') : t('feedback.telemetryOff')}
                        </p>
                        {telemetryEnabled === false && (
                            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                                {t('feedback.telemetryHint')}
                            </p>
                        )}
                    </div>
                )}

                {/* â”€â”€â”€ Section 1: Rate Hands Free â”€â”€â”€ */}
                <section style={cardStyle}>
                    <div className="flex items-center gap-2 mb-4">
                        <Star size={18} style={{ color: '#facc15' }} />
                        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {t('feedback.rateTitle')}
                        </h2>
                    </div>

                    {ratingStatus === 'done' && !ratingMessage ? (
                        <p className="text-sm text-green-400 py-4 text-center">
                            {t('feedback.thankYouRating')}
                        </p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {RATINGS.map(r => (
                                    <button
                                        key={r.value}
                                        onClick={() => handleRating(r.value)}
                                        disabled={ratingStatus === 'sending'}
                                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95 ${
                                            selectedRating === r.value ? 'ring-2 ring-lime-400/50' : ''
                                        }`}
                                        style={{
                                            background: selectedRating === r.value ? r.bgStyle : 'var(--surface-raised)',
                                            border:     selectedRating === r.value
                                                ? `1px solid ${r.bgStyle.replace('0.15', '0.5')}`
                                                : '1px solid var(--border)',
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        <span className="text-2xl">{r.emoji}</span>
                                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            {ratingLabel(r.value)}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Optional message after rating */}
                            {selectedRating && ratingStatus === 'done' && (
                                <div className="mt-4 space-y-2">
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                                        style={inputStyle}
                                        placeholder={t('feedback.tellUsMore')}
                                        value={ratingMessage}
                                        onChange={e => setRatingMessage(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleRatingMessageSubmit(); }}
                                        maxLength={500}
                                    />
                                    {ratingMessage.trim() && (
                                        <button
                                            onClick={handleRatingMessageSubmit}
                                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-500 hover:bg-green-600 text-white transition-all"
                                        >
                                            <Send size={13} className="inline mr-1" />
                                            {t('feedback.submitFeature')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </section>

                {/* â”€â”€â”€ Section 2: Report a Bug â”€â”€â”€ */}
                <section style={cardStyle}>
                    <div className="flex items-center gap-2 mb-4">
                        <Bug size={18} style={{ color: 'var(--text-primary)' }} />
                        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {t('feedback.reportBug')}
                        </h2>
                    </div>

                    {bugStatus === 'done' ? (
                        <p className="text-sm text-green-400 py-4 text-center">
                            {t('bugReport.success')}
                        </p>
                    ) : (
                        <>
                            <textarea
                                className="w-full rounded-xl border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                                style={{ ...inputStyle, minHeight: '120px' }}
                                placeholder={t('bugReport.placeholder')}
                                value={bugDesc}
                                onChange={e => { setBugDesc(e.target.value); setBugError(''); }}
                                disabled={bugStatus === 'sending'}
                                maxLength={2000}
                            />

                            <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={bugSystemInfo}
                                    onChange={e => setBugSystemInfo(e.target.checked)}
                                    disabled={bugStatus === 'sending'}
                                    className="rounded"
                                />
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    {t('bugReport.includeSystemInfo')}
                                </span>
                            </label>

                            {bugError && <p className="text-xs text-red-400 mt-2">{bugError}</p>}

                            <button
                                onClick={handleBugSubmit}
                                disabled={bugStatus === 'sending' || bugDesc.trim().length < MIN_BUG_LENGTH}
                                className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {bugStatus === 'sending' ? (
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
                </section>

                {/* â”€â”€â”€ Section 3: Request a Feature â”€â”€â”€ */}
                <section style={cardStyle}>
                    <div className="flex items-center gap-2 mb-4">
                        <Lightbulb size={18} style={{ color: '#facc15' }} />
                        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {t('feedback.requestFeature')}
                        </h2>
                    </div>

                    {featureStatus === 'done' ? (
                        <p className="text-sm text-green-400 py-4 text-center">
                            {t('feedback.thankYouFeature')}
                        </p>
                    ) : (
                        <>
                            <textarea
                                className="w-full rounded-xl border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                                style={{ ...inputStyle, minHeight: '100px' }}
                                placeholder={t('feedback.featurePlaceholder')}
                                value={featureText}
                                onChange={e => setFeatureText(e.target.value)}
                                disabled={featureStatus === 'sending'}
                                maxLength={2000}
                            />

                            <div className="mt-3">
                                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                                    {t('feedback.categoryLabel')}
                                </label>
                                <div className="relative">
                                    <select
                                        value={featureCategory}
                                        onChange={e => setFeatureCategory(e.target.value as Category)}
                                        disabled={featureStatus === 'sending'}
                                        className="w-full rounded-xl border px-3 py-2 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                                        style={inputStyle}
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{categoryLabel(cat)}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                                </div>
                            </div>

                            <button
                                onClick={handleFeatureSubmit}
                                disabled={featureStatus === 'sending' || featureText.trim().length < MIN_FEATURE_LENGTH || !telemetryEnabled}
                                className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {featureStatus === 'sending' ? (
                                    <span className="animate-pulse">{t('feedback.submitFeature')}â€¦</span>
                                ) : (
                                    <>
                                        <Send size={15} />
                                        {t('feedback.submitFeature')}
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
