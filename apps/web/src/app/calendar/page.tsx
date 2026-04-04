'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { listCalendarEvents, loadCalendarConfig } from '@/actions/calendar';
import { CalendarDays, RefreshCw, Clock, MapPin, ExternalLink, AlertCircle, Settings } from 'lucide-react';
import Link from 'next/link';
import type { CalendarEvent } from '@/actions/calendar';

// ─── Helpers ──────────────────────────────────────────────────

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
        });
    } catch { return iso; }
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false,
        });
    } catch { return iso; }
}

function isToday(iso: string): boolean {
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
}

function isTomorrow(iso: string): boolean {
    const d = new Date(iso);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return d.getFullYear() === tomorrow.getFullYear() &&
        d.getMonth() === tomorrow.getMonth() &&
        d.getDate() === tomorrow.getDate();
}

function getDayLabel(iso: string): string {
    if (isToday(iso)) return 'Today';
    if (isTomorrow(iso)) return 'Tomorrow';
    return formatDate(iso);
}

function isAllDay(ev: CalendarEvent): boolean {
    return !ev.start.dateTime;
}

function getStartStr(ev: CalendarEvent): string {
    return ev.start.dateTime || ev.start.date || '';
}

// ─── Event Card ───────────────────────────────────────────────

function EventCard({ ev }: { ev: CalendarEvent }) {
    const { t } = useTranslation();
    const allDay = isAllDay(ev);
    const startStr = getStartStr(ev);
    const today = startStr ? isToday(startStr) : false;

    return (
        <div className={`group flex gap-3 p-3 rounded-xl border transition-all hover:border-lime-500/30 hover:bg-lime-500/5 ${today ? 'border-lime-500/20 bg-lime-500/5' : 'border-border bg-surface-light'}`}>
            {/* Time column */}
            <div className="flex flex-col items-center justify-start min-w-[52px] pt-0.5">
                {allDay ? (
                    <span className="text-xs font-semibold text-lime-400 bg-lime-500/10 rounded-md px-1.5 py-0.5">{t('calendar.allDay')}</span>
                ) : (
                    <>
                        <span className="text-sm font-bold text-foreground">{formatTime(ev.start.dateTime!)}</span>
                        {ev.end.dateTime && (
                            <span className="text-xs text-text-secondary mt-0.5">{formatTime(ev.end.dateTime)}</span>
                        )}
                    </>
                )}
            </div>

            {/* Divider */}
            <div className={`w-px self-stretch rounded-full ${today ? 'bg-lime-500/40' : 'bg-border'}`} />

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{ev.summary}</p>
                    {ev.htmlLink && (
                        <a
                            href={ev.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-text-secondary hover:text-lime-400 transition-colors opacity-0 group-hover:opacity-100"
                            title={t('calendar.openInGoogle')}
                        >
                            <ExternalLink size={14} />
                        </a>
                    )}
                </div>
                {ev.location && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-text-secondary">
                        <MapPin size={11} className="shrink-0" />
                        <span className="truncate">{ev.location}</span>
                    </div>
                )}
                {ev.description && (
                    <p className="mt-1 text-xs text-text-secondary line-clamp-2">{ev.description}</p>
                )}
            </div>
        </div>
    );
}

// ─── Day Group ────────────────────────────────────────────────

function DayGroup({ label, events, isToday }: { label: string; events: CalendarEvent[]; isToday: boolean }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-lime-400' : 'text-text-secondary'}`}>
                    {label}
                </span>
                <span className="text-xs text-text-secondary bg-surface-light rounded-full px-1.5">{events.length}</span>
                <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2">
                {events.map(ev => <EventCard key={ev.id} ev={ev} />)}
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────

export default function CalendarPage() {
    const { t } = useTranslation();
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [configured, setConfigured] = useState(true);
    const [daysAhead, setDaysAhead] = useState(7);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const load = useCallback(async (days: number) => {
        setLoading(true);
        setError(null);
        try {
            const cfg = await loadCalendarConfig();
            if (!cfg) {
                setConfigured(false);
                setLoading(false);
                return;
            }
            setConfigured(true);
            const result = await listCalendarEvents(days);
            if (!result.success) {
                setError(result.error || 'Failed to load events.');
            } else {
                setEvents(result.events || []);
                setLastRefresh(new Date());
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(daysAhead); }, [load, daysAhead]);

    // ── Group events by day ──────────────────────────────────
    const grouped: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
        const startStr = getStartStr(ev);
        if (!startStr) continue;
        const dayKey = startStr.slice(0, 10); // YYYY-MM-DD
        if (!grouped[dayKey]) grouped[dayKey] = [];
        grouped[dayKey].push(ev);
    }
    const sortedDays = Object.keys(grouped).sort();

    // ── Render ───────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full max-h-screen overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-lime-500/10 flex items-center justify-center">
                            <CalendarDays size={20} className="text-lime-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-foreground">{t('calendar.title')}</h1>
                            {lastRefresh && (
                                <p className="text-xs text-text-secondary">
                                    {t('calendar.updated', { time: lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) })}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Days ahead selector */}
                        <select
                            value={daysAhead}
                            onChange={e => setDaysAhead(Number(e.target.value))}
                            className="text-xs bg-surface-light border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:border-lime-500/50"
                        >
                            <option value={1}>{t('calendar.range.today')}</option>
                            <option value={2}>{t('calendar.range.next2Days')}</option>
                            <option value={7}>{t('calendar.range.next7Days')}</option>
                            <option value={14}>{t('calendar.range.next2Weeks')}</option>
                            <option value={30}>{t('calendar.range.next30Days')}</option>
                        </select>

                        <button
                            onClick={() => load(daysAhead)}
                            disabled={loading}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-surface-light border border-border text-text-secondary hover:text-foreground hover:border-lime-500/30 transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                            {t('calendar.refresh')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-6 space-y-6">

                {/* Not configured */}
                {!configured && (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-surface-light flex items-center justify-center">
                            <CalendarDays size={32} className="text-text-secondary" />
                        </div>
                        <div>
                            <p className="text-foreground font-semibold mb-1">{t('calendar.notConfigured')}</p>
                            <p className="text-sm text-text-secondary">{t('calendar.notConfiguredDesc')}</p>
                        </div>
                        <Link
                            href="/settings"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-lime-500 text-black text-sm font-semibold hover:bg-lime-400 transition-colors"
                        >
                            <Settings size={14} />
                            {t('calendar.openSettings')}
                        </Link>
                    </div>
                )}

                {/* Error */}
                {configured && error && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold mb-0.5">{t('calendar.loadFailed')}</p>
                            <p className="text-xs opacity-80">{error}</p>
                        </div>
                    </div>
                )}

                {/* Loading skeleton */}
                {configured && loading && !error && (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="space-y-2">
                                <div className="h-4 w-24 bg-surface-light rounded animate-pulse" />
                                <div className="h-16 bg-surface-light rounded-xl animate-pulse" />
                                <div className="h-16 bg-surface-light rounded-xl animate-pulse opacity-60" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Events grouped by day */}
                {configured && !loading && !error && sortedDays.length > 0 && (
                    <div className="space-y-6">
                        {sortedDays.map(day => (
                            <DayGroup
                                key={day}
                                label={getDayLabel(day + 'T00:00:00')}
                                events={grouped[day]}
                                isToday={isToday(day + 'T00:00:00')}
                            />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {configured && !loading && !error && sortedDays.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-surface-light flex items-center justify-center">
                            <Clock size={28} className="text-text-secondary" />
                        </div>
                        <p className="text-foreground font-semibold">{t('calendar.noEvents')}</p>
                        <p className="text-sm text-text-secondary">{t('calendar.nothingScheduled', { range: daysAhead === 1 ? t('calendar.range.today').toLowerCase() : `${daysAhead} days` })}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
