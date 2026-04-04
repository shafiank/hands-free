'use client';

import { Clock, Plus, Play, Pause, Calendar, Trash2, Sunrise, Moon, Coffee, BarChart3, Lock } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { listCronJobs, createCronJob, deleteCronJob, toggleCronJob, type CronJob } from '@/actions/tasks';

const Icon = ({ icon: I, ...props }: { icon: any;[key: string]: any }) => {
    const Component = I;
    return <Component {...props} />;
};

// Preset schedule templates for quick creation
const PRESETS = [
    { name: 'Morning Briefing', schedule: '0 7 * * *', task: 'Give me a morning briefing: weather summary, my pending tasks, and a motivational quote.', agent: 'default' },
    { name: 'Mail Digest', schedule: '0 9,14 * * *', task: 'Summarize my recent notifications, pending items, and action items.', agent: 'default' },
    { name: 'Evening Summary', schedule: '0 19 * * *', task: 'Give me an evening summary: what was accomplished today, open items, and suggestions for tomorrow.', agent: 'default' },
    { name: 'Weekly Review', schedule: '0 18 * * 0', task: 'Generate a weekly review: highlights, tasks completed, tasks pending, and priorities for next week.', agent: 'default' },
];

// Simplified cron presets
const CRON_PRESETS = [
    { label: 'â° Daily', value: 'daily', cron: '0 9 * * *', desc: 'Every day at 9:00 AM' },
    { label: 'ðŸ“… Weekly', value: 'weekly', cron: '0 9 * * 1', desc: 'Every Monday at 9:00 AM' },
    { label: 'ðŸ“† Monthly', value: 'monthly', cron: '0 9 1 * *', desc: '1st of every month at 9 AM' },
    { label: 'ðŸŒ… Weekdays', value: 'weekdays', cron: '0 9 * * 1-5', desc: 'Mon-Fri at 9:00 AM' },
    { label: 'ðŸŒ™ Evening', value: 'evening', cron: '0 20 * * *', desc: 'Every day at 8:00 PM' },
    { label: 'âœï¸ Manual', value: 'manual', cron: '', desc: 'Enter custom cron expression' },
];

function cronToReadable(cron: string): string {
    const match = CRON_PRESETS.find(p => p.cron === cron);
    return match ? match.desc : cron;
}

export default function SchedulePage() {
    const { t } = useTranslation();
    const [jobs, setJobs] = useState<CronJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [scheduleType, setScheduleType] = useState('daily');
    const [scheduleTime, setScheduleTime] = useState('09:00');
    const [newJob, setNewJob] = useState({ name: '', schedule: '0 9 * * *', task: '', enabled: true });

    const loadJobs = useCallback(async () => {
        try {
            const data = await listCronJobs();
            setJobs(data);
        } catch (e) {
            console.error('Failed to load cron jobs:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadJobs(); }, [loadJobs]);

    const handleToggle = async (id: string, enabled: boolean) => {
        await toggleCronJob(id, !enabled);
        await loadJobs();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this scheduled job?')) {
            await deleteCronJob(id);
            await loadJobs();
        }
    };

    // Build cron expression from UI selections
    const buildCron = (type: string, time: string): string => {
        const [h, m] = time.split(':').map(Number);
        const minutePart = m || 0;
        const hourPart = h || 9;
        switch (type) {
            case 'daily': return `${minutePart} ${hourPart} * * *`;
            case 'weekly': return `${minutePart} ${hourPart} * * 1`;
            case 'monthly': return `${minutePart} ${hourPart} 1 * *`;
            case 'weekdays': return `${minutePart} ${hourPart} * * 1-5`;
            case 'evening': return `${minutePart} ${hourPart} * * *`;
            default: return newJob.schedule;
        }
    };

    const handleScheduleTypeChange = (type: string) => {
        setScheduleType(type);
        if (type !== 'manual') {
            const cron = buildCron(type, scheduleTime);
            setNewJob(p => ({ ...p, schedule: cron }));
        }
    };

    const handleTimeChange = (time: string) => {
        setScheduleTime(time);
        if (scheduleType !== 'manual') {
            const cron = buildCron(scheduleType, time);
            setNewJob(p => ({ ...p, schedule: cron }));
        }
    };

    const handleCreate = async () => {
        if (!newJob.name || !newJob.schedule || !newJob.task) return;
        await createCronJob({ name: newJob.name, schedule: newJob.schedule, task: newJob.task, enabled: true });
        setNewJob({ name: '', schedule: '0 9 * * *', task: '', enabled: true });
        setScheduleType('daily');
        setScheduleTime('09:00');
        setShowCreate(false);
        await loadJobs();
    };

    const handlePreset = async (preset: typeof PRESETS[0]) => {
        await createCronJob({ name: preset.name, schedule: preset.schedule, task: preset.task, enabled: true });
        await loadJobs();
    };

    const getJobIcon = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('morning')) return Sunrise;
        if (lower.includes('evening') || lower.includes('night')) return Moon;
        if (lower.includes('mail') || lower.includes('digest')) return Coffee;
        if (lower.includes('week')) return BarChart3;
        return Clock;
    };

    // Jobs managed by other parts of Hands Free (e.g. Memory page)
    // These can only be toggled (enabled/disabled), not deleted here.
    const isSystemJob = (job: CronJob) => {
        const systemNames = ['identity maintenance'];
        return systemNames.includes(job.name.toLowerCase());
    };

    return (
        <div className="min-h-screen p-6 lg:p-8">
            <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8 animate-fadeIn">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                        <Icon icon={Clock} size={24} className="text-blue-500" />
                        {t('schedule.title')}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('schedule.subtitle')} ({jobs.length})
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="px-4 py-2.5 bg-lime-500 hover:bg-lime-400 text-black font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-lime-500/20"
                >
                    <Icon icon={Plus} size={16} />
                    {t('schedule.newSchedule')}
                </button>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="max-w-4xl mb-6 rounded-2xl border p-6 animate-fadeIn" style={{ background: 'var(--surface)', borderColor: 'rgba(132,204,22,0.4)' }}>
                    <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{t('schedule.form.title')}</h3>

                    {/* Schedule Type Selector */}
                    <div className="mb-4">
                        <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-muted)' }}>{t('schedule.form.frequency')}</label>
                        <div className="flex flex-wrap gap-2">
                            {CRON_PRESETS.map(preset => (
                                <button
                                    key={preset.value}
                                    onClick={() => handleScheduleTypeChange(preset.value)}
                                    className="px-3 py-2 rounded-xl text-sm font-medium transition-all"
                                    style={{
                                        background: scheduleType === preset.value ? '#84cc16' : 'var(--background)',
                                        color: scheduleType === preset.value ? 'black' : 'var(--text-secondary)',
                                        border: `1px solid ${scheduleType === preset.value ? '#84cc16' : 'var(--border)'}`,
                                    }}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                        {scheduleType !== 'manual' && (
                            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                                {CRON_PRESETS.find(p => p.value === scheduleType)?.desc}
                            </p>
                        )}
                    </div>

                    {/* Time picker (only for non-manual) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('schedule.form.name')}</label>
                            <input value={newJob.name} onChange={e => setNewJob(p => ({ ...p, name: e.target.value }))}
                                placeholder="Morning Briefing"
                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                        </div>
                        {scheduleType !== 'manual' ? (
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('schedule.form.time')}</label>
                                <input
                                    type="time"
                                    value={scheduleTime}
                                    onChange={e => handleTimeChange(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                            </div>
                        ) : (
                            <div>
                                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('schedule.form.cronExpression')}</label>
                                <input value={newJob.schedule} onChange={e => setNewJob(p => ({ ...p, schedule: e.target.value }))}
                                    placeholder="0 7 * * *"
                                    className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                    Format: min hour day month weekday - e.g. "0 9 * * 1-5" = weekdays 9 AM
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    {newJob.schedule && (
                        <div className="mb-4 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
                            style={{ background: 'var(--background)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                            <Icon icon={Calendar} size={12} />
                            <span>{t('schedule.form.runs')} <strong style={{ color: 'var(--text-secondary)' }}>{cronToReadable(newJob.schedule)}</strong></span>
                            <code className="ml-auto font-mono text-[10px]">{newJob.schedule}</code>
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>{t('schedule.form.taskDesc')}</label>
                        <textarea value={newJob.task} onChange={e => setNewJob(p => ({ ...p, task: e.target.value }))}
                            placeholder="What should Hands Free do when this job runs?"
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreate}
                            disabled={!newJob.name || !newJob.schedule || !newJob.task}
                            className="px-4 py-2 bg-lime-500 hover:bg-lime-400 text-black font-bold rounded-xl text-sm disabled:opacity-30">
                            {t('schedule.form.create')}
                        </button>
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm"
                            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                            {t('schedule.form.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* Quick Presets (show when no jobs) */}
            {jobs.length === 0 && !loading && (
                <div className="max-w-4xl mb-6">
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('schedule.templates')}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {PRESETS.map(preset => (
                            <button key={preset.name}
                                onClick={() => handlePreset(preset)}
                                className="p-4 rounded-xl border text-left transition-all hover:border-lime-500/30 hover:bg-lime-500/5"
                                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{preset.name}</p>
                                <code className="text-[10px] font-mono mt-1 block" style={{ color: 'var(--text-muted)' }}>{preset.schedule}</code>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Job List */}
            <div className="max-w-4xl space-y-3 stagger-children">
                {loading ? (
                    <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>{t('schedule.loading')}</p>
                ) : jobs.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed text-center" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {t('schedule.empty')}
                        </p>
                    </div>
                ) : jobs.map(job => {
                    const JobIcon = getJobIcon(job.name);
                    return (
                        <div key={job.id}
                            className="flex items-center gap-4 p-5 rounded-xl border transition-all"
                            style={{
                                background: 'var(--surface)',
                                borderColor: job.enabled ? 'rgba(132,204,22,0.3)' : 'var(--border)',
                            }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: job.enabled ? 'var(--accent-glow)' : 'var(--surface-light)' }}>
                                <Icon icon={JobIcon} size={16} className={job.enabled ? 'text-lime-500' : ''} style={!job.enabled ? { color: 'var(--text-muted)' } : {}} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{job.name}</p>
                                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{job.task}</p>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] px-2 py-0.5 rounded-md"
                                        style={{ background: 'var(--surface-light)', color: 'var(--text-muted)' }}>
                                        {cronToReadable(job.schedule)}
                                    </span>
                                    <code className="text-[10px] font-mono" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                                        ({job.schedule})
                                    </code>
                                    {job.lastRun && (
                                        <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                            <Icon icon={Calendar} size={10} /> Last: {new Date(job.lastRun).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => handleToggle(job.id, job.enabled)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${job.enabled ? 'bg-lime-500 text-black' : ''}`}
                                style={!job.enabled ? { color: 'var(--text-muted)', border: '1px solid var(--border)' } : undefined}
                            >
                                {job.enabled ? <><Icon icon={Pause} size={12} /> {t('schedule.active')}</> : <><Icon icon={Play} size={12} /> {t('schedule.activate')}</>}
                            </button>
                            {isSystemJob(job) ? (
                                <div
                                    title={t('schedule.managedByMemory')}
                                    className="p-2 rounded-lg cursor-not-allowed"
                                    style={{ color: 'var(--text-muted)', opacity: 0.4 }}
                                >
                                    <Icon icon={Lock} size={14} />
                                </div>
                            ) : (
                                <button onClick={() => handleDelete(job.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors">
                                    <Icon icon={Trash2} size={14} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 p-6 rounded-2xl border border-dashed text-center max-w-4xl"
                style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                    {t('schedule.cronTip')}
                </p>
            </div>
            </div>{/* max-w-5xl mx-auto */}
        </div>
    );
}
