'use client';

/**
 * Hands Free â€” Autopilot Dashboard (Phase 5)
 *
 * Four sections:
 *   A) Identity & Memory      â€” editable user_profile.json
 *   B) Master Control         â€” Pause/Resume + cost control + roadmap + Deep-Dive Interview
 *   C) Execution Board        â€” Kanban task manager with full CRUD + Approve/Reject
 *   D) Live History & Logs    â€” terminal-style autopilot_logs.json viewer
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Star, Play, Pause, Plus, Edit3, Trash2, CheckCircle, XCircle,
    Clock, AlertTriangle, Loader2, RefreshCw, Terminal, Brain,
    Zap, BarChart3, Shield, Activity, ChevronDown, ChevronRight,
    Save, X, Send, Mic, MapPin, FileText, TrendingUp, AlertCircle,
    CheckSquare, ThumbsUp, ThumbsDown, RotateCcw, Sparkles, Settings,
    FolderOpen, ExternalLink, LayoutGrid, List, FolderPlus, ArrowRightLeft,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const Icon = ({ icon: I, ...p }: { icon: any; [k: string]: any }) => <I {...p} />;

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const EPIC_BUTTON_TEXTS = [
    'Start New Venture', 'Let It Burn', 'Build the Empire',
    'Initiate Masterplan', 'Take Over', 'Begin the Sequence',
    'Launch the Vision', 'Execute the Dream', 'Forge the Future',
    'Ignite the Mission',
];

const STATE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    pending:     { label: 'Pending',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: Clock },
    in_progress: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: Activity },
    completed:   { label: 'Completed',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   icon: CheckCircle },
    blocked:     { label: 'Blocked',     color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: AlertTriangle },
    cancelled:   { label: 'Cancelled',   color: '#6b7280', bg: 'rgba(107,114,128,0.1)', icon: XCircle },
    failed:      { label: 'Failed',      color: '#f97316', bg: 'rgba(249,115,22,0.1)',  icon: AlertCircle },
};

const PRIORITY_COLORS: Record<string, string> = {
    high: '#ef4444', normal: '#f59e0b', low: '#94a3b8',
};

const LOG_COLORS: Record<string, string> = {
    info:    '#94a3b8',
    success: '#22c55e',
    warning: '#f59e0b',
    error:   '#ef4444',
};

const LOG_ICONS: Record<string, string> = {
    info: 'â„¹', success: 'âœ“', warning: 'âš ', error: 'âœ—',
};

// â”€â”€â”€ Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function timeAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60)        return `${s}s ago`;
    if (s < 3600)      return `${Math.floor(s / 60)}m ago`;
    if (s < 86400)     return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Extract file/folder paths from a task result string.
 * Looks for common patterns: "saved to ...", "written to ...", backtick-wrapped paths, etc.
 * Returns an array of { path, label } objects for clickable links.
 */
function extractFilePaths(text: string): Array<{ path: string; label: string }> {
    if (!text) return [];
    const paths: Array<{ path: string; label: string }> = [];
    const seen = new Set<string>();

    const addPath = (raw: string) => {
        // Strip trailing punctuation and quotes
        const clean = raw.replace(/[`'".,;:!?)}\]]+$/, '').replace(/^[`'"]+/, '').trim();
        if (clean.length < 5 || seen.has(clean)) return;
        seen.add(clean);
        const segments = clean.replace(/\\/g, '/').split('/');
        const label = segments[segments.length - 1] || clean;
        paths.push({ path: clean, label });
    };

    // Pattern 1: Backtick / single-quote / double-quote wrapped paths (most reliable)
    const quotedPathRegex = /[`'"]([A-Za-z]:[/\\][^`'"]{4,}|\/[^`'"]{5,}|~\/[^`'"]{3,}|workspace\/[^`'"]{3,}|files\/[^`'"]{3,})[`'"]/gi;
    let qm;
    while ((qm = quotedPathRegex.exec(text)) !== null) addPath(qm[1]);

    // Pattern 2: Windows absolute paths (support spaces in path segments)
    const winPathRegex = /([A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*)/gi;
    let wm;
    while ((wm = winPathRegex.exec(text)) !== null) addPath(wm[1]);

    // Pattern 3: Unix absolute / home paths
    const unixPathRegex = /(~\/[\w.\-/]+|\/(?:home|Users|root|tmp|var|etc)\/[\w.\-/ ]+)/gi;
    let um;
    while ((um = unixPathRegex.exec(text)) !== null) addPath(um[1]);

    // Pattern 4: "saved to 'path'" style sentences (German + English)
    const savedRegex = /(?:gespeichert(?:\s+unter)?|saved\s+(?:to|as)|written\s+to|created\s+(?:at|in)|output(?:\s+file)?|datei)[:\s]*[`'"]([^`'"]{4,})[`'"]/gi;
    let sm;
    while ((sm = savedRegex.exec(text)) !== null) addPath(sm[1]);

    // Pattern 5: workspace/ or files/ relative paths (resolve on server side)
    const relPathRegex = /\b((?:workspace|files)\/[\w.\-/]{3,})/gi;
    let rm;
    while ((rm = relPathRegex.exec(text)) !== null) addPath(rm[1]);

    return paths.slice(0, 5); // max 5 links
}

/** Open a file or folder in the OS file explorer */
async function openInExplorer(filePath: string) {
    try {
        await fetch('/api/system/open-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath }),
        });
    } catch { /* non-fatal */ }
}

/** Open the Hands Free workspace/data folder directly */
async function openWorkspaceFolder() {
    try {
        const res = await fetch('/api/system/open-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '__DATA_DIR__' }), // server resolves to ~/.handsfree-data
        });
        if (!res.ok) throw new Error('failed');
    } catch { /* non-fatal */ }
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function AutopilotPage() {
    const { t } = useTranslation();

    // â”€â”€ Global State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [activeSection, setActiveSection] = useState<'memory' | 'control' | 'board' | 'logs'>('control');
    const [runnerStatus,  setRunnerStatus]   = useState<any>(null);
    const [loading,       setLoading]        = useState(false);
    const [standup,       setStandup]        = useState<string | null>(null);
    const [standupLoading, setStandupLoading] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // â”€â”€ Section A: Identity & Memory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [profile, setProfile] = useState<any>({});
    const [profileEditing, setProfileEditing] = useState(false);
    const [profileDraft,   setProfileDraft]   = useState<any>({});
    const [profileSaving,  setProfileSaving]  = useState(false);
    const [showClearIdentityConfirm, setShowClearIdentityConfirm] = useState(false);

    // â”€â”€ Section B: Master Control â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [autopilotEnabled, setAutopilotEnabled] = useState(false);
    const [toggling,         setToggling]         = useState(false);
    const [costConfig,       setCostConfig]        = useState({ maxCallsPerHour: 20, pauseAfterTasks: 0 });
    const [costSaving,       setCostSaving]        = useState(false);
    const [showCostPanel,    setShowCostPanel]     = useState(false);

    // â”€â”€ Section B: Deep-Dive Interview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [showInterview, setShowInterview] = useState(false);
    const [epicText]      = useState(() => EPIC_BUTTON_TEXTS[Math.floor(Math.random() * EPIC_BUTTON_TEXTS.length)]);
    const [interviewHistory, setInterviewHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const [interviewInput,   setInterviewInput]   = useState('');
    const [interviewLoading, setInterviewLoading] = useState(false);
    const [interviewDone,    setInterviewDone]    = useState(false);

    // â”€â”€ Section B: Master Plan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [planLoading,  setPlanLoading]  = useState(false);
    const [planResult,   setPlanResult]   = useState<{ roadmap: string; taskCount: number; planTitle: string } | null>(null);

    // â”€â”€ Section B: Quick Task Input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [quickTaskInput,   setQuickTaskInput]   = useState('');
    const [quickTaskSending, setQuickTaskSending] = useState(false);

    // â”€â”€ Section C: Execution Board â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [tasks,             setTasks]             = useState<any[]>([]);
    const [tasksLoading,      setTasksLoading]      = useState(false);
    const [boardFilter,       setBoardFilter]       = useState<string>('all');
    const [editingTask,       setEditingTask]       = useState<any | null>(null);
    const [addingTask,        setAddingTask]        = useState(false);
    const [addingToColumn,    setAddingToColumn]    = useState<string | null>(null); // which kanban column to add to
    const [newTask,           setNewTask]           = useState({ title: '', description: '', priority: 'normal', planTitle: '' });
    const [taskAction,        setTaskAction]        = useState<string | null>(null);
    const [groupByProject,    setGroupByProject]    = useState(true);
    const [expandedResults,   setExpandedResults]   = useState<Set<string>>(new Set());
    const [expandedDescs,     setExpandedDescs]     = useState<Set<string>>(new Set());
    const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
    const [movingTaskId,      setMovingTaskId]      = useState<string | null>(null);
    const [boardView,         setBoardView]         = useState<'kanban' | 'list'>('kanban');
    const [addingProject,     setAddingProject]     = useState(false);
    const [newProjectName,    setNewProjectName]    = useState('');

    // â”€â”€ Section D: Logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [logs,       setLogs]       = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logFilter,  setLogFilter]  = useState<string>('all');
    const logsEndRef = useRef<HTMLDivElement>(null);

    // â”€â”€ Section E: Live Execution View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [liveTaskId, setLiveTaskId] = useState<string | null>(null);
    const liveEndRef = useRef<HTMLDivElement>(null);

    // â”€â”€â”€ Data Fetchers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Use refs to compare previous values â€” only setState when data actually
    // changed to prevent the 8s blink / unnecessary re-renders.
    const prevStatusRef = useRef<string>('');
    const prevTasksRef  = useRef<string>('');
    const prevLogsRef   = useRef<string>('');

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/autopilot?resource=status', { cache: 'no-store' });
            const d   = await res.json();
            if (d.success !== false) {
                const key = JSON.stringify({ running: d.running, costPaused: d.costPaused, callsThisHour: d.callsThisHour });
                if (key !== prevStatusRef.current) {
                    prevStatusRef.current = key;
                    setRunnerStatus(d);
                    setAutopilotEnabled(d.running ?? false);
                }
            }
        } catch { /* network error - skip silently */ }
    }, []);

    const fetchProfile = useCallback(async () => {
        try {
            const res = await fetch('/api/autopilot?resource=profile', { cache: 'no-store' });
            const d   = await res.json();
            if (d.success !== false) {
                setProfile(d.profile ?? {});
                setProfileDraft(d.profile ?? {});
            }
        } catch { /* skip */ }
    }, []);

    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch('/api/autopilot?resource=tasks', { cache: 'no-store' });
            const d   = await res.json();
            if (d.tasks) {
                const key = JSON.stringify(d.tasks);
                if (key !== prevTasksRef.current) {
                    prevTasksRef.current = key;
                    setTasks(d.tasks);
                }
            }
        } catch { /* skip */ }
        setTasksLoading(false);
    }, []);

    const fetchLogs = useCallback(async () => {
        try {
            const res = await fetch('/api/autopilot?resource=logs&limit=150', { cache: 'no-store' });
            const d   = await res.json();
            if (d.logs) {
                // Compare only last-log timestamp to avoid full stringify on large arrays
                const key = d.logs.length + '_' + (d.logs[d.logs.length - 1]?.timestamp ?? 0);
                if (key !== prevLogsRef.current) {
                    prevLogsRef.current = key;
                    setLogs(d.logs);
                }
            }
        } catch { /* skip */ }
        setLogsLoading(false);
    }, []);

    // Initial load + polling â€” paused when tab is hidden (prevents white-screen on minimize)
    useEffect(() => {
        fetchStatus();
        fetchProfile();
        fetchTasks();
        fetchLogs();

        const startPolling = () => {
            if (pollingRef.current) return; // already running
            pollingRef.current = setInterval(() => {
                if (document.visibilityState === 'hidden') return; // skip when tab/window hidden
                fetchStatus();
                fetchTasks();
                fetchLogs();
            }, 8000);
        };

        const stopPolling = () => {
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                startPolling();
                // Immediate refresh on restore so data is fresh
                fetchStatus(); fetchTasks(); fetchLogs();
            } else {
                stopPolling();
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);
        startPolling();

        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchStatus, fetchProfile, fetchTasks, fetchLogs]);

    // â”€â”€â”€ Section B: Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const toggleAutopilot = async () => {
        setToggling(true);
        await fetch('/api/autopilot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle_runner', enabled: !autopilotEnabled }),
        });
        await fetchStatus();
        setToggling(false);
    };

    const saveProfile = async () => {
        setProfileSaving(true);
        await fetch('/api/autopilot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_profile', profile: profileDraft }),
        });
        setProfile(profileDraft);
        setProfileEditing(false);
        setProfileSaving(false);
    };

    const saveCostConfig = async () => {
        setCostSaving(true);
        await fetch('/api/autopilot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_autopilot_config', ...costConfig }),
        });
        setCostSaving(false);
    };

    const resumeCostPause = async () => {
        await fetch('/api/autopilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resume_cost_pause' }) });
        await fetchStatus();
    };

    // â”€â”€â”€ Deep-Dive Interview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const startInterview = async () => {
        setShowInterview(true);
        setInterviewDone(false);
        setInterviewHistory([]);
        setInterviewLoading(true);
        const res  = await fetch('/api/autopilot/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: [] }) });
        const data = await res.json();
        if (data.success && data.message) {
            setInterviewHistory([{ role: 'assistant', content: data.message }]);
        }
        setInterviewLoading(false);
    };

    const sendInterviewMessage = async () => {
        if (!interviewInput.trim() || interviewLoading) return;
        const msg = interviewInput.trim();
        setInterviewInput('');
        const newHistory = [...interviewHistory, { role: 'user' as const, content: msg }];
        setInterviewHistory(newHistory);
        setInterviewLoading(true);

        const res  = await fetch('/api/autopilot/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: newHistory }) });
        const data = await res.json();

        if (data.success) {
            if (data.turn === 'complete') {
                setInterviewHistory([...newHistory, { role: 'assistant', content: `âœ… Interview complete! I've saved your profile and created your strategic roadmap.\n\n**Your Master Plan:**\n${data.summary}` }]);
                setInterviewDone(true);
                await fetchProfile();
            } else if (data.message) {
                setInterviewHistory([...newHistory, { role: 'assistant', content: data.message }]);
            }
        }
        setInterviewLoading(false);
    };

    // â”€â”€â”€ Master Plan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const generatePlan = async () => {
        setPlanLoading(true);
        setPlanResult(null);
        const res  = await fetch('/api/autopilot/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const data = await res.json();
        if (data.success) {
            setPlanResult({ roadmap: data.roadmap, taskCount: data.tasks?.length ?? 0, planTitle: data.planTitle });
            await fetchTasks();
        }
        setPlanLoading(false);
    };

    const fetchStandup = async () => {
        setStandupLoading(true);
        const res  = await fetch('/api/autopilot/standup', { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.report) setStandup(data.report);
        setStandupLoading(false);
    };

    // â”€â”€â”€ Quick Task â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const submitQuickTask = async () => {
        const text = quickTaskInput.trim();
        if (!text || quickTaskSending) return;
        setQuickTaskSending(true);
        try {
            await fetch('/api/autopilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add_task', title: text, description: '', priority: 'normal' }),
            });
            setQuickTaskInput('');
            await fetchTasks();
        } catch { /* ignore */ } finally {
            setQuickTaskSending(false);
        }
    };

    // â”€â”€â”€ Task CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const post = (action: string, body: any) =>
        fetch('/api/autopilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });

    const addTask = async () => {
        if (!newTask.title.trim()) return;
        setTaskAction('adding');
        await post('add_task', { ...newTask, planTitle: newTask.planTitle || undefined });
        setAddingTask(false);
        setAddingToColumn(null);
        setNewTask({ title: '', description: '', priority: 'normal', planTitle: '' });
        await fetchTasks();
        setTaskAction(null);
    };

    const moveTaskToProject = async (taskId: string, newPlanTitle: string) => {
        setTaskAction(taskId + '_move');
        await post('edit_task', { id: taskId, planTitle: newPlanTitle || undefined });
        setMovingTaskId(null);
        await fetchTasks();
        setTaskAction(null);
    };

    const saveEditTask = async () => {
        if (!editingTask) return;
        setTaskAction('saving');
        await post('edit_task', { id: editingTask.id, title: editingTask.title, description: editingTask.description, priority: editingTask.priority });
        setEditingTask(null);
        await fetchTasks();
        setTaskAction(null);
    };

    const cancelTask = async (id: string) => {
        setTaskAction(id + '_cancel');
        await post('cancel_task', { id });
        await fetchTasks();
        setTaskAction(null);
    };

    const deleteTask = async (id: string) => {
        setTaskAction(id + '_delete');
        await post('delete_task', { id });
        await fetchTasks();
        setTaskAction(null);
    };

    const approveTask = async (id: string) => {
        setTaskAction(id + '_approve');
        await post('approve_task', { id });
        await fetchTasks();
        setTaskAction(null);
    };

    const rejectTask = async (id: string) => {
        setTaskAction(id + '_reject');
        await post('reject_task', { id, reason: 'Rejected by user from Execution Board' });
        await fetchTasks();
        setTaskAction(null);
    };

    const retryTask = async (id: string) => {
        setTaskAction(id + '_retry');
        await post('retry_task', { id });
        await fetchTasks();
        setTaskAction(null);
    };

    const deleteProject = async (planTitle: string) => {
        const deletable = tasks.filter(t =>
            (t.planTitle ?? 'Standalone Tasks') === planTitle &&
            ['completed', 'failed', 'blocked', 'cancelled'].includes(t.state),
        );
        for (const t of deletable) await post('delete_task', { id: t.id });
        await fetchTasks();
    };

    const setPriority = async (id: string, priority: string) => {
        await post('edit_task', { id, priority });
        await fetchTasks();
    };

    // â”€â”€â”€ Logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const clearLogs = async () => {
        await post('clear_logs', {});
        setLogs([]);
    };

    // â”€â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // 'blocked' filter includes cancelled + failed (all "problem" states)
    const filteredTasks = tasks.filter(t => {
        if (boardFilter === 'all') return true;
        if (boardFilter === 'blocked') return ['blocked', 'cancelled', 'failed'].includes(t.state);
        return t.state === boardFilter;
    });

    // Project-grouped view: Map<planTitle | 'Standalone Tasks', AgentTask[]>
    const projectGroups = useMemo(() => {
        const map = new Map<string, any[]>();
        for (const t of filteredTasks) {
            const key = t.planTitle?.trim() || 'Standalone Tasks';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(t);
        }
        // Sort: named projects first (alphabetically), then standalone
        return [...map.entries()].sort(([a], [b]) => {
            if (a === 'Standalone Tasks') return 1;
            if (b === 'Standalone Tasks') return -1;
            return a.localeCompare(b);
        });
    }, [filteredTasks]);
    // All unique project names (for move-to-project dropdown)
    const projectNames = useMemo(() => {
        const names = new Set<string>();
        for (const t of tasks) { if (t.planTitle?.trim()) names.add(t.planTitle.trim()); }
        return [...names].sort();
    }, [tasks]);

    // Stable project color palette for badges
    const PROJECT_COLORS = ['#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#22c55e', '#ef4444', '#06b6d4'];
    const projectColorMap = useMemo(() => {
        const map: Record<string, string> = {};
        const allNames = [...new Set(tasks.map(t => t.planTitle?.trim()).filter(Boolean))].sort();
        allNames.forEach((n, i) => { map[n] = PROJECT_COLORS[i % PROJECT_COLORS.length]; });
        return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks]);

    // Kanban columns: tasks grouped by state
    const kanbanColumns = useMemo(() => {
        const cols: Record<string, any[]> = { pending: [], in_progress: [], completed: [], blocked: [] };
        for (const t of filteredTasks) {
            const key = ['cancelled', 'failed'].includes(t.state) ? 'blocked' : t.state;
            if (cols[key]) cols[key].push(t);
            else cols.pending.push(t);
        }
        return cols;
    }, [filteredTasks]);

    const filteredLogs  = logs.filter(l => logFilter === 'all' || l.level === logFilter);

    const taskStats = {
        pending:     tasks.filter(t => t.state === 'pending').length,
        in_progress: tasks.filter(t => t.state === 'in_progress').length,
        completed:   tasks.filter(t => t.state === 'completed').length,
        blocked:     tasks.filter(t => t.state === 'blocked').length,
        approval:    tasks.filter(t => t.requiresApproval && t.approvalStatus === 'pending').length,
    };

    // â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const card = "rounded-2xl border p-5" as const;
    const cs   = { background: 'var(--surface)', borderColor: 'var(--border)' };
    const inp  = "w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:border-amber-500";
    const inps = { background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' };

    // â”€â”€â”€ Nav Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const TABS = [
        { id: 'control', label: t('autopilot.tabs.controlRoom'), icon: Star },
        { id: 'board',   label: t('autopilot.tabs.executionBoard'), icon: CheckSquare },
        { id: 'live',    label: t('autopilot.tabs.liveExecution') || 'Live Execution', icon: Activity },
        { id: 'memory',  label: t('autopilot.tabs.identityMemory'), icon: Brain },
        { id: 'logs',    label: t('autopilot.tabs.liveHistory'), icon: Terminal },
    ] as const;

    // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--background)' }}>

            {/* â”€â”€ Header â”€â”€ */}
            <div className="shrink-0 px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
                            <Icon icon={Star} size={20} style={{ color: '#f59e0b' }} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('autopilot.title')}</h1>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('autopilot.subtitle')}</p>
                        </div>
                    </div>

                    {/* Global status pill */}
                    <div className="flex items-center gap-3">
                        {runnerStatus?.costControl?.paused && (
                            <button onClick={resumeCostPause} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                                <Icon icon={AlertCircle} size={12} /> {t('autopilot.rateLimited')}
                            </button>
                        )}
                        {taskStats.approval > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold animate-pulse" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                                {t('autopilot.awaitingApproval', { count: taskStats.approval })}
                            </span>
                        )}
                        <button
                            onClick={toggleAutopilot}
                            disabled={toggling}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                            style={{
                                background: autopilotEnabled ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                                color:      autopilotEnabled ? '#ef4444'               : '#f59e0b',
                                border:     `1.5px solid ${autopilotEnabled ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
                            }}
                        >
                            {toggling ? <Icon icon={Loader2} size={14} className="animate-spin" /> : <Icon icon={autopilotEnabled ? Pause : Play} size={14} />}
                            {autopilotEnabled ? t('autopilot.pause') : t('autopilot.resume')}
                        </button>
                    </div>
                </div>

                {/* Tab nav */}
                <div className="flex gap-1 mt-4">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveSection(tab.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{
                                background: activeSection === tab.id ? 'rgba(245,158,11,0.12)' : 'transparent',
                                color:      activeSection === tab.id ? '#f59e0b' : 'var(--text-muted)',
                                border:     `1px solid ${activeSection === tab.id ? 'rgba(245,158,11,0.35)' : 'transparent'}`,
                            }}>
                            <Icon icon={tab.icon} size={12} /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* â”€â”€ Scrollable Content â”€â”€ */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                    SECTION B: CONTROL ROOM
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                {activeSection === 'control' && (
                    <div className="space-y-6">

                        {/* Status Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: t('autopilot.state.pending'),     value: taskStats.pending,     color: '#94a3b8', icon: Clock },
                                { label: t('autopilot.state.inProgress'), value: taskStats.in_progress, color: '#f59e0b', icon: Activity },
                                { label: t('autopilot.state.completed'),   value: taskStats.completed,   color: '#22c55e', icon: CheckCircle },
                                { label: t('autopilot.state.blocked'),     value: taskStats.blocked,     color: '#ef4444', icon: AlertTriangle },
                            ].map(s => (
                                <div key={s.label} className={card} style={{ ...cs, textAlign: 'center' }}>
                                    <Icon icon={s.icon} size={20} style={{ color: s.color, margin: '0 auto 6px' }} />
                                    <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Heartbeat info */}
                        {runnerStatus && (
                            <div className={card} style={cs}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                        <Icon icon={Activity} size={14} style={{ color: '#f59e0b' }} /> {t('autopilot.runner.status')}
                                    </h3>
                                    <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium" style={{ background: runnerStatus.running ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: runnerStatus.running ? '#22c55e' : '#6b7280' }}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${runnerStatus.running ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                                        {runnerStatus.running ? t('autopilot.runner.active') : t('autopilot.runner.paused')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    <div><p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{runnerStatus.intervalMinutes}m</p><p>{t('autopilot.runner.heartbeat')}</p></div>
                                    <div><p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{runnerStatus.costControl?.apiCallsThisHour ?? 0}/{runnerStatus.costControl?.maxCallsPerHour ?? 20}</p><p>{t('autopilot.runner.apiCalls')}</p></div>
                                    <div><p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{runnerStatus.costControl?.tasksThisSession ?? 0}</p><p>{t('autopilot.runner.tasks')}</p></div>
                                </div>
                            </div>
                        )}

                        {/* Cost Control */}
                        <div className={card} style={cs}>
                            <button className="w-full flex items-center justify-between" onClick={() => setShowCostPanel(!showCostPanel)}>
                                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    <Icon icon={Shield} size={14} style={{ color: '#f59e0b' }} /> {t('autopilot.cost.title')}
                                </h3>
                                <Icon icon={showCostPanel ? ChevronDown : ChevronRight} size={14} style={{ color: 'var(--text-muted)' }} />
                            </button>
                            {showCostPanel && (
                                <div className="mt-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>{t('autopilot.cost.maxCalls')}</label>
                                            <input type="number" min={1} max={200} className={inp} style={inps}
                                                value={costConfig.maxCallsPerHour}
                                                onChange={e => setCostConfig(c => ({ ...c, maxCallsPerHour: Number(e.target.value) }))} />
                                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('autopilot.cost.unlimited')}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-primary)' }}>{t('autopilot.cost.pauseAfter')}</label>
                                            <input type="number" min={0} max={100} className={inp} style={inps}
                                                value={costConfig.pauseAfterTasks}
                                                onChange={e => setCostConfig(c => ({ ...c, pauseAfterTasks: Number(e.target.value) }))} />
                                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('autopilot.cost.unlimited')}</p>
                                        </div>
                                    </div>
                                    <button onClick={saveCostConfig} disabled={costSaving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                        {costSaving ? <Icon icon={Loader2} size={12} className="animate-spin" /> : <Icon icon={Save} size={12} />} {t('autopilot.cost.save')}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Deep-Dive Interview */}
                        <div className={card} style={{ ...cs, borderColor: 'rgba(245,158,11,0.25)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {t('autopilot.interview.title')}
                                </h3>
                                {!showInterview && (
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('autopilot.interview.desc')}</p>
                                )}
                            </div>

                            {!showInterview ? (
                                <button onClick={startInterview}
                                    className="w-full py-4 rounded-xl text-base font-black tracking-wide transition-all hover:scale-[1.02] active:scale-[0.99]"
                                    style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(251,191,36,0.15) 100%)', color: '#f59e0b', border: '1.5px solid rgba(245,158,11,0.4)' }}>
                                    âš¡ {epicText}
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    {/* Chat history */}
                                    <div className="rounded-xl p-3 space-y-2 overflow-y-auto max-h-64" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                                        {interviewHistory.map((m, i) => (
                                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className="rounded-xl px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap"
                                                    style={{
                                                        background: m.role === 'user' ? 'rgba(245,158,11,0.15)' : 'var(--surface)',
                                                        color: 'var(--text-primary)',
                                                        border: '1px solid var(--border)',
                                                    }}>
                                                    {m.content}
                                                </div>
                                            </div>
                                        ))}
                                        {interviewLoading && (
                                            <div className="flex justify-start">
                                                <div className="rounded-xl px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                                    <div className="flex gap-1">
                                                        {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {!interviewDone ? (
                                        <div className="flex gap-2">
                                            <input className={`flex-1 ${inp}`} style={inps} placeholder={t('autopilot.answerPlaceholder')}
                                                value={interviewInput}
                                                onChange={e => setInterviewInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendInterviewMessage()} />
                                            <button onClick={sendInterviewMessage} disabled={interviewLoading || !interviewInput.trim()}
                                                className="px-3 py-2 rounded-xl transition-all disabled:opacity-40"
                                                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                                <Icon icon={Send} size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button onClick={generatePlan} disabled={planLoading}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                                                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1.5px solid rgba(245,158,11,0.4)' }}>
                                                {planLoading ? <><Icon icon={Loader2} size={14} className="animate-spin" /> {t('autopilot.generatingPlan')}</> : <><Icon icon={Sparkles} size={14} /> {t('autopilot.generatePlan')}</>}
                                            </button>
                                            <button onClick={() => setShowInterview(false)} className="px-3 py-2 rounded-xl text-xs" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                                <Icon icon={X} size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Quick Task Input - command center, visually prominent */}
                        <div className={card} style={{ ...cs, border: '1.5px solid rgba(99,102,241,0.45)', boxShadow: '0 0 0 1px rgba(99,102,241,0.12), 0 4px 24px rgba(99,102,241,0.08)' }}>
                            <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#818cf8' }}>
                                <Icon icon={Zap} size={14} style={{ color: '#818cf8' }} /> {t('autopilot.quickTask')}
                                <span className="ml-auto text-[9px] font-normal px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>âŽ Enter</span>
                            </h3>
                            <div className="flex gap-2">
                                <input
                                    className={`flex-1 ${inp}`}
                                    style={{ ...inps, border: '1.5px solid rgba(99,102,241,0.3)', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.7)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    placeholder="Give Autopilot a goal - e.g. 'Research AI trends and create a report'â€¦"
                                    value={quickTaskInput}
                                    onChange={e => setQuickTaskInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitQuickTask()}
                                />
                                <button
                                    onClick={submitQuickTask}
                                    disabled={quickTaskSending || !quickTaskInput.trim()}
                                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                                    style={{ background: quickTaskInput.trim() ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)' }}>
                                    {quickTaskSending ? <Icon icon={Loader2} size={14} className="animate-spin" /> : <Icon icon={Send} size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Plan result */}
                        {planResult && (
                            <div className={card} style={{ ...cs, borderColor: 'rgba(34,197,94,0.25)' }}>
                                <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: '#22c55e' }}>
                                    <Icon icon={Sparkles} size={14} /> {planResult.planTitle} - {planResult.taskCount} tasks queued
                                </h3>
                                <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{planResult.roadmap}</p>
                            </div>
                        )}

                        {/* Roadmap from profile */}
                        {profile.masterPlan && !planResult && (
                            <div className={card} style={cs}>
                                <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    <Icon icon={TrendingUp} size={14} style={{ color: '#f59e0b' }} /> {t('autopilot.identity.currentRoadmap')}
                                    {profile.masterPlanTitle && (
                                        <span className="text-[10px] font-normal px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                            {profile.masterPlanTitle}
                                        </span>
                                    )}
                                </h3>
                                <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{profile.masterPlan}</p>
                            </div>
                        )}

                        {/* Previous Roadmap History */}
                        {Array.isArray(profile.roadmapHistory) && profile.roadmapHistory.length > 0 && (
                            <div className={card} style={{ ...cs, borderColor: 'rgba(100,116,139,0.2)' }}>
                                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    <Icon icon={ChevronDown} size={14} style={{ color: 'var(--text-muted)' }} /> {t('autopilot.identity.previousRoadmaps')}
                                </h3>
                                <div className="space-y-3">
                                    {profile.roadmapHistory.map((entry: { roadmap: string; planTitle: string; createdAt: number }, idx: number) => (
                                        <details key={idx} className="group">
                                            <summary className="flex items-center justify-between cursor-pointer list-none py-2 px-3 rounded-lg text-xs font-medium" style={{ background: 'var(--background)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                                                <span className="flex items-center gap-2">
                                                    <span style={{ color: 'var(--text-muted)' }}>#{profile.roadmapHistory.length - idx}</span>
                                                    {entry.planTitle || 'Plan'}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                                                    {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </span>
                                            </summary>
                                            <p className="text-xs whitespace-pre-wrap leading-relaxed mt-2 px-2 pb-1" style={{ color: 'var(--text-muted)' }}>{entry.roadmap}</p>
                                        </details>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Daily Stand-up */}
                        <div className={card} style={cs}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    <Icon icon={BarChart3} size={14} style={{ color: '#f59e0b' }} /> {t('autopilot.standup.title')}
                                </h3>
                                <button onClick={fetchStandup} disabled={standupLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                                    {standupLoading ? <Icon icon={Loader2} size={12} className="animate-spin" /> : <Icon icon={RefreshCw} size={12} />} {t('autopilot.standup.generate')}
                                </button>
                            </div>
                            {standup ? (
                                <pre className="text-xs whitespace-pre-wrap leading-relaxed font-mono" style={{ color: 'var(--text-secondary)' }}>{standup}</pre>
                            ) : (
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('autopilot.standup.clickToGenerate')}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                    SECTION C: EXECUTION BOARD (Kanban / List)
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                {activeSection === 'board' && (
                    <div className="space-y-4">

                        {/* Board toolbar */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            {/* Left: filter + project pills */}
                            <div className="flex gap-1.5 flex-wrap items-center">
                                {['all', 'pending', 'in_progress', 'blocked', 'completed', 'cancelled'].map(f => (
                                    <button key={f} onClick={() => setBoardFilter(f)}
                                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize"
                                        style={{
                                            background: boardFilter === f ? 'rgba(245,158,11,0.15)' : 'var(--surface)',
                                            color:      boardFilter === f ? '#f59e0b' : 'var(--text-muted)',
                                            border:     `1px solid ${boardFilter === f ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                                        }}>
                                        {f === 'all' ? `All (${tasks.length})` : `${STATE_CONFIG[f]?.label ?? f} (${tasks.filter(t => t.state === f).length})`}
                                    </button>
                                ))}
                            </div>
                            {/* Right controls */}
                            <div className="flex gap-2 shrink-0 items-center">
                                {/* Kanban / List toggle */}
                                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                                    <button onClick={() => setBoardView('kanban')}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium"
                                        style={{ background: boardView === 'kanban' ? 'rgba(245,158,11,0.15)' : 'var(--surface)', color: boardView === 'kanban' ? '#f59e0b' : 'var(--text-muted)' }}>
                                        <Icon icon={LayoutGrid} size={11} /> {t('autopilot.board.boardView')}
                                    </button>
                                    <button onClick={() => setBoardView('list')}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium"
                                        style={{ background: boardView === 'list' ? 'rgba(245,158,11,0.15)' : 'var(--surface)', color: boardView === 'list' ? '#f59e0b' : 'var(--text-muted)', borderLeft: '1px solid var(--border)' }}>
                                        <Icon icon={List} size={11} /> {t('autopilot.board.listView')}
                                    </button>
                                </div>
                                <button onClick={fetchTasks} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                    <Icon icon={RefreshCw} size={13} />
                                </button>
                                {/* Add Project */}
                                <button onClick={() => setAddingProject(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                                    style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                                    <Icon icon={FolderPlus} size={12} /> Project
                                </button>
                                <button onClick={() => { setAddingTask(true); setAddingToColumn(null); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                                    style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                    <Icon icon={Plus} size={13} /> Task
                                </button>
                            </div>
                        </div>

                        {/* Project Legend (colored badges) */}
                        {projectNames.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap px-1">
                                {projectNames.map(pn => (
                                    <span key={pn} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                        style={{ background: `${projectColorMap[pn]}18`, color: projectColorMap[pn], border: `1px solid ${projectColorMap[pn]}40` }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: projectColorMap[pn] }} />
                                        {pn}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* New Project inline form */}
                        {addingProject && (
                            <div className="flex items-center gap-2 px-1">
                                <Icon icon={FolderPlus} size={14} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                                <input className={`flex-1 ${inp}`} style={inps} placeholder="Project name..." autoFocus
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && newProjectName.trim()) {
                                            // Creating a project = adding a placeholder pending task with planTitle
                                            post('add_task', { title: `Setup: ${newProjectName.trim()}`, description: `Initial setup task for project "${newProjectName.trim()}"`, priority: 'normal', planTitle: newProjectName.trim() })
                                                .then(() => fetchTasks());
                                            setNewProjectName(''); setAddingProject(false);
                                        }
                                        if (e.key === 'Escape') { setNewProjectName(''); setAddingProject(false); }
                                    }} />
                                <button onClick={() => {
                                    if (newProjectName.trim()) {
                                        post('add_task', { title: `Setup: ${newProjectName.trim()}`, description: `Initial setup task for project "${newProjectName.trim()}"`, priority: 'normal', planTitle: newProjectName.trim() })
                                            .then(() => fetchTasks());
                                        setNewProjectName(''); setAddingProject(false);
                                    }
                                }} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                                    Create
                                </button>
                                <button onClick={() => { setNewProjectName(''); setAddingProject(false); }} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                                    <Icon icon={X} size={13} />
                                </button>
                            </div>
                        )}

                        {/* Add Task form (shared for both views) */}
                        {addingTask && (
                            <div className={card} style={{ ...cs, borderColor: 'rgba(245,158,11,0.3)' }}>
                                <h4 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>New Task {addingToColumn ? `(${STATE_CONFIG[addingToColumn]?.label ?? addingToColumn})` : ''}</h4>
                                <div className="space-y-2">
                                    <input className={inp} style={inps} placeholder="Task title..." autoFocus value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} />
                                    <textarea rows={2} className={inp} style={inps} placeholder="Description (optional)..." value={newTask.description} onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <select className={inp} style={inps} value={newTask.priority} onChange={e => setNewTask(t => ({ ...t, priority: e.target.value }))}>
                                            <option value="high">{t('autopilot.priority.high')}</option>
                                            <option value="normal">{t('autopilot.priority.normal')}</option>
                                            <option value="low">{t('autopilot.priority.low')}</option>
                                        </select>
                                        <select className={inp} style={inps} value={newTask.planTitle} onChange={e => setNewTask(t => ({ ...t, planTitle: e.target.value }))}>
                                            <option value="">{t('autopilot.priority.noProject')}</option>
                                            {projectNames.map(pn => <option key={pn} value={pn}>{pn}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={addTask} disabled={taskAction === 'adding'} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                            {taskAction === 'adding' ? <Icon icon={Loader2} size={12} className="animate-spin" /> : <Icon icon={Plus} size={12} />} Add
                                        </button>
                                        <button onClick={() => { setAddingTask(false); setAddingToColumn(null); }} className="px-4 py-2 rounded-xl text-xs" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* â”€â”€ Content â”€â”€ */}
                        {(() => {
                            // â”€â”€ Shared Kanban task card component â”€â”€
                            const KanbanCard = ({ task }: { task: any }) => {
                                const sc             = STATE_CONFIG[task.state] ?? STATE_CONFIG.pending;
                                const isEditing      = editingTask?.id === task.id;
                                const resultExpanded = expandedResults.has(task.id);
                                const descExpanded   = expandedDescs.has(task.id);
                                const projColor      = task.planTitle?.trim() ? projectColorMap[task.planTitle.trim()] : null;
                                const isMoving       = movingTaskId === task.id;
                                const isCancelled    = task.state === 'cancelled';
                                // Cancelled = soft grey card; blocked/failed = vivid red accent
                                const cardBorderTop  = isCancelled ? '2px solid #374151' : `2.5px solid ${sc.color}`;
                                const cardOpacity    = isCancelled ? 0.65 : 1;

                                return (
                                    <div className="rounded-xl border p-3 transition-all hover:shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', borderTop: cardBorderTop, opacity: cardOpacity }}>
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <input className={inp} style={{ ...inps, fontSize: '12px' }} value={editingTask.title} onChange={e => setEditingTask((t: any) => ({ ...t, title: e.target.value }))} />
                                                <textarea rows={2} className={inp} style={{ ...inps, fontSize: '11px' }} value={editingTask.description} onChange={e => setEditingTask((t: any) => ({ ...t, description: e.target.value }))} />
                                                <select className={inp} style={{ ...inps, fontSize: '11px' }} value={editingTask.priority} onChange={e => setEditingTask((t: any) => ({ ...t, priority: e.target.value }))}>
                                                    <option value="high">{t('autopilot.priority.highShort')}</option>
                                                    <option value="normal">{t('autopilot.priority.normalShort')}</option>
                                                    <option value="low">{t('autopilot.priority.lowShort')}</option>
                                                </select>
                                                <div className="flex gap-1.5">
                                                    <button onClick={saveEditTask} disabled={taskAction === 'saving'} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                                                        {taskAction === 'saving' ? <Icon icon={Loader2} size={10} className="animate-spin" /> : <Icon icon={Save} size={10} />} Save
                                                    </button>
                                                    <button onClick={() => setEditingTask(null)} className="px-2.5 py-1 rounded-lg text-[10px]" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Project label badge */}
                                                {projColor && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold mb-1.5"
                                                        style={{ background: `${projColor}18`, color: projColor, border: `1px solid ${projColor}40` }}>
                                                        <span className="w-1 h-1 rounded-full" style={{ background: projColor }} />
                                                        {task.planTitle.trim()}
                                                    </span>
                                                )}

                                                {/* Title */}
                                                <p className="text-xs font-semibold mb-1 leading-snug" style={{ color: 'var(--text-primary)' }}>{task.title}</p>

                                                {/* Approval badge */}
                                                {task.requiresApproval && task.approvalStatus === 'pending' && (
                                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold animate-pulse mb-1" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>âš  APPROVAL</span>
                                                )}

                                                {/* Description with compact 2-line truncation + expand */}
                                                {task.description && (() => {
                                                    const isLong = task.description.length > 100;
                                                    return (
                                                        <div className="mb-1.5">
                                                            <p className="text-[10px] leading-relaxed" style={{
                                                                color: 'var(--text-muted)',
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: descExpanded ? 'unset' : 2,
                                                                WebkitBoxOrient: 'vertical',
                                                                overflow: descExpanded ? 'visible' : 'hidden',
                                                            }}>{task.description}</p>
                                                            {isLong && (
                                                                <button onClick={() => setExpandedDescs(s => { const n = new Set(s); descExpanded ? n.delete(task.id) : n.add(task.id); return n; })}
                                                                    className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                                                                    {descExpanded ? 'â–² less' : 'â–¼ more'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                {/* Result box */}
                                                {task.result && (
                                                    <div className="rounded-md overflow-hidden mb-1.5" style={{ border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.04)' }}>
                                                        <button onClick={() => setExpandedResults(s => {
                                                            const n = new Set(s);
                                                            resultExpanded ? n.delete(task.id) : n.add(task.id);
                                                            return n;
                                                        })} className="w-full flex items-center justify-between px-2 py-1" style={{ borderBottom: resultExpanded ? '1px solid rgba(34,197,94,0.15)' : 'none' }}>
                                                            <span className="text-[9px] font-bold flex items-center gap-1" style={{ color: '#22c55e' }}>
                                                                <Icon icon={CheckCircle} size={9} /> Result
                                                            </span>
                                                            <Icon icon={resultExpanded ? ChevronDown : ChevronRight} size={9} style={{ color: '#22c55e' }} />
                                                        </button>
                                                        {resultExpanded && (
                                                            <>
                                                                <p className="text-[10px] px-2 py-1.5 whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{task.result}</p>
                                                                {(() => {
                                                                    const files = extractFilePaths(task.result);
                                                                    return (
                                                                        <div className="flex flex-wrap gap-1 px-2 pb-1.5">
                                                                            {files.map((f, i) => (
                                                                                <button key={i} onClick={() => openInExplorer(f.path)}
                                                                                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
                                                                                    style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                                                                                    title={`Open: ${f.path}`}>
                                                                                    <Icon icon={FolderOpen} size={8} /> {f.label}
                                                                                </button>
                                                                            ))}
                                                                            {/* Always show workspace shortcut */}
                                                                            <button onClick={openWorkspaceFolder}
                                                                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
                                                                                style={{ background: 'rgba(99,102,241,0.06)', color: '#818cf8', border: '1px dashed rgba(99,102,241,0.25)' }}
                                                                                title="Open Hands Free workspace folder">
                                                                                <Icon icon={FolderOpen} size={8} /> Workspace
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Blocked / approval reasons */}
                                                {task.blockedReason && (
                                                    <p className="text-[10px] mb-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>ðŸš« {task.blockedReason}</p>
                                                )}
                                                {task.approvalReason && (
                                                    <p className="text-[10px] mb-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b' }}>âš  {task.approvalReason}</p>
                                                )}

                                                {/* Meta: priority dot + time */}
                                                <div className="flex items-center gap-2 text-[9px] mb-2" style={{ color: 'var(--text-muted)' }}>
                                                    <span style={{ color: PRIORITY_COLORS[task.priority] }}>â— {task.priority}</span>
                                                    {task.retryCount > 0 && <span style={{ color: '#f97316' }}>retry {task.retryCount}</span>}
                                                    <span>{timeAgo(task.createdAt)}</span>
                                                </div>

                                                {/* Action row */}
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {/* Approve / Reject */}
                                                    {task.requiresApproval && task.approvalStatus === 'pending' && (
                                                        <>
                                                            <button onClick={() => approveTask(task.id)} disabled={taskAction === task.id + '_approve'}
                                                                className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[9px] font-bold"
                                                                style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                                                                <Icon icon={ThumbsUp} size={9} /> Yes
                                                            </button>
                                                            <button onClick={() => rejectTask(task.id)} disabled={taskAction === task.id + '_reject'}
                                                                className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[9px] font-bold"
                                                                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                                                                <Icon icon={ThumbsDown} size={9} /> No
                                                            </button>
                                                        </>
                                                    )}
                                                    {/* Retry */}
                                                    {['blocked', 'failed'].includes(task.state) && (
                                                        <button onClick={() => retryTask(task.id)} disabled={taskAction === task.id + '_retry'}
                                                            className="flex items-center gap-0.5 px-2 py-1 rounded-md text-[9px] font-bold"
                                                            style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                                                            <Icon icon={RefreshCw} size={9} /> Retry
                                                        </button>
                                                    )}
                                                    {/* Move to project */}
                                                    {isMoving ? (
                                                        <select autoFocus className="text-[9px] px-1 py-0.5 rounded border" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                                            value={task.planTitle?.trim() || ''}
                                                            onChange={e => moveTaskToProject(task.id, e.target.value)}
                                                            onBlur={() => setMovingTaskId(null)}>
                                                            <option value="">{t('autopilot.priority.noProject')}</option>
                                                            {projectNames.map(pn => <option key={pn} value={pn}>{pn}</option>)}
                                                        </select>
                                                    ) : (
                                                        <button onClick={() => setMovingTaskId(task.id)}
                                                            className="p-1 rounded-md" title="Move to project"
                                                            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                                            <Icon icon={ArrowRightLeft} size={9} />
                                                        </button>
                                                    )}
                                                    {/* Edit */}
                                                    {['pending', 'blocked'].includes(task.state) && (
                                                        <button onClick={() => setEditingTask({ ...task })} className="p-1 rounded-md" title="Edit" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                                            <Icon icon={Edit3} size={9} />
                                                        </button>
                                                    )}
                                                    {/* Cancel */}
                                                    {['pending', 'in_progress'].includes(task.state) && !task.requiresApproval && (
                                                        <button onClick={() => cancelTask(task.id)} disabled={taskAction === task.id + '_cancel'}
                                                            className="p-1 rounded-md" style={{ color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                                            <Icon icon={X} size={9} />
                                                        </button>
                                                    )}
                                                    {/* Delete */}
                                                    {['completed', 'failed', 'blocked', 'cancelled'].includes(task.state) && (
                                                        <button onClick={() => deleteTask(task.id)} disabled={taskAction === task.id + '_delete'}
                                                            className="p-1 rounded-md" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                                                            <Icon icon={Trash2} size={9} />
                                                        </button>
                                                    )}
                                                    {/* Priority (pending only) */}
                                                    {task.state === 'pending' && (
                                                        <select className="text-[9px] px-1 py-0.5 rounded border ml-auto" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: PRIORITY_COLORS[task.priority] }}
                                                            value={task.priority} onChange={e => setPriority(task.id, e.target.value)}>
                                                            <option value="high">{t('autopilot.priority.highShort')}</option>
                                                            <option value="normal">{t('autopilot.priority.normalShort')}</option>
                                                            <option value="low">{t('autopilot.priority.lowShort')}</option>
                                                        </select>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            };

                            if (tasksLoading) {
                                return <div className="flex justify-center py-12"><Icon icon={Loader2} size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
                            }

                            if (filteredTasks.length === 0 && !addingTask) {
                                return (
                                    <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                                        <Icon icon={LayoutGrid} size={36} style={{ margin: '0 auto 10px', opacity: 0.2 }} />
                                        <p className="text-sm font-medium mb-1">{t('autopilot.empty.tasks')}</p>
                                        <p className="text-xs">{t('autopilot.board.noTasksClickToStart')}</p>
                                    </div>
                                );
                            }

                            // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                            //  KANBAN BOARD VIEW
                            // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                            if (boardView === 'kanban') {
                                const KANBAN_COLS = [
                                    { key: 'pending',     ...STATE_CONFIG.pending },
                                    { key: 'in_progress', ...STATE_CONFIG.in_progress },
                                    { key: 'completed',   ...STATE_CONFIG.completed },
                                    { key: 'blocked',     label: 'Blocked / Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: AlertTriangle },
                                ];

                                return (
                                    <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: '400px' }}>
                                        {KANBAN_COLS.map(col => {
                                            const colTasks = kanbanColumns[col.key] || [];
                                            return (
                                                <div key={col.key} className="shrink-0 rounded-xl border flex flex-col"
                                                    style={{ width: '280px', background: col.bg, borderColor: `${col.color}30` }}>
                                                    {/* Column header */}
                                                    <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: `${col.color}25` }}>
                                                        <div className="flex items-center gap-2">
                                                            <Icon icon={col.icon} size={13} style={{ color: col.color }} />
                                                            <span className="text-xs font-bold" style={{ color: col.color }}>{col.label}</span>
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${col.color}20`, color: col.color }}>{colTasks.length}</span>
                                                        </div>
                                                        <button onClick={() => { setAddingTask(true); setAddingToColumn(col.key); setNewTask(t => ({ ...t, planTitle: '' })); }}
                                                            className="p-1 rounded-md transition-all hover:scale-110"
                                                            title={`Add task to ${col.label}`}
                                                            style={{ color: col.color, background: `${col.color}15` }}>
                                                            <Icon icon={Plus} size={12} />
                                                        </button>
                                                    </div>
                                                    {/* Column body: task cards */}
                                                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                                        {colTasks.length === 0 ? (
                                                            <p className="text-center text-[10px] py-6" style={{ color: `${col.color}60` }}>{t('autopilot.empty.noTasks')}</p>
                                                        ) : colTasks.map((task: any) => (
                                                            <KanbanCard key={task.id} task={task} />
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            }

                            // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                            //  LIST VIEW (project-grouped)
                            // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                            return (
                                <div className="space-y-5">
                                    {projectGroups.map(([projectTitle, projectTasks]) => {
                                        const isCollapsed = collapsedProjects.has(projectTitle);
                                        const pStats = {
                                            pending:     projectTasks.filter((t: any) => t.state === 'pending').length,
                                            in_progress: projectTasks.filter((t: any) => t.state === 'in_progress').length,
                                            completed:   projectTasks.filter((t: any) => t.state === 'completed').length,
                                            blocked:     projectTasks.filter((t: any) => t.state === 'blocked').length,
                                        };
                                        const isStandalone = projectTitle === 'Standalone Tasks';
                                        const progress = projectTasks.length > 0
                                            ? Math.round((pStats.completed / projectTasks.length) * 100) : 0;
                                        const hasDeletable = projectTasks.some((t: any) => ['completed', 'failed', 'blocked', 'cancelled'].includes(t.state));
                                        const projColor = projectColorMap[projectTitle] ?? 'var(--text-muted)';

                                        return (
                                            <div key={projectTitle}>
                                                {/* Project header */}
                                                <div className="flex items-center gap-2 mb-2 px-1">
                                                    <button
                                                        onClick={() => setCollapsedProjects(s => {
                                                            const n = new Set(s);
                                                            isCollapsed ? n.delete(projectTitle) : n.add(projectTitle);
                                                            return n;
                                                        })}
                                                        className="flex items-center gap-2 flex-1 min-w-0"
                                                    >
                                                        <Icon icon={isCollapsed ? ChevronRight : ChevronDown} size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                        {!isStandalone && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: projColor }} />}
                                                        <span className="text-xs font-bold truncate" style={{ color: isStandalone ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                                            {isStandalone ? t('autopilot.board.standaloneTasks') : projectTitle}
                                                        </span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {pStats.in_progress > 0 && (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                                                                    {pStats.in_progress} running
                                                                </span>
                                                            )}
                                                            {pStats.blocked > 0 && (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                                                    {pStats.blocked} blocked
                                                                </span>
                                                            )}
                                                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                                                {pStats.completed}/{projectTasks.length}
                                                            </span>
                                                        </div>
                                                    </button>
                                                    {!isStandalone && !isCollapsed && (
                                                        <div className="shrink-0 w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                                            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: progress === 100 ? '#22c55e' : projColor }} />
                                                        </div>
                                                    )}
                                                    {hasDeletable && (
                                                        <button onClick={() => deleteProject(projectTitle)}
                                                            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]"
                                                            style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
                                                            title="Clean finished tasks">
                                                            <Icon icon={Trash2} size={9} /> Clean
                                                        </button>
                                                    )}
                                                </div>
                                                {!isCollapsed && (
                                                    <div className="grid gap-2 pl-5 border-l" style={{ borderColor: isStandalone ? 'transparent' : `${projColor}40` }}>
                                                        {projectTasks.map((task: any) => <KanbanCard key={task.id} task={task} />)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                    SECTION E: LIVE EXECUTION VIEW
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                {activeSection === 'live' && (() => {
                    // Determine which task to show: selected, or currently in-progress, or most recent completed
                    const inProgressTask = tasks.find((t: any) => t.state === 'in_progress');
                    const selectedId = liveTaskId ?? inProgressTask?.id ?? tasks.find((t: any) => t.state === 'completed')?.id;

                    // Filter execution logs for the selected task
                    const LIVE_ACTIONS = ['task_started', 'task_thinking', 'task_tool_call', 'task_tool_result', 'task_step', 'task_completed', 'task_failed', 'task_blocked'];
                    const executionLogs = selectedId
                        ? logs.filter((l: any) => l.taskId === selectedId && LIVE_ACTIONS.includes(l.action))
                              .sort((a: any, b: any) => a.ts - b.ts)
                        : [];

                    // Task selector: recent tasks (active + completed, max 15)
                    const selectableTasks = tasks
                        .filter((t: any) => ['in_progress', 'completed', 'blocked', 'failed'].includes(t.state))
                        .slice(0, 15);

                    const STEP_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
                        task_started:     { icon: 'â–¶',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                        task_thinking:    { icon: 'ðŸ§ ', color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)' },
                        task_tool_call:   { icon: 'ðŸ”§', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
                        task_tool_result: { icon: 'ðŸ“Ž', color: '#22c55e', bg: 'rgba(34,197,94,0.06)' },
                        task_step:        { icon: 'â†’',  color: '#94a3b8', bg: 'rgba(148,163,184,0.06)' },
                        task_completed:   { icon: 'âœ…', color: '#22c55e', bg: 'rgba(34,197,94,0.10)' },
                        task_failed:      { icon: 'âŒ', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
                        task_blocked:     { icon: 'ðŸš«', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
                    };

                    return (
                        <div className="space-y-3">
                            {/* Task selector */}
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {t('autopilot.live.selectTask') || 'Select task'}:
                                </label>
                                <select
                                    value={selectedId ?? ''}
                                    onChange={e => setLiveTaskId(e.target.value || null)}
                                    className="flex-1 px-3 py-1.5 rounded-lg text-xs border"
                                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                                    {selectableTasks.length === 0 && <option value="">{t('autopilot.live.noActiveTask') || 'No tasks to display'}</option>}
                                    {selectableTasks.map((t: any) => (
                                        <option key={t.id} value={t.id}>
                                            {t.state === 'in_progress' ? 'âš¡ ' : t.state === 'completed' ? 'âœ… ' : 'â¬œ '}
                                            {t.title.slice(0, 60)}
                                        </option>
                                    ))}
                                </select>
                                {inProgressTask && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                                        style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                                        <Icon icon={Loader2} size={10} className="animate-spin" /> LIVE
                                    </span>
                                )}
                            </div>

                            {/* Execution timeline */}
                            <div className="rounded-2xl overflow-hidden border" style={{ background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)' }}>
                                <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                    <span className="ml-2 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                        {t('autopilot.tabs.liveExecution') || 'Live Execution'}
                                    </span>
                                    {inProgressTask && <Icon icon={Loader2} size={11} className="animate-spin ml-auto" style={{ color: '#f59e0b' }} />}
                                </div>

                                <div className="p-4 space-y-2 overflow-y-auto max-h-[65vh]">
                                    {executionLogs.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Icon icon={Activity} size={28} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 8px' }} />
                                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                                                {selectedId
                                                    ? (t('autopilot.live.noSteps') || 'No execution steps recorded for this task yet.')
                                                    : (t('autopilot.live.selectPrompt') || 'Select a task to view its execution trace.')}
                                            </p>
                                        </div>
                                    ) : executionLogs.map((entry: any) => {
                                        const style = STEP_STYLES[entry.action] ?? STEP_STYLES.task_step;
                                        return (
                                            <div key={entry.id} className="rounded-xl px-3 py-2" style={{ background: style.bg }}>
                                                <div className="flex items-start gap-2">
                                                    <span className="text-sm flex-shrink-0" style={{ lineHeight: '1.4' }}>{style.icon}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                                                {entry.timestamp?.slice(11, 19)}
                                                            </span>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: style.color }}>
                                                                {entry.action === 'task_thinking' ? (t('autopilot.live.thinking') || 'Thinking') :
                                                                 entry.action === 'task_tool_call' ? (t('autopilot.live.toolCall') || 'Tool Call') :
                                                                 entry.action === 'task_tool_result' ? (t('autopilot.live.toolResult') || 'Result') :
                                                                 entry.action.replace('task_', '')}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-mono break-words" style={{
                                                            color: entry.action === 'task_tool_call' ? '#93c5fd' :
                                                                   entry.action === 'task_thinking' ? 'rgba(255,255,255,0.6)' :
                                                                   'rgba(255,255,255,0.75)',
                                                            whiteSpace: 'pre-wrap',
                                                        }}>
                                                            {entry.message}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={liveEndRef} />
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                    SECTION A: IDENTITY & MEMORY
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                {activeSection === 'memory' && (
                    <div className="space-y-4">
                        <div className={card} style={{ ...cs, borderColor: 'rgba(245,158,11,0.2)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    <Icon icon={Brain} size={14} style={{ color: '#f59e0b' }} /> {t('autopilot.identity.title')}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {!profileEditing && (
                                        <button
                                            onClick={() => setShowClearIdentityConfirm(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                                            style={{ background: 'rgba(239,68,68,0.06)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                                            {t('autopilot.identity.clear')}
                                        </button>
                                    )}
                                    {profileEditing && (
                                        <button
                                            onClick={() => { setProfileDraft(profile); setProfileEditing(false); }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                                            style={{ background: 'rgba(100,116,139,0.08)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                            {t('common.cancel')}
                                        </button>
                                    )}
                                    <button onClick={() => profileEditing ? saveProfile() : setProfileEditing(true)} disabled={profileSaving}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                                        style={{ background: profileEditing ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.08)', color: profileEditing ? '#22c55e' : '#f59e0b', border: `1px solid ${profileEditing ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.25)'}` }}>
                                        {profileSaving ? <Icon icon={Loader2} size={11} className="animate-spin" /> : <Icon icon={profileEditing ? Save : Edit3} size={11} />}
                                        {profileEditing ? t('autopilot.identity.saveMemory') : t('autopilot.identity.edit')}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { key: 'preferredName',    label: 'Preferred Name',        ph: 'e.g. Mario' },
                                    { key: 'primaryGoal',      label: 'Primary Goal',           ph: 'What are you ultimately trying to achieve?' },
                                    { key: 'niche',            label: 'Niche / Domain',         ph: 'e.g. SaaS, e-commerce, content creator...' },
                                    { key: 'budget',           label: 'Budget / Resources',     ph: 'e.g. $500/month, bootstrapped, VC-backed...' },
                                    { key: 'constraints',      label: 'Constraints',            ph: 'Time, legal, technical, geographic limitations...' },
                                    { key: 'additionalContext', label: 'Additional Context',    ph: 'Anything else Hands Free should know about your situation...' },
                                ].map(({ key, label, ph }) => (
                                    <div key={key}>
                                        <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-primary)' }}>{label}</label>
                                        {profileEditing ? (
                                            <textarea rows={2} className={inp} style={inps} placeholder={ph}
                                                value={profileDraft[key] ?? ''}
                                                onChange={e => setProfileDraft((d: any) => ({ ...d, [key]: e.target.value }))} />
                                        ) : (
                                            <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'var(--background)', color: profileDraft[key] ? 'var(--text-secondary)' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                                {profile[key] || <span className="italic" style={{ color: 'var(--text-muted)' }}>{ph}</span>}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {profile.updatedAt && (
                                <p className="text-[10px] mt-4" style={{ color: 'var(--text-muted)' }}>
                                    Last updated: {fmtDate(profile.updatedAt)}
                                </p>
                            )}
                        </div>

                        {/* Master Plan */}
                        {profile.masterPlan && (
                            <div className={card} style={cs}>
                                <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                    <Icon icon={TrendingUp} size={14} style={{ color: '#f59e0b' }} /> {t('autopilot.identity.strategicRoadmap')}
                                </h3>
                                {profileEditing ? (
                                    <textarea rows={5} className={inp} style={inps} value={profileDraft.masterPlan ?? ''}
                                        onChange={e => setProfileDraft((d: any) => ({ ...d, masterPlan: e.target.value }))} />
                                ) : (
                                    <p className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{profile.masterPlan}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                    SECTION D: LIVE HISTORY & LOGS
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                {activeSection === 'logs' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1">
                                {['all', 'info', 'success', 'warning', 'error'].map(f => (
                                    <button key={f} onClick={() => setLogFilter(f)}
                                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize"
                                        style={{
                                            background: logFilter === f ? 'rgba(245,158,11,0.15)' : 'var(--surface)',
                                            color:      logFilter === f ? '#f59e0b'  : LOG_COLORS[f] ?? 'var(--text-muted)',
                                            border:     `1px solid ${logFilter === f ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                                        }}>
                                        {f === 'all' ? `All (${logs.length})` : f}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={fetchLogs} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                    <Icon icon={RefreshCw} size={13} />
                                </button>
                                <button onClick={clearLogs} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                                    <Icon icon={Trash2} size={11} /> Clear
                                </button>
                            </div>
                        </div>

                        {/* Terminal */}
                        <div className="rounded-2xl overflow-hidden border" style={{ background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.06)' }}>
                            {/* Terminal header */}
                            <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                <span className="ml-2 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>autopilot.log</span>
                                {logsLoading && <Icon icon={Loader2} size={11} className="animate-spin ml-auto" style={{ color: 'rgba(255,255,255,0.3)' }} />}
                            </div>

                            {/* Log entries */}
                            <div className="p-4 space-y-1 overflow-y-auto max-h-[60vh] font-mono text-xs">
                                {filteredLogs.length === 0 ? (
                                    <p style={{ color: 'rgba(255,255,255,0.2)' }}>{t('autopilot.empty.log')}</p>
                                ) : filteredLogs.map(entry => (
                                    <div key={entry.id} className="flex items-start gap-2 py-0.5">
                                        <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
                                            {entry.timestamp.slice(11, 19)}
                                        </span>
                                        <span style={{ color: LOG_COLORS[entry.level] ?? '#94a3b8', flexShrink: 0 }}>
                                            [{LOG_ICONS[entry.level] ?? 'i'}]
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                                            {entry.action}
                                        </span>
                                        <span style={{ color: 'rgba(255,255,255,0.85)' }}>{entry.message}</span>
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Clear Identity Confirmation Modal */}
            {showClearIdentityConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-[var(--surface)] border border-red-500/30 rounded-2xl p-6 max-w-sm mx-4 space-y-4">
                        <h3 className="text-lg font-bold text-red-400">Clear All Identity Fields?</h3>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            This will erase all your identity information and cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowClearIdentityConfirm(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--sidebar-hover)]"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowClearIdentityConfirm(false);
                                    const empty = { preferredName: '', primaryGoal: '', niche: '', budget: '', constraints: '', additionalContext: '', masterPlan: '' };
                                    setProfileDraft(empty);
                                    fetch('/api/autopilot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save_profile', profile: empty }) });
                                    setProfile(empty);
                                }}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-red-400 bg-red-500/20 border border-red-500/40 hover:bg-red-500 hover:text-white transition-all"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
