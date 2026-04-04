'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { listTasks, createTask, deleteTask, executeTask, stopTask, type Task } from '@/actions/tasks';
import { listAgents, type AgentDefinition } from '@/actions/agents';
import {
    CheckSquare, Plus, Play, Trash2, Clock, CheckCircle, XCircle,
    Loader2, AlertCircle, RefreshCw, Zap, StopCircle, Users, ChevronDown, ChevronRight
} from 'lucide-react';

const Icon = ({ icon: I, ...props }: { icon: any; [key: string]: any }) => {
    const Component = I;
    return <Component {...props} />;
};

export default function TasksPage() {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [agents, setAgents] = useState<AgentDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium' as 'low' | 'medium' | 'high',
        agent: ''
    });

    const loadTasks = useCallback(async () => {
        try {
            const [taskList, agentList] = await Promise.all([
                listTasks(100),
                listAgents()
            ]);
            setTasks(taskList);
            setAgents(agentList);
        } catch (e) {
            console.error('Failed to load tasks:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    // Auto-refresh every 3s if any tasks are running
    useEffect(() => {
        const hasRunning = tasks.some(t => t.status === 'running');
        if (!hasRunning) return;
        const interval = setInterval(loadTasks, 3000);
        return () => clearInterval(interval);
    }, [tasks, loadTasks]);

    const handleCreate = async () => {
        if (!newTask.title) return;
        try {
            await createTask({
                title: newTask.title,
                description: newTask.description,
                priority: newTask.priority,
                agent: newTask.agent || undefined
            });
            setShowCreate(false);
            setNewTask({ title: '', description: '', priority: 'medium', agent: '' });
            loadTasks();
        } catch (e) {
            console.error('Failed to create task:', e);
        }
    };

    const handleExecute = async (id: string) => {
        setRunningTasks(prev => new Set([...prev, id]));
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'running' as any } : t));
        try {
            await executeTask(id);
        } catch (e) {
            console.error('Failed to execute task:', e);
        } finally {
            setRunningTasks(prev => { const n = new Set(prev); n.delete(id); return n; });
            setTimeout(loadTasks, 500);
        }
    };

    const handleStop = async (id: string) => {
        try {
            await stopTask(id);
            setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'stopped' as any } : t));
        } catch (e) {
            console.error('Failed to stop task:', e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this task?')) return;
        try {
            await deleteTask(id);
            loadTasks();
        } catch (e) {
            console.error('Failed to delete task:', e);
        }
    };

    const toggleParentExpand = (id: string) => {
        setExpandedParents(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return CheckCircle;
            case 'failed': return XCircle;
            case 'stopped': return StopCircle;
            case 'running': return Loader2;
            default: return Clock;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-500';
            case 'failed': return 'text-red-500';
            case 'stopped': return 'text-gray-400';
            case 'running': return 'text-lime-500';
            default: return 'text-gray-500';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'running': return t('tasks.status.running');
            case 'completed': return t('tasks.status.done');
            case 'failed': return t('tasks.status.failed');
            case 'stopped': return t('tasks.status.stopped');
            default: return t('tasks.status.pending');
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        }
    };

    // â”€â”€ Organise tasks: separate parent-level multi-agent, their children, and regular tasks â”€â”€
    const parentTasks = tasks.filter(t => t.isMultiAgent && !t.parentId);
    const childTaskMap: Record<string, Task[]> = {};
    tasks.filter(t => t.parentId).forEach(t => {
        if (!childTaskMap[t.parentId!]) childTaskMap[t.parentId!] = [];
        childTaskMap[t.parentId!].push(t);
    });
    // Regular (non-multi-agent) tasks
    const regularTasks = tasks.filter(t => !t.isMultiAgent);

    const runningCount = tasks.filter(t => t.status === 'running').length;
    const multiAgentRunning = parentTasks.filter(t => t.status === 'running');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Icon icon={Loader2} className="animate-spin" size={32} style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    // â”€â”€ Render a single task card â”€â”€
    const renderTask = (task: Task, isChild = false) => {
        const isRunning = task.status === 'running' || runningTasks.has(task.id);
        return (
            <div key={task.id}
                className={`rounded-2xl border p-4 transition-all ${isChild ? 'ml-4 mt-2 opacity-90' : ''} ${isRunning ? 'border-lime-500/40' : 'hover:border-lime-500/30'}`}
                style={{ background: 'var(--surface)', borderColor: isRunning ? undefined : 'var(--border)' }}>

                {/* Running progress bar */}
                {isRunning && (
                    <div className="h-1 rounded-full mb-3 overflow-hidden" style={{ background: 'var(--surface-light)' }}>
                        <div className="h-full bg-lime-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                )}

                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Icon
                                icon={getStatusIcon(task.status)}
                                size={16}
                                className={`${getStatusColor(task.status)} ${isRunning ? 'animate-spin' : ''}`}
                            />
                            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{task.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                            </span>
                            {/* Multi-Agent badge */}
                            {task.isMultiAgent && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                                    <Icon icon={Users} size={9} />
                                    {task.parentId
                                        ? `Agent ${task.subtaskIndex ?? ''}/${task.subtaskTotal ?? ''}`
                                        : t('tasks.multiAgent')}
                                </span>
                            )}
                        </div>
                        {task.description && (
                            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
                            <span>{new Date(task.createdAt).toLocaleString()}</span>
                            {task.agent && (
                                <span className="px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-light)' }}>
                                    ðŸ¤– {task.agent}
                                </span>
                            )}
                            <span className={`font-medium capitalize ${getStatusColor(task.status)}`}>
                                {getStatusLabel(task.status)}
                            </span>
                        </div>
                        {task.error && (
                            <div className="mt-2 p-2 rounded-lg flex items-start gap-2 bg-red-500/10 border border-red-500/20">
                                <Icon icon={AlertCircle} size={14} className="text-red-500 mt-0.5" />
                                <span className="text-xs text-red-500">{task.error}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        {/* Run button */}
                        {task.status === 'pending' && (
                            <button
                                onClick={() => handleExecute(task.id)}
                                disabled={isRunning}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-lime-500 hover:text-black disabled:opacity-50"
                                style={{ background: 'var(--surface-light)', color: 'var(--text-primary)' }}
                            >
                                <Icon icon={Play} size={12} className="inline mr-1" />
                                Run
                            </button>
                        )}
                        {/* Stop button */}
                        {isRunning && (
                            <button
                                onClick={() => handleStop(task.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20"
                            >
                                <Icon icon={StopCircle} size={12} className="inline mr-1" />
                                Stop
                            </button>
                        )}
                        {/* Delete button */}
                        <button
                            onClick={() => handleDelete(task.id)}
                            className="px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-red-500 hover:text-white"
                            style={{ background: 'var(--surface-light)', color: 'var(--text-muted)' }}
                        >
                            <Icon icon={Trash2} size={12} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // â”€â”€ Render a multi-agent parent card with expandable children â”€â”€
    const renderMultiAgentParent = (parent: Task) => {
        const children = (childTaskMap[parent.id] || []).sort((a, b) => (a.subtaskIndex ?? 0) - (b.subtaskIndex ?? 0));
        const doneCount = children.filter(c => c.status === 'completed').length;
        const failedCount = children.filter(c => c.status === 'failed').length;
        const runningSubCount = children.filter(c => c.status === 'running').length;
        const isExpanded = expandedParents.has(parent.id);
        const isRunning = parent.status === 'running';

        return (
            <div key={parent.id} className="rounded-2xl border overflow-hidden"
                style={{ background: 'var(--surface)', borderColor: isRunning ? 'rgba(168,85,247,0.4)' : 'var(--border)' }}>

                {/* Running progress bar */}
                {isRunning && (
                    <div className="h-1 overflow-hidden" style={{ background: 'var(--surface-light)' }}>
                        <div
                            className="h-full bg-purple-500 rounded-full transition-all duration-1000"
                            style={{ width: children.length ? `${((doneCount + failedCount) / children.length) * 100}%` : '5%' }}
                        />
                    </div>
                )}

                {/* Parent header */}
                <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Icon icon={getStatusIcon(parent.status)} size={16}
                                    className={`${getStatusColor(parent.status)} ${isRunning ? 'animate-spin' : ''}`} />
                                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{parent.title}</h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                                    <Icon icon={Users} size={9} />
                                    Multi-Agent
                                </span>
                                {children.length > 0 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: 'var(--surface-light)', color: 'var(--text-muted)' }}>
                                        {doneCount}/{children.length} done
                                        {failedCount > 0 ? ` Â· ${failedCount} failed` : ''}
                                        {runningSubCount > 0 ? ` Â· ${runningSubCount} running` : ''}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                <span>{new Date(parent.createdAt).toLocaleString()}</span>
                                <span className={`font-medium ${getStatusColor(parent.status)}`}>{getStatusLabel(parent.status)}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 items-center">
                            {/* Stop parent (stops all children) */}
                            {isRunning && (
                                <button
                                    onClick={() => {
                                        handleStop(parent.id);
                                        children.filter(c => c.status === 'running').forEach(c => handleStop(c.id));
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 border border-red-500/20"
                                >
                                    <Icon icon={StopCircle} size={12} className="inline mr-1" />
                                    {t('tasks.stopAll')}
                                </button>
                            )}
                            {/* Expand/collapse */}
                            {children.length > 0 && (
                                <button
                                    onClick={() => toggleParentExpand(parent.id)}
                                    className="p-2 rounded-lg transition-all hover:bg-[var(--surface-light)]"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <Icon icon={isExpanded ? ChevronDown : ChevronRight} size={14} />
                                </button>
                            )}
                            <button
                                onClick={() => handleDelete(parent.id)}
                                className="px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-red-500 hover:text-white"
                                style={{ background: 'var(--surface-light)', color: 'var(--text-muted)' }}
                            >
                                <Icon icon={Trash2} size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Mini progress dots for sub-tasks */}
                    {children.length > 0 && !isExpanded && (
                        <div className="flex gap-1 mt-3 flex-wrap">
                            {children.map(c => (
                                <div
                                    key={c.id}
                                    title={`${c.subtaskIndex}. ${c.title} - ${c.status}`}
                                    className={`w-3 h-3 rounded-full transition-all ${c.status === 'completed' ? 'bg-green-500' :
                                        c.status === 'failed' ? 'bg-red-500' :
                                            c.status === 'running' ? 'bg-lime-500 animate-pulse' :
                                                c.status === 'stopped' ? 'bg-gray-500' :
                                                    'bg-gray-600'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Expanded children */}
                {isExpanded && children.length > 0 && (
                    <div className="border-t px-4 pb-4 space-y-2" style={{ borderColor: 'var(--border)' }}>
                        {children.map(child => renderTask(child, true))}
                    </div>
                )}
            </div>
        );
    };

    const hasAnyTask = tasks.length > 0;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Icon icon={CheckSquare} size={28} />
                        {t('tasks.title')}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {t('tasks.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadTasks} className="p-2 rounded-lg hover:bg-[var(--surface-light)] transition-colors" title={t('common.refresh')}>
                        <Icon icon={RefreshCw} size={16} style={{ color: 'var(--text-muted)' }} />
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-4 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-bold flex items-center gap-2 shadow-lg shadow-lime-500/20 transition-all"
                    >
                        <Icon icon={Plus} size={18} />
                        New Task
                    </button>
                </div>
            </div>

            {/* Active Task Status Bar */}
            {runningCount > 0 && (
                <div className="rounded-2xl border p-4 flex items-center gap-3 animate-fadeIn"
                    style={{ background: 'rgba(132,204,22,0.06)', borderColor: 'rgba(132,204,22,0.3)' }}>
                    <div className="w-8 h-8 rounded-lg bg-lime-500/10 flex items-center justify-center">
                        <Icon icon={Zap} size={16} className="text-lime-500" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-lime-500">
                            {t('tasks.runningBanner', { count: runningCount })}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {t('tasks.runningDesc')}
                        </p>
                    </div>
                    <div className="flex gap-1">
                        <span className="w-2 h-2 bg-lime-500 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-lime-500/70 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                        <span className="w-2 h-2 bg-lime-500/40 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                </div>
            )}

            {/* Multi-Agent Running Banner */}
            {multiAgentRunning.length > 0 && (
                <div className="rounded-2xl border p-4 animate-fadeIn"
                    style={{ background: 'rgba(168,85,247,0.06)', borderColor: 'rgba(168,85,247,0.3)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Icon icon={Users} size={16} className="text-purple-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-purple-400">
                                {multiAgentRunning.length > 1
                                    ? `${multiAgentRunning.length} Multi-Agent jobs running`
                                    : `Multi-Agent job running - ${multiAgentRunning[0].title}`}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Agents are working in parallel. Expand a job below to see each agent's status. You can return to Chat - messages are queued.
                            </p>
                        </div>
                        <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                                <span key={i} className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                                    style={{ animationDelay: `${i * 0.15}s` }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Task Lists */}
            {!hasAnyTask ? (
                <div className="rounded-2xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <Icon icon={CheckSquare} size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('tasks.noTasks')}</p>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                        ðŸ’¡ Try: "Create 5 landing pages for my SaaS products" and Hands Free will automatically run them in parallel.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* â”€â”€ Multi-Agent Jobs â”€â”€ */}
                    {parentTasks.length > 0 && (
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"
                                style={{ color: 'var(--text-muted)' }}>
                                <Icon icon={Users} size={13} className="text-purple-400" />
                                {t('tasks.sections.multiAgentJobs')}
                            </h2>
                            <div className="space-y-3">
                                {parentTasks.map(parent => renderMultiAgentParent(parent))}
                            </div>
                        </div>
                    )}

                    {/* â”€â”€ Regular Tasks â”€â”€ */}
                    {regularTasks.length > 0 && (
                        <div>
                            {parentTasks.length > 0 && (
                                <h2 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2"
                                    style={{ color: 'var(--text-muted)' }}>
                                    <Icon icon={CheckSquare} size={13} />
                                    {t('tasks.sections.individualTasks')}
                                </h2>
                            )}
                            <div className="grid grid-cols-1 gap-3">
                                {regularTasks.map(task => renderTask(task))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fadeIn"
                    onClick={() => setShowCreate(false)}>
                    <div className="max-w-2xl w-full rounded-2xl border p-6 animate-scaleIn"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                        onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{t('tasks.modal.createTitle')}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tasks.modal.titleLabel')}</label>
                                <input
                                    value={newTask.title}
                                    onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                    placeholder="Task title"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tasks.modal.descLabel')}</label>
                                <textarea
                                    value={newTask.description}
                                    onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                    rows={3}
                                    placeholder="What should this task do?"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tasks.modal.priorityLabel')}</label>
                                    <select
                                        value={newTask.priority}
                                        onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="high">{t('tasks.priorities.high')}</option>
                                        <option value="medium">{t('tasks.priorities.medium')}</option>
                                        <option value="low">{t('tasks.priorities.low')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('tasks.modal.agentLabel')}</label>
                                    <select
                                        value={newTask.agent}
                                        onChange={e => setNewTask({ ...newTask, agent: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="">{t('tasks.defaultAgent')}</option>
                                        {agents.map(a => (
                                            <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCreate(false)}
                                className="flex-1 px-4 py-2 rounded-xl font-medium transition-all hover:bg-[var(--surface-light)]"
                                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!newTask.title}
                                className="flex-1 px-4 py-2 rounded-xl font-bold bg-lime-500 hover:bg-lime-400 text-black transition-all shadow-lg shadow-lime-500/20 disabled:opacity-30"
                            >
                                {t('tasks.createTask')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
