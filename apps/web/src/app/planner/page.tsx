'use client';

/**
 * Planner AI â€” Welcome â†’ Wizard â†’ Day/Week View
 * Conversational setup â†’ personalized daily schedules
 * Hands Free v7 â€” Session 14 + Page Fixes Session 1
 */

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { loadPlannerPreferences, savePlannerPreferences, generateDayPlan, loadDayPlan, type PlannerPreferences, type DayPlan, type TimeBlock } from '@/actions/planner';
import { Calendar, ChevronLeft, ChevronRight, Loader2, RefreshCw, ArrowUpRight, Settings } from 'lucide-react';
import Link from 'next/link';

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type ViewMode = 'day' | 'week';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export default function PlannerPage() {
    const { t } = useTranslation();
    const [preferences, setPreferences] = useState<PlannerPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [showWizard, setShowWizard] = useState(false);

    // Day view state
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
    const [showPrefsPanel, setShowPrefsPanel] = useState(false);
    const [weekPlans, setWeekPlans] = useState<{ [date: string]: DayPlan | null }>({});
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        (async () => {
            const prefs = await loadPlannerPreferences();
            if (prefs) {
                setPreferences(prefs);
                // Try loading existing plan for today
                const plan = await loadDayPlan(currentDate);
                if (plan) setDayPlan(plan);
            } else {
                setShowWizard(true);
            }
            setLoading(false);
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Load week plans when switching to week view
    useEffect(() => {
        if (viewMode === 'week') {
            (async () => {
                const base = new Date(currentDate + 'T12:00:00');
                const dow = base.getDay();
                const mondayOffset = dow === 0 ? -6 : 1 - dow;
                const newWeekPlans: { [date: string]: DayPlan | null } = {};
                for (let i = 0; i < 7; i++) {
                    const d = new Date(base);
                    d.setDate(base.getDate() + mondayOffset + i);
                    const date = d.toISOString().split('T')[0];
                    const plan = await loadDayPlan(date);
                    newWeekPlans[date] = plan || null;
                }
                setWeekPlans(newWeekPlans);
            })();
        }
    }, [viewMode, currentDate]);

    const handleWizardComplete = async (prefs: PlannerPreferences) => {
        await savePlannerPreferences(prefs);
        setPreferences(prefs);
        setShowWizard(false);
        // Generate first plan
        await handleGeneratePlan(prefs);
    };

    const handleGeneratePlan = async (prefs?: PlannerPreferences) => {
        const p = prefs || preferences;
        if (!p) return;
        setGenerating(true);
        setGenerateError(null);
        try {
            const plan = await generateDayPlan(currentDate, p);
            setDayPlan(plan);
        } catch (e: any) {
            console.error('Failed to generate plan:', e);
            setGenerateError(e?.message || t('planner.dayView.generateError'));
        } finally {
            setGenerating(false);
        }
    };

    const navigateDay = (offset: number) => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + offset);
        const newDate = d.toISOString().split('T')[0];
        setCurrentDate(newDate);
        setDayPlan(null);
        setGenerateError(null);
        // Try loading cached plan
        loadDayPlan(newDate).then(plan => { if (plan) setDayPlan(plan); });
    };

    const goToToday = () => {
        const today = new Date().toISOString().split('T')[0];
        setCurrentDate(today);
        setDayPlan(null);
        setGenerateError(null);
        loadDayPlan(today).then(plan => { if (plan) setDayPlan(plan); });
    };

    const handlePushToCalendar = async () => {
        if (!dayPlan) return;
        // NEVER push calendar-sourced events back â€” only planner-generated blocks
        const editableBlocks = dayPlan.blocks.filter(b => b.editable && b.type !== 'break' && b.source === 'planner');
        if (editableBlocks.length === 0) return;

        try {
            const res = await fetch('/api/planner/push-to-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blocks: editableBlocks, date: currentDate }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            if (data.errors?.length && data.pushed === 0) {
                const noCalendar = data.errors.some((e: string) => e.toLowerCase().includes('no calendar') || e.toLowerCase().includes('not configured'));
                setToast({
                    message: noCalendar ? t('planner.noCalendarConfigured') : `${data.errors.length} ${t('planner.toast.errors')}`,
                    type: 'error',
                });
            } else {
                setToast({
                    message: `${data.pushed} ${t('planner.toast.calendarPushSuccess')}${data.errors?.length ? ` (${data.errors.length} ${t('planner.toast.errors')})` : ''}`,
                    type: 'success',
                });
            }
        } catch (e: any) {
            const msg = e.message || '';
            const noCalendar = msg.toLowerCase().includes('no calendar') || msg.toLowerCase().includes('not configured');
            setToast({
                message: noCalendar ? t('planner.noCalendarConfigured') : `${t('planner.toast.calendarPushError')}: ${msg}`,
                type: 'error',
            });
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--background)' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    if (showWizard) {
        return <PlannerWizard onComplete={handleWizardComplete} />;
    }

    // â”€â”€â”€ Day View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const dateObj = new Date(currentDate + 'T12:00:00');
    const dateLabel = dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const isToday = currentDate === new Date().toISOString().split('T')[0];

    // Build week dates (Monâ€“Sun) anchored to the current week
    const getWeekDates = () => {
        const base = new Date(currentDate + 'T12:00:00');
        const dow = base.getDay(); // 0=Sun
        const mondayOffset = dow === 0 ? -6 : 1 - dow;
        return DAY_KEYS.map((_, i) => {
            const d = new Date(base);
            d.setDate(base.getDate() + mondayOffset + i);
            return d.toISOString().split('T')[0];
        });
    };
    const weekDates = getWeekDates();

    return (
        <div className="flex-1 flex flex-col overflow-hidden overflow-x-hidden" style={{ background: 'var(--background)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3">
                    <Calendar size={20} style={{ color: '#84cc16' }} />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.title')}</h1>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">BETA</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('planner.subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                        <button
                            onClick={() => setViewMode('day')}
                            className="px-3 py-1.5 text-xs font-medium transition-all"
                            style={{
                                background: viewMode === 'day' ? '#84cc16' : 'var(--surface)',
                                color: viewMode === 'day' ? '#0b0f19' : 'var(--text-secondary)',
                            }}>
                            {t('planner.dayView.dayTab')}
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className="px-3 py-1.5 text-xs font-medium transition-all"
                            style={{
                                background: viewMode === 'week' ? '#84cc16' : 'var(--surface)',
                                color: viewMode === 'week' ? '#0b0f19' : 'var(--text-secondary)',
                            }}>
                            {t('planner.dayView.weekTab')}
                        </button>
                    </div>
                    <button onClick={() => setShowPrefsPanel(!showPrefsPanel)} className="p-2 rounded-lg hover:bg-[var(--surface-light)] transition-colors" title={t('planner.preferences.title')}>
                        <Settings size={16} style={{ color: 'var(--text-muted)' }} />
                    </button>
                    <button onClick={() => setShowWizard(true)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                        style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {t('planner.dayView.rerunSetup')}
                    </button>
                </div>
            </div>

            {/* Date navigation */}
            <div className="flex items-center justify-center gap-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => navigateDay(-1)} className="p-1.5 rounded-lg hover:bg-[var(--surface-light)] transition-colors">
                    <ChevronLeft size={18} style={{ color: 'var(--text-secondary)' }} />
                </button>
                <div className="text-center">
                    <p className="text-sm font-bold" style={{ color: isToday ? '#84cc16' : 'var(--text-primary)' }}>
                        {isToday && 'ðŸ“… '}{dateLabel}
                    </p>
                </div>
                <button onClick={() => navigateDay(1)} className="p-1.5 rounded-lg hover:bg-[var(--surface-light)] transition-colors">
                    <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
                </button>
                {!isToday && (
                    <button onClick={goToToday} className="text-xs px-3 py-1 rounded-lg font-medium"
                        style={{ background: 'rgba(132,204,22,0.1)', color: '#84cc16', border: '1px solid rgba(132,204,22,0.2)' }}>
                        {t('planner.dayView.today')}
                    </button>
                )}
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {viewMode === 'day' ? (
                    generating ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 size={28} className="animate-spin" style={{ color: '#84cc16' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('planner.dayView.regenerate')}...</p>
                        </div>
                    ) : generateError ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <p className="text-sm text-red-400">{generateError}</p>
                            <button onClick={() => handleGeneratePlan()}
                                className="px-4 py-2 rounded-xl text-sm font-bold"
                                style={{ background: 'linear-gradient(135deg, #84cc16, #22c55e)', color: '#0b0f19' }}>
                                {t('planner.wizard.generateToday')}
                            </button>
                        </div>
                    ) : dayPlan && dayPlan.blocks.length > 0 ? (
                        <div className="max-w-lg mx-auto space-y-2">
                            {dayPlan.blocks.map((block) => (
                                <TimeBlockCard
                                    key={block.id}
                                    block={block}
                                    editable={block.source === 'planner'}
                                    onEdit={(id, newTitle) => {
                                        setDayPlan(prev => {
                                            if (!prev) return prev;
                                            return {
                                                ...prev,
                                                blocks: prev.blocks.map(b => b.id === id ? { ...b, title: newTitle } : b)
                                            };
                                        });
                                        setToast({ message: t('planner.blockUpdated'), type: 'success' });
                                    }}
                                    onDelete={(id) => {
                                        setDayPlan(prev => {
                                            if (!prev) return prev;
                                            return {
                                                ...prev,
                                                blocks: prev.blocks.filter(b => b.id !== id)
                                            };
                                        });
                                        setToast({ message: t('planner.blockDeleted'), type: 'success' });
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                {dayPlan ? t('planner.dayView.noBlocks') : t('planner.dayView.notSetUp')}
                            </p>
                            <button onClick={() => handleGeneratePlan()} disabled={generating}
                                className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
                                style={{ background: 'linear-gradient(135deg, #84cc16, #22c55e)', color: '#0b0f19' }}>
                                {t('planner.wizard.generateToday')}
                            </button>
                        </div>
                    )
                ) : (
                    /* Week view */
                    <div className="space-y-3 max-w-2xl mx-auto">
                        {weekDates.map((date, i) => {
                            const isThisToday = date === new Date().toISOString().split('T')[0];
                            const isCurrent = date === currentDate;
                            return (
                                <div key={date}
                                    className="p-3 rounded-xl border transition-all cursor-pointer hover:border-lime-500/30"
                                    style={{
                                        borderColor: isCurrent ? '#84cc16' : 'var(--border)',
                                        background: isCurrent ? 'rgba(132,204,22,0.05)' : 'var(--surface)',
                                    }}
                                    onClick={() => { setCurrentDate(date); setViewMode('day'); }}>
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"
                                        style={{ color: isThisToday ? '#84cc16' : 'var(--text-primary)' }}>
                                        {isThisToday && 'ðŸ“… '}
                                        {t(`planner.dayView.${DAY_KEYS[i]}`)}
                                        <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                                            {new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </h4>
                                    <WeekDayPreview plan={weekPlans[date]} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Preferences Panel */}
            {showPrefsPanel && preferences && (
                <PreferencesPanel
                    preferences={preferences}
                    onClose={() => setShowPrefsPanel(false)}
                    onSave={(newPrefs) => {
                        setPreferences(newPrefs);
                        setShowPrefsPanel(false);
                        setToast({ message: t('planner.preferences.saved'), type: 'success' });
                    }}
                />
            )}

            {/* Bottom actions */}
            {viewMode === 'day' && dayPlan && dayPlan.blocks.length > 0 && (
                <div className="flex items-center justify-center gap-3 px-6 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                    <button onClick={() => handleGeneratePlan()} disabled={generating}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
                        style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        <RefreshCw size={14} /> {t('planner.dayView.regenerate')}
                    </button>
                    <button onClick={handlePushToCalendar}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                        style={{ background: 'linear-gradient(135deg, #84cc16, #22c55e)', color: '#0b0f19' }}>
                        <ArrowUpRight size={14} /> {t('planner.dayView.pushToCalendar')}
                    </button>
                </div>
            )}

            {/* Toast notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onDismiss={() => setToast(null)}
                />
            )}
        </div>
    );
}

// â”€â”€â”€ Week Day Preview (mini block list) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function WeekDayPreview({ plan }: { plan: DayPlan | null }) {
    const { t } = useTranslation();

    if (!plan || plan.blocks.length === 0) {
        return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('planner.dayView.noBlocks')}</p>;
    }
    return (
        <div className="flex flex-wrap gap-1">
            {plan.blocks.slice(0, 5).map(b => (
                <span key={b.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${b.color}20`, color: b.color }}>
                    {b.start} {b.title}
                </span>
            ))}
            {plan.blocks.length > 5 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--surface-light)', color: 'var(--text-muted)' }}>
                    +{plan.blocks.length - 5}
                </span>
            )}
        </div>
    );
}

// â”€â”€â”€ Time Block Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TimeBlockCard({ block, editable = false, onEdit, onDelete }: { block: TimeBlock; editable?: boolean; onEdit?: (id: string, newTitle: string) => void; onDelete?: (id: string) => void }) {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(block.title);

    const typeEmoji = {
        focus: 'ðŸ§ ',
        meeting: 'ðŸ“ž',
        task: 'ðŸ“‹',
        break: 'â˜•',
        fixed: 'ðŸ“Œ',
        free: 'ðŸ’­',
    };

    const handleSave = () => {
        if (onEdit && editTitle.trim()) {
            onEdit(block.id, editTitle);
            setIsEditing(false);
        }
    };

    if (isEditing && editable && block.source === 'planner') {
        return (
            <div className="flex items-stretch gap-3 rounded-xl p-3"
                style={{ background: 'var(--surface)', border: `1px solid ${block.color}40` }}>
                {/* Color stripe */}
                <div className="w-1 rounded-l-lg flex-shrink-0" style={{ background: block.color }} />
                <div className="flex-1 space-y-2">
                    <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full px-2 py-1 rounded text-sm outline-none"
                        style={{ background: 'var(--background)', color: 'var(--text-primary)', border: `1px solid ${block.color}` }}
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            className="flex-1 px-2 py-1 text-xs font-bold rounded transition-all"
                            style={{ background: '#84cc16', color: '#0b0f19' }}>
                            {t('planner.preferences.save')}
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="flex-1 px-2 py-1 text-xs font-medium rounded transition-all"
                            style={{ background: 'var(--surface-light)', color: 'var(--text-secondary)' }}>
                            {t('planner.toast.dismiss')}
                        </button>
                        {onDelete && (
                            <button
                                onClick={() => { onDelete(block.id); setIsEditing(false); }}
                                className="px-2 py-1 text-xs font-bold rounded transition-all"
                                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                                {t('planner.editBlock.delete')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex items-stretch gap-3 group rounded-xl transition-all hover:scale-[1.01] cursor-pointer"
            onClick={() => editable && block.source === 'planner' && setIsEditing(true)}
            style={{ background: 'var(--surface)', border: `1px solid ${block.color}22` }}>
            {/* Color stripe */}
            <div className="w-1 rounded-l-xl flex-shrink-0" style={{ background: block.color }} />
            {/* Content */}
            <div className="flex-1 py-2.5 pr-3">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {typeEmoji[block.type] || 'ðŸ“‹'} {block.title}
                    </p>
                    {!block.editable && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: `${block.color}20`, color: block.color }}>
                            {block.source === 'calendar' ? 'CAL' : 'FIXED'}
                        </span>
                    )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {block.start} â€” {block.end}
                </p>
            </div>
        </div>
    );
}

// â”€â”€â”€ Wizard Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PlannerWizard({ onComplete }: { onComplete: (prefs: PlannerPreferences) => void }) {
    const { t } = useTranslation();
    const [step, setStep] = useState<WizardStep>(0);
    const [dayStart, setDayStart] = useState('08:00');
    const [dayEnd, setDayEnd] = useState('18:00');
    const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [regularTasksText, setRegularTasksText] = useState('');
    const [fixedText, setFixedText] = useState('');
    const [focusHours, setFocusHours] = useState(3);
    const [breakStyle, setBreakStyle] = useState<PlannerPreferences['breakStyle']>('flexible');
    const [generating, setGenerating] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [previewPlan, setPreviewPlan] = useState<DayPlan | null>(null);

    const totalSteps = 8; // steps 1-8 (step 0 is the welcome screen)

    const toggleWorkDay = (day: number) => {
        setWorkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
    };

    const buildPreferences = (): PlannerPreferences => ({
        dayStart,
        dayEnd,
        workDays,
        regularTasks: regularTasksText.split(/[,\n]/).map(s => s.trim()).filter(Boolean),
        fixedAppointments: fixedText.split(/[\n]/).map(s => s.trim()).filter(Boolean),
        focusHours,
        breakStyle,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    const handleFinish = async () => {
        const prefs = buildPreferences();
        setGenerating(true);
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const plan = await generateDayPlan(tomorrow.toISOString().split('T')[0], prefs);
            setPreviewPlan(plan);
        } catch (e) {
            console.error('Preview plan generation failed:', e);
        } finally {
            setGenerating(false);
        }
        setStep(8);
    };

    const handleComplete = () => {
        setFinishing(true);
        onComplete(buildPreferences());
    };

    const nextStep = () => {
        if (step === 7) {
            handleFinish();
        } else {
            setStep((step + 1) as WizardStep);
        }
    };

    const prevStep = () => {
        if (step > 1) setStep((step - 1) as WizardStep);
    };

    // â”€â”€ Step 0: Welcome screen â”€â”€
    if (step === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 min-h-screen" style={{ background: 'var(--background)' }}>
                <div className="w-full max-w-md text-center space-y-6 animate-fadeIn">
                    <div className="text-6xl animate-bounce">ðŸ“…</div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.welcome.title')}</h1>
                    <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
                        {t('planner.welcome.description')}
                    </p>
                    <div className="flex flex-col gap-3 max-w-xs mx-auto">
                        <button
                            onClick={() => setStep(1)}
                            className="px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                            style={{ background: '#84cc16', color: '#0b0f19' }}>
                            {t('planner.welcome.startWizard')}
                        </button>
                        <button
                            onClick={handleComplete}
                            className="px-6 py-3 rounded-xl text-sm border transition-all hover:border-lime-500/50"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                            {t('planner.welcome.skipToCalendar')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // â”€â”€ Steps 1â€“8: Wizard â”€â”€
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-screen" style={{ background: 'var(--background)' }}>
            <div className="w-full max-w-md animate-fadeIn">
                {/* Progress dots */}
                <div className="flex justify-center gap-1.5 mb-8">
                    {Array.from({ length: totalSteps }, (_, i) => (
                        <div key={i} className="w-2 h-2 rounded-full transition-all duration-300"
                            style={{ background: i + 1 <= step ? '#84cc16' : 'var(--border)', transform: i + 1 === step ? 'scale(1.3)' : 'scale(1)' }} />
                    ))}
                </div>

                {/* Step content */}
                <div className="text-center mb-6">
                    {step === 1 && (
                        <div className="animate-fadeIn space-y-6">
                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.wizard.dayStart')}</p>
                            <input type="time" value={dayStart} onChange={e => setDayStart(e.target.value)}
                                className="text-3xl font-mono text-center p-4 rounded-xl w-48 mx-auto block outline-none"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: '#84cc16' }} />
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-fadeIn space-y-6">
                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.wizard.dayEnd')}</p>
                            <input type="time" value={dayEnd} onChange={e => setDayEnd(e.target.value)}
                                className="text-3xl font-mono text-center p-4 rounded-xl w-48 mx-auto block outline-none"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: '#84cc16' }} />
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-fadeIn space-y-6">
                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.wizard.workDays')}</p>
                            <div className="flex justify-center gap-2">
                                {DAYS.map((day, i) => {
                                    const dayNum = i + 1;
                                    const active = workDays.includes(dayNum);
                                    return (
                                        <button key={day} onClick={() => toggleWorkDay(dayNum)}
                                            className="w-12 h-12 rounded-xl text-sm font-bold transition-all"
                                            style={{
                                                background: active ? 'rgba(132,204,22,0.2)' : 'var(--surface)',
                                                color: active ? '#84cc16' : 'var(--text-muted)',
                                                border: `2px solid ${active ? '#84cc16' : 'var(--border)'}`,
                                            }}>
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="animate-fadeIn space-y-4">
                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.wizard.regularTasks')}</p>
                            <textarea value={regularTasksText} onChange={e => setRegularTasksText(e.target.value)}
                                placeholder={t('planner.wizard.regularTasksPlaceholder')}
                                rows={4}
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                        </div>
                    )}

                    {step === 5 && (
                        <div className="animate-fadeIn space-y-4">
                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.wizard.fixedAppointments')}</p>
                            <textarea value={fixedText} onChange={e => setFixedText(e.target.value)}
                                placeholder={t('planner.wizard.fixedAppointmentsPlaceholder')}
                                rows={4}
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                        </div>
                    )}

                    {step === 6 && (
                        <div className="animate-fadeIn space-y-6">
                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.wizard.focusHours')}</p>
                            <div className="flex items-center justify-center gap-4">
                                <input type="range" min="0" max="8" step="0.5" value={focusHours}
                                    onChange={e => setFocusHours(parseFloat(e.target.value))}
                                    className="w-48 accent-lime-500" />
                                <span className="text-3xl font-mono font-bold" style={{ color: '#84cc16' }}>{focusHours}h</span>
                            </div>
                        </div>
                    )}

                    {step === 7 && (
                        <div className="animate-fadeIn space-y-4">
                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.wizard.breakStyle')}</p>
                            <div className="grid grid-cols-2 gap-3">
                                {([
                                    { id: 'pomodoro', emoji: 'ðŸ§ ', label: t('planner.wizard.breakPomodoro') },
                                    { id: '90min', emoji: 'â°', label: t('planner.wizard.break90min') },
                                    { id: 'flexible', emoji: 'ðŸ”„', label: t('planner.wizard.breakFlexible') },
                                    { id: 'none', emoji: 'âŒ', label: t('planner.wizard.breakNone') },
                                ] as const).map(opt => (
                                    <button key={opt.id} onClick={() => setBreakStyle(opt.id)}
                                        className="p-4 rounded-xl text-sm font-bold transition-all text-center"
                                        style={{
                                            background: breakStyle === opt.id ? 'rgba(132,204,22,0.15)' : 'var(--surface)',
                                            color: breakStyle === opt.id ? '#84cc16' : 'var(--text-secondary)',
                                            border: `2px solid ${breakStyle === opt.id ? '#84cc16' : 'var(--border)'}`,
                                        }}>
                                        <span className="text-2xl block mb-1">{opt.emoji}</span>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 8 && (
                        <div className="animate-fadeIn space-y-4">
                            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.wizard.allSet')}</p>
                            {generating ? (
                                <div className="py-8">
                                    <Loader2 size={28} className="animate-spin mx-auto" style={{ color: '#84cc16' }} />
                                </div>
                            ) : previewPlan && previewPlan.blocks.length > 0 ? (
                                <div className="space-y-2 text-left max-h-64 overflow-y-auto">
                                    {previewPlan.blocks.map(block => (
                                        <TimeBlockCard key={block.id} block={block} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>{t('planner.wizard.previewPlaceholder')}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                    <button onClick={prevStep} disabled={step === 1}
                        className="flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-xl transition-all disabled:opacity-30"
                        style={{ color: 'var(--text-secondary)' }}>
                        <ChevronLeft size={16} /> {t('planner.wizard.back')}
                    </button>

                    {step < 8 ? (
                        <button onClick={nextStep} disabled={generating}
                            className="flex items-center gap-1.5 text-sm font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-wait"
                            style={{ background: 'linear-gradient(135deg, #84cc16, #22c55e)', color: '#0b0f19' }}>
                            {generating ? (
                                <><Loader2 size={16} className="animate-spin" /> {t('planner.wizard.generating')}</>
                            ) : (
                                <>{step === 7 ? t('planner.wizard.generateToday') : t('planner.wizard.next')} <ChevronRight size={16} /></>
                            )}
                        </button>
                    ) : (
                        <button onClick={handleComplete} disabled={finishing}
                            className="flex items-center gap-1.5 text-sm font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-wait"
                            style={{ background: 'linear-gradient(135deg, #84cc16, #22c55e)', color: '#0b0f19' }}>
                            {finishing ? (
                                <><Loader2 size={16} className="animate-spin" /> {t('planner.wizard.generating')}</>
                            ) : (
                                <>{t('planner.wizard.finish')} â†’</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// â”€â”€â”€ Preferences Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PreferencesPanel({ preferences, onClose, onSave }: { preferences: PlannerPreferences; onClose: () => void; onSave: (prefs: PlannerPreferences) => void }) {
    const { t } = useTranslation();
    const [dayStart, setDayStart] = useState(preferences.dayStart);
    const [dayEnd, setDayEnd] = useState(preferences.dayEnd);
    const [workDays, setWorkDays] = useState<number[]>(preferences.workDays);
    const [focusHours, setFocusHours] = useState(preferences.focusHours);
    const [breakStyle, setBreakStyle] = useState<PlannerPreferences['breakStyle']>(preferences.breakStyle);

    const toggleWorkDay = (day: number) => {
        setWorkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
    };

    const handleSave = async () => {
        const updated: PlannerPreferences = {
            ...preferences,
            dayStart,
            dayEnd,
            workDays,
            focusHours,
            breakStyle,
            updatedAt: new Date().toISOString(),
        };
        await savePlannerPreferences(updated);
        onSave(updated);
    };

    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--surface)] rounded-xl max-w-sm w-full p-6 space-y-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{t('planner.preferences.title')}</h2>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{t('planner.preferences.dayStart')}</label>
                        <input type="time" value={dayStart} onChange={e => setDayStart(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                    </div>

                    <div>
                        <label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{t('planner.preferences.dayEnd')}</label>
                        <input type="time" value={dayEnd} onChange={e => setDayEnd(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                    </div>

                    <div>
                        <label className="text-xs font-bold mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('planner.preferences.workDays')}</label>
                        <div className="flex gap-1">
                            {DAYS.map((day, i) => {
                                const dayNum = i + 1;
                                const active = workDays.includes(dayNum);
                                return (
                                    <button key={day} onClick={() => toggleWorkDay(dayNum)}
                                        className="flex-1 h-8 rounded text-xs font-bold transition-all"
                                        style={{
                                            background: active ? 'rgba(132,204,22,0.2)' : 'var(--background)',
                                            color: active ? '#84cc16' : 'var(--text-muted)',
                                            border: `1px solid ${active ? '#84cc16' : 'var(--border)'}`,
                                        }}>
                                        {day.slice(0, 1)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('planner.preferences.focusHours')} ({focusHours}h)</label>
                        <input type="range" min="0" max="8" step="0.5" value={focusHours}
                            onChange={e => setFocusHours(parseFloat(e.target.value))}
                            className="w-full accent-lime-500" />
                    </div>

                    <div>
                        <label className="text-xs font-bold mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('planner.preferences.breakStyle')}</label>
                        <select value={breakStyle} onChange={e => setBreakStyle(e.target.value as PlannerPreferences['breakStyle'])}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                            <option value="pomodoro">Pomodoro (25/5)</option>
                            <option value="90min">90 min blocks</option>
                            <option value="flexible">Flexible</option>
                            <option value="none">No breaks</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    <button onClick={handleSave}
                        className="flex-1 px-4 py-2 rounded-lg font-bold text-sm transition-all"
                        style={{ background: '#84cc16', color: '#0b0f19' }}>
                        {t('planner.preferences.save')}
                    </button>
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{ background: 'var(--surface-light)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {t('planner.toast.dismiss')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// â”€â”€â”€ Toast Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Toast({ message, type, onDismiss }: { message: string; type: 'success' | 'error'; onDismiss: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 4000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-md flex items-center gap-3 px-5 py-3 rounded-xl z-50 shadow-lg"
            style={{
                background: type === 'success' ? 'rgba(132,204,22,0.15)' : 'rgba(239,68,68,0.15)',
                border: `1px solid ${type === 'success' ? 'rgba(132,204,22,0.4)' : 'rgba(239,68,68,0.4)'}`,
                color: type === 'success' ? '#84cc16' : '#ef4444',
                backdropFilter: 'blur(12px)',
            }}>
            <span className="text-sm font-medium flex-1">{message}</span>
            <button onClick={onDismiss}
                className="text-sm font-bold opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: type === 'success' ? '#84cc16' : '#ef4444' }}>
                Ã—
            </button>
        </div>
    );
}
