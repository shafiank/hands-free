'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { listProjects, getRandomSurprises, type HandsFreeStudioProject, type HandsFreeStudioPlan, type BuildStep } from '@/actions/code-builder';
import { Loader2, Square, Send, FolderOpen, Download } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const Icon = ({ icon: I, ...p }: { icon: any; [k: string]: any }) => <I {...p} />;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Quick Ideas Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const QUICK_IDEAS = [
    { id: 'snake', emoji: 'Ã°Å¸Å½Â®', labelKey: 'code.ideas.snake', prompt: 'A retro Snake game with neon colors on a dark background, high score saved to localStorage, arrow key controls, and a start/restart screen' },
    { id: 'portfolio', emoji: 'Ã°Å¸Å’Â', labelKey: 'code.ideas.portfolio', prompt: 'A personal developer portfolio website with hero section, skills grid, projects showcase, and contact form. Dark theme, modern typography.' },
    { id: 'dashboard', emoji: 'Ã°Å¸â€œÅ ', labelKey: 'code.ideas.dashboard', prompt: 'An admin dashboard with stat cards (users, revenue, orders, growth), a line chart, recent activity table, and dark sidebar navigation' },
    { id: 'productPage', emoji: 'Ã°Å¸â€ºâ€™', labelKey: 'code.ideas.productPage', prompt: 'A product landing page for a premium wireless headphone. Image gallery, feature highlights, pricing, reviews section, and add-to-cart button' },
    { id: 'blog', emoji: 'Ã°Å¸â€œÂ', labelKey: 'code.ideas.blog', prompt: 'A minimal blog homepage with featured post hero, recent posts grid with thumbnails, categories sidebar, and newsletter signup footer' },
    { id: 'apiServer', emoji: 'Ã°Å¸â€Â§', labelKey: 'code.ideas.apiServer', prompt: 'A Node.js Express REST API server with user CRUD endpoints, JWT auth middleware, input validation, error handling, and health check endpoint' },
];

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
type AppState = 'welcome' | 'planning' | 'building' | 'complete' | 'error';

interface PlanningMessage {
    role: 'architect' | 'reviewer' | 'system';
    text: string;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ CSS Keyframes (injected once) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const HANDSFREE_STUDIO_KEYFRAMES = `
@keyframes gradientShift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}
@keyframes lionGlow {
    0%, 100% {
        filter: drop-shadow(0 0 12px rgba(167,139,250,0.5)) drop-shadow(0 0 4px rgba(139,92,246,0.3));
        transform: scale(1) translateY(0);
    }
    50% {
        filter: drop-shadow(0 0 28px rgba(167,139,250,0.85)) drop-shadow(0 0 50px rgba(99,102,241,0.35));
        transform: scale(1.04) translateY(-3px);
    }
}
@keyframes gridPulse {
    0%, 100% { opacity: 0.35; }
    50%       { opacity: 0.7; }
}
@keyframes handsFreeStudioFadeIn {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
}
@keyframes handsFreeStudioFadeOut {
    from { opacity: 1; transform: scale(1); }
    to   { opacity: 0; transform: scale(0.97); }
}
`;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Main Component Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export default function CodePage() {
    const router = useRouter();
    const { t } = useTranslation();
    const [appState, setAppState] = useState<AppState>('welcome');
    const [leavingWelcome, setLeavingWelcome] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [recentProjects, setRecentProjects] = useState<HandsFreeStudioProject[]>([]);
    const [surprises, setSurprises] = useState<string[]>([]);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState('');

    // Planning state
    const [planningMessages, setPlanningMessages] = useState<PlanningMessage[]>([]);
    const [planningPhase, setPlanningPhase] = useState('');
    const [finalPlan, setFinalPlan] = useState<HandsFreeStudioPlan | null>(null);

    // Building state
    const [steps, setSteps] = useState<BuildStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [buildProgress, setBuildProgress] = useState(0);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [builtFiles, setBuiltFiles] = useState<{ name: string; size: number }[]>([]);
    const [buildLog, setBuildLog] = useState<string[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [projectDir, setProjectDir] = useState('');

    // Complete state
    const [iteratePrompt, setIteratePrompt] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [ftpProfileCount, setFtpProfileCount] = useState(0);

    const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
    const buildStartRef = useRef<number>(0);
    const buildLogRef = useRef<HTMLDivElement>(null);
    const planScrollRef = useRef<HTMLDivElement>(null);
    const promptRef = useRef<HTMLTextAreaElement>(null);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Skill gate Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    useEffect(() => {
        fetch('/api/skills/active')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data.skills) && !data.skills.includes('handsfree_studio')) {
                    router.replace('/skills');
                }
            })
            .catch(() => { });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        loadRecent();
        getRandomSurprises(6).then(s => setSurprises(s));
        fetch('/api/ftp/profiles').then(r => r.json()).then(d => {
            if (Array.isArray(d.profiles)) setFtpProfileCount(d.profiles.length);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (buildLogRef.current) {
            buildLogRef.current.scrollTop = buildLogRef.current.scrollHeight;
        }
    }, [buildLog]);

    useEffect(() => {
        if (planScrollRef.current) {
            planScrollRef.current.scrollTop = planScrollRef.current.scrollHeight;
        }
    }, [planningMessages]);

    const loadRecent = async () => {
        const projects = await listProjects();
        // Show all projects that have meaningful data:
        // - any non-planning status (building, complete, failed, paused)
        // - OR planning status but a plan already exists (architect/reviewer ran successfully)
        // Only hide projects that are brand-new with status 'planning' AND no plan yet,
        // since those are incomplete stubs that would show an empty/wrong state.
        setRecentProjects(projects.filter(p => p.status !== 'planning' || p.plan !== null));
    };

    // Ã¢â€â‚¬Ã¢â€â‚¬ Transition helper Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const transitionFromWelcome = async (fn: () => void | Promise<void>) => {
        setLeavingWelcome(true);
        await new Promise(r => setTimeout(r, 280));
        setLeavingWelcome(false);
        await fn();
    };

    // Ã¢â€â‚¬Ã¢â€â‚¬ Load recent project Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const loadProject = (p: HandsFreeStudioProject) => {
        transitionFromWelcome(() => {
            setProjectId(p.id);
            setProjectName(p.name);
            setPrompt(p.prompt);
            setProjectDir(p.projectDir || '');
            setElapsedMs(p.elapsedMs || 0);
            if (p.steps?.length) setSteps(p.steps);

            if (p.status === 'complete') {
                const files = p.plan?.files?.map(f => ({ name: f, size: 0 })) || [];
                setBuiltFiles(files);
                if (p.plan) setFinalPlan(p.plan);
                setAppState('complete');
            } else if (p.status === 'failed') {
                // Show error state with the stored error message
                setErrorMessage(p.error || 'Build failed. You can retry from the planning view.');
                if (p.plan) {
                    setFinalPlan(p.plan);
                    // Restore planning messages from saved plan notes so the conversation
                    // context is not lost when the user re-opens a failed project.
                    const msgs: PlanningMessage[] = [
                        { role: 'system', text: `Ã°Å¸â€œâ€š Resuming project: "${p.name}"` },
                    ];
                    if (p.plan.architectNotes) msgs.push({ role: 'architect', text: p.plan.architectNotes });
                    if (p.plan.reviewerNotes) msgs.push({ role: 'reviewer', text: p.plan.reviewerNotes });
                    msgs.push({ role: 'system', text: `Ã¢Å¡Â Ã¯Â¸Â Previous build failed: ${p.error || 'unknown error'}` });
                    setPlanningMessages(msgs);
                    setAppState('planning');
                } else {
                    setAppState('error');
                }
            } else if (p.plan) {
                setFinalPlan(p.plan);
                // Restore planning chat from saved architect/reviewer notes stored in the plan,
                // so reopening a project shows meaningful context instead of a blank conversation.
                const msgs: PlanningMessage[] = [
                    { role: 'system', text: `Ã°Å¸â€œâ€š Resuming project: "${p.name}"` },
                ];
                if (p.plan.architectNotes) msgs.push({ role: 'architect', text: p.plan.architectNotes });
                if (p.plan.reviewerNotes) msgs.push({ role: 'reviewer', text: p.plan.reviewerNotes });
                if (p.status === 'building' || p.currentStep > 0) {
                    msgs.push({ role: 'system', text: `Ã¢Å¡â„¢Ã¯Â¸Â ${p.currentStep} of ${p.totalSteps || p.steps.length} steps completed` });
                }
                setPlanningMessages(msgs);
                setAppState('planning');
            } else {
                startPlanning(p.prompt);
            }
        });
    };

    // Ã¢â€â‚¬Ã¢â€â‚¬ Start Planning Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const startPlanningFromWelcome = (userPrompt?: string) => {
        transitionFromWelcome(() => startPlanning(userPrompt));
    };

    const startPlanning = async (userPrompt?: string) => {
        const p = userPrompt || prompt.trim();
        if (!p) return;
        setPrompt(p);
        setAppState('planning');
        setPlanningMessages([]);
        setPlanningPhase('Starting Hands Free Studio...');
        setFinalPlan(null);

        try {
            const res = await fetch('/api/code/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: p, projectId: null, isReplan: false }),
            });
            if (!res.body) throw new Error('No stream');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try { handlePlanEvent(JSON.parse(line.slice(6))); } catch { }
                }
            }
        } catch (err: any) {
            setErrorMessage(err?.message || 'Planning failed');
            setAppState('error');
        }
    };

    // Ã¢â€â‚¬Ã¢â€â‚¬ Re-plan with history Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const rePlanWithFeedback = async (userFeedback: string) => {
        if (!userFeedback.trim()) return;
        // Append user feedback and divider to the conversation
        setPlanningMessages(prev => [
            ...prev,
            { role: 'system', text: 'Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬' },
            { role: 'system', text: `Ã¢Å“ÂÃ¯Â¸Â Your feedback: "${userFeedback}"` },
            { role: 'system', text: 'Ã°Å¸â€â€ž Revising plan...' },
        ]);
        setPlanningPhase('Revising...');
        setFinalPlan(null);

        // Capture current messages for history (before appending feedback messages)
        const history = [...planningMessages];

        try {
            const res = await fetch('/api/code/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    projectId,
                    isReplan: true,
                    previousMessages: [
                        ...history,
                        { role: 'user_feedback', text: userFeedback },
                    ],
                }),
            });
            if (!res.body) throw new Error('No stream');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try { handlePlanEvent(JSON.parse(line.slice(6))); } catch { }
                }
            }
        } catch (err: any) {
            setErrorMessage(err?.message || 'Re-planning failed');
            setAppState('error');
        }
    };

    const handlePlanEvent = (ev: any) => {
        switch (ev.type) {
            case 'project':
                setProjectId(ev.projectId);
                setProjectName(ev.projectName);
                break;
            case 'phase':
                setPlanningPhase(ev.message);
                if (ev.phase === 'architect') setPlanningMessages(prev => [...prev, { role: 'system', text: 'Ã°Å¸Ââ€”Ã¯Â¸Â Architect is analyzing your idea...' }]);
                else if (ev.phase === 'reviewer') setPlanningMessages(prev => [...prev, { role: 'system', text: 'Ã°Å¸â€Â Reviewer is checking the plan...' }]);
                else if (ev.phase === 'finalizing') setPlanningMessages(prev => [...prev, { role: 'system', text: 'Ã°Å¸â€œâ€¹ Creating your final build plan...' }]);
                break;
            case 'architect': setPlanningMessages(prev => [...prev, { role: 'architect', text: ev.text }]); break;
            case 'reviewer': setPlanningMessages(prev => [...prev, { role: 'reviewer', text: ev.text }]); break;
            case 'plan':
                setFinalPlan(ev.plan);
                setSteps(Array.from({ length: ev.plan.steps.length }, (_, i) => ({ index: i, label: ev.plan.steps[i], status: 'pending' })));
                setPlanningPhase('');
                break;
            case 'error':
                setErrorMessage(ev.message);
                setAppState('error');
                break;
        }
    };

    // Ã¢â€â‚¬Ã¢â€â‚¬ Start Building Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const startBuilding = async (chatMsg?: string) => {
        if (!projectId) return;
        setAppState('building');
        setBuildLog([]);
        setBuildProgress(0);
        setElapsedMs(0);
        buildStartRef.current = Date.now();
        elapsedTimerRef.current = setInterval(() => setElapsedMs(Date.now() - buildStartRef.current), 1000);

        try {
            const res = await fetch('/api/code/build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, chatMessage: chatMsg }),
            });
            if (!res.body) throw new Error('No build stream');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try { handleBuildEvent(JSON.parse(line.slice(6))); } catch { }
                }
            }
        } catch (err: any) {
            setErrorMessage(err?.message || 'Build failed');
            setAppState('error');
        } finally {
            if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        }
    };

    const handleBuildEvent = (ev: any) => {
        switch (ev.type) {
            case 'build_start': addLog(`Ã°Å¸Å¡â‚¬ Build started - ${ev.totalSteps} steps`); break;
            case 'step_start':
                setCurrentStepIndex(ev.stepIndex);
                setBuildProgress(ev.progress);
                setSteps(prev => prev.map(s => s.index === ev.stepIndex ? { ...s, status: 'running' } : s));
                addLog(`Ã°Å¸â€â€ž Step ${ev.stepIndex + 1}: ${ev.stepLabel}`);
                break;
            case 'file_written':
                setBuiltFiles(prev => {
                    const idx = prev.findIndex(f => f.name === ev.fileName);
                    if (idx >= 0) { const u = [...prev]; u[idx] = { name: ev.fileName, size: ev.size }; return u; }
                    return [...prev, { name: ev.fileName, size: ev.size }];
                });
                addLog(`Ã°Å¸â€œâ€ž ${ev.fileName} (${formatBytes(ev.size)})`);
                break;
            case 'step_done':
                setBuildProgress(ev.progress);
                setSteps(prev => prev.map(s => s.index === ev.stepIndex ? { ...s, status: 'done' } : s));
                addLog(`Ã¢Å“â€¦ Done - Step ${ev.stepIndex + 1}`);
                break;
            case 'step_failed':
                setSteps(prev => prev.map(s => s.index === ev.stepIndex ? { ...s, status: 'failed', error: ev.error } : s));
                addLog(`Ã¢Å¡Â Ã¯Â¸Â Step ${ev.stepIndex + 1} failed: ${ev.error}`);
                break;
            case 'recovery': addLog(`Ã°Å¸â€Â ${ev.message}`); break;
            case 'chat_ack': addLog(`Ã°Å¸â€™Â¬ ${ev.message}`); break;
            case 'build_complete':
                setBuildProgress(100);
                setProjectDir(ev.projectDir);
                addLog(`Ã°Å¸Å½â€° Build complete! ${ev.totalSteps} steps in ${formatMs(ev.elapsedMs)}`);
                setTimeout(() => { setAppState('complete'); loadRecent(); }, 800);
                break;
            case 'build_failed':
                setErrorMessage(ev.error);
                setAppState('error');
                break;
        }
    };

    const addLog = (msg: string) => setBuildLog(prev => [...prev, msg]);

    const sendChatMessage = () => {
        if (!chatInput.trim()) return;
        const msg = chatInput.trim();
        setChatInput('');
        addLog(`Ã°Å¸â€™Â¬ You: ${msg}`);
        startBuilding(msg);
    };

    // Ã¢â€â‚¬Ã¢â€â‚¬ Iterate on existing project Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // Unlike startPlanning() which always creates a NEW project folder,
    // startIteration() passes the existing projectId so the builder
    // writes changes INTO the existing project directory.
    const startIteration = async (userPrompt: string) => {
        if (!userPrompt.trim() || !projectId) return;

        // Snapshot existing files before iteration so the user can roll back
        if (projectDir) {
            try {
                await fetch('/api/code/snapshot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, projectDir }),
                }).catch(() => {});
            } catch { /* non-fatal */ }
        }

        setPrompt(userPrompt);
        setAppState('planning');
        setPlanningMessages([]);
        setPlanningPhase('Analyzing your existing project...');
        setFinalPlan(null);

        try {
            const res = await fetch('/api/code/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: userPrompt,
                    projectId,          // Ã¢â€ Â reuse existing project, same folder
                    projectDir,         // Ã¢â€ Â pass dir so AI knows what already exists
                    isReplan: true,
                    iterationMode: true, // Ã¢â€ Â tells planner to modify, not create new
                }),
            });
            if (!res.body) throw new Error('No stream');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try { handlePlanEvent(JSON.parse(line.slice(6))); } catch { }
                }
            }
        } catch (err: any) {
            setErrorMessage(err?.message || 'Planning failed');
            setAppState('error');
        }
    };

    const openProjectFolder = async () => {
        if (projectDir) {
            await fetch('/api/system/open-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: projectDir }),
            }).catch(() => { });
        }
    };

    const downloadZip = () => {
        if (!projectId) return;
        window.open(`/api/code/project/${projectId}/zip`, '_blank');
    };

    const resetToWelcome = () => {
        setAppState('welcome');
        setPrompt('');
        setProjectId(null);
        setProjectName('');
        setPlanningMessages([]);
        setFinalPlan(null);
        setSteps([]);
        setBuildLog([]);
        setBuiltFiles([]);
        setErrorMessage('');
        setBuildProgress(0);
        loadRecent();
    };

    // Ã¢â€â‚¬Ã¢â€â‚¬ Render Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    return (
        <>
            {/* Inject keyframes once */}
            <style>{HANDSFREE_STUDIO_KEYFRAMES}</style>

            <div className="flex flex-col h-screen" style={{
                background: appState === 'welcome' ? 'transparent' : 'var(--background)',
                color: 'var(--text-primary)',
                position: 'relative',
            }}>

                {/* Ã¢â€â‚¬Ã¢â€â‚¬ Welcome State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
                {appState === 'welcome' && (
                    <div
                        className="flex-1 relative overflow-hidden"
                        style={{
                            opacity: leavingWelcome ? 0 : 1,
                            transform: leavingWelcome ? 'scale(0.97)' : 'scale(1)',
                            transition: 'opacity 0.28s ease, transform 0.28s ease',
                        }}
                    >
                        {/* Animated gradient background */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(-45deg, #0a0014, #0d1117, #020d1a, #04120c)',
                            backgroundSize: '400% 400%',
                            animation: 'gradientShift 15s ease infinite',
                        }} />
                        {/* Subtle grid overlay */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: 'linear-gradient(rgba(139,92,246,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.045) 1px, transparent 1px)',
                            backgroundSize: '48px 48px',
                            animation: 'gridPulse 5s ease-in-out infinite',
                            pointerEvents: 'none',
                        }} />
                        {/* Radial vignette to darken edges */}
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'radial-gradient(ellipse 70% 70% at 50% 40%, transparent 40%, rgba(0,0,0,0.55) 100%)',
                            pointerEvents: 'none',
                        }} />

                        {/* Scrollable content */}
                        <div
                            className="relative z-10 flex flex-col items-center justify-center min-h-full px-4 py-8 overflow-y-auto"
                            style={{ animation: 'handsFreeStudioFadeIn 0.5s ease-out both' }}
                        >
                            <WelcomeView
                                prompt={prompt}
                                setPrompt={setPrompt}
                                onStart={startPlanningFromWelcome}
                                onSelectProject={loadProject}
                                quickIdeas={QUICK_IDEAS}
                                surprises={surprises}
                                recentProjects={recentProjects}
                                promptRef={promptRef}
                                ftpProfileCount={ftpProfileCount}
                            />
                        </div>
                    </div>
                )}

                {/* Ã¢â€â‚¬Ã¢â€â‚¬ Planning State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
                {appState === 'planning' && (
                    <PlanningView
                        projectName={projectName}
                        prompt={prompt}
                        messages={planningMessages}
                        phase={planningPhase}
                        plan={finalPlan}
                        onConfirm={() => startBuilding()}
                        onModify={(feedback) => rePlanWithFeedback(feedback)}
                        onCancel={resetToWelcome}
                        scrollRef={planScrollRef}
                    />
                )}

                {/* Ã¢â€â‚¬Ã¢â€â‚¬ Building State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
                {appState === 'building' && (
                    <BuildingView
                        projectName={projectName}
                        projectId={projectId}
                        steps={steps}
                        currentStepIndex={currentStepIndex}
                        progress={buildProgress}
                        elapsedMs={elapsedMs}
                        buildLog={buildLog}
                        builtFiles={builtFiles}
                        chatInput={chatInput}
                        setChatInput={setChatInput}
                        onSendChat={sendChatMessage}
                        onStop={resetToWelcome}
                        buildLogRef={buildLogRef}
                    />
                )}

                {/* Ã¢â€â‚¬Ã¢â€â‚¬ Complete State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
                {appState === 'complete' && (
                    <CompleteView
                        projectName={projectName}
                        projectId={projectId}
                        steps={steps}
                        elapsedMs={elapsedMs}
                        builtFiles={builtFiles}
                        iteratePrompt={iteratePrompt}
                        setIteratePrompt={setIteratePrompt}
                        onOpenFolder={openProjectFolder}
                        onDownload={downloadZip}
                        onIterate={(p) => { startIteration(p); }}
                        onNew={resetToWelcome}
                    />
                )}

                {/* Ã¢â€â‚¬Ã¢â€â‚¬ Error State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
                {appState === 'error' && (
                    <div className="flex-1 flex flex-col items-center justify-center px-4">
                        <div className="text-5xl mb-4">Ã°Å¸ËœÅ¾</div>
                        <h2 className="text-lg font-bold mb-2">{t('code.error')}</h2>
                        <p className="text-sm mb-6 text-center max-w-md" style={{ color: 'var(--text-secondary)' }}>{errorMessage}</p>
                        <button onClick={resetToWelcome}
                            className="px-6 py-3 rounded-xl font-bold text-sm"
                            style={{ background: 'rgba(132,204,22,0.15)', color: '#84cc16', border: '1px solid rgba(132,204,22,0.3)' }}>
                            Ã¢â€ Â Back to Start
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Welcome View Ã¢â‚¬â€ Premium Dark
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function WelcomeView({ prompt, setPrompt, onStart, onSelectProject, quickIdeas, surprises, recentProjects, promptRef, ftpProfileCount = 0 }: {
    prompt: string;
    setPrompt: (p: string) => void;
    onStart: (p?: string) => void;
    onSelectProject: (p: HandsFreeStudioProject) => void;
    quickIdeas: typeof QUICK_IDEAS;
    surprises: string[];
    recentProjects: HandsFreeStudioProject[];
    promptRef: React.RefObject<HTMLTextAreaElement>;
    ftpProfileCount?: number;
}) {
    const { t } = useTranslation();
    return (
        <div className="w-full max-w-2xl space-y-8">

            {/* Ã¢â€â‚¬Ã¢â€â‚¬ Header Ã¢â€â‚¬Ã¢â€â‚¬ */}
            <div className="text-center">
                <div className="inline-block text-7xl mb-5 select-none"
                    style={{ animation: 'lionGlow 3.5s ease-in-out infinite' }}>
                    Ã°Å¸Â¦Â
                </div>
                <h1 className="text-4xl font-black mb-3 leading-tight" style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #7dd3fc 45%, #a5f3fc 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 0 30px rgba(125,211,252,0.18))',
                }}>
                    {t('code.title')}
                </h1>
                <p className="text-sm" style={{ color: 'rgba(148,163,184,0.75)' }}>
                    {t('code.subtitle')}
                </p>
            </div>

            {/* Ã¢â€â‚¬Ã¢â€â‚¬ Input - Glass morphism Ã¢â€â‚¬Ã¢â€â‚¬ */}
            <div className="relative">
                <textarea
                    ref={promptRef}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onStart(); } }}
                    placeholder={t('code.placeholder')}
                    rows={3}
                    className="w-full p-4 pr-16 rounded-2xl resize-none outline-none text-sm"
                    style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        color: 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(20px)',
                        transition: 'border 0.2s, box-shadow 0.2s',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                    onFocus={e => {
                        e.currentTarget.style.border = '1px solid rgba(139,92,246,0.65)';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.12), 0 0 30px rgba(139,92,246,0.07), inset 0 1px 0 rgba(255,255,255,0.05)';
                    }}
                    onBlur={e => {
                        e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)';
                        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
                    }}
                />
                <button
                    onClick={() => onStart()}
                    disabled={!prompt.trim()}
                    className="absolute right-3 bottom-3 w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-25 transition-all"
                    style={{
                        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                        boxShadow: prompt.trim() ? '0 0 18px rgba(139,92,246,0.45)' : 'none',
                        transition: 'box-shadow 0.2s',
                    }}
                    onMouseEnter={e => { if (prompt.trim()) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 28px rgba(139,92,246,0.7), 0 0 50px rgba(99,102,241,0.25)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = prompt.trim() ? '0 0 18px rgba(139,92,246,0.45)' : 'none'; }}
                >
                    <Icon icon={Send} size={16} className="text-white" />
                </button>
            </div>

            {/* Ã¢â€â‚¬Ã¢â€â‚¬ Quick Ideas Ã¢â€â‚¬Ã¢â€â‚¬ */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(100,116,139,0.8)' }}>
                    {t('code.quickIdeas')}
                </p>
                <div className="flex flex-wrap gap-2">
                    {quickIdeas.map(idea => (
                        <button
                            key={idea.id}
                            onClick={() => { setPrompt(idea.prompt); onStart(idea.prompt); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: 'rgba(203,213,225,0.8)',
                                backdropFilter: 'blur(10px)',
                                transition: 'all 0.18s ease',
                            }}
                            onMouseEnter={e => {
                                const el = e.currentTarget as HTMLElement;
                                el.style.background = 'rgba(139,92,246,0.12)';
                                el.style.border = '1px solid rgba(139,92,246,0.32)';
                                el.style.boxShadow = '0 0 12px rgba(139,92,246,0.12)';
                                el.style.color = 'rgba(216,180,254,0.9)';
                                el.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={e => {
                                const el = e.currentTarget as HTMLElement;
                                el.style.background = 'rgba(255,255,255,0.04)';
                                el.style.border = '1px solid rgba(255,255,255,0.08)';
                                el.style.boxShadow = 'none';
                                el.style.color = 'rgba(203,213,225,0.8)';
                                el.style.transform = 'translateY(0)';
                            }}
                        >
                            <span>{idea.emoji}</span>
                            <span>{t(idea.labelKey as any)}</span>
                        </button>
                    ))}
                    {/* Random Surprise */}
                    <button
                        onClick={() => {
                            const r = surprises[Math.floor(Math.random() * surprises.length)];
                            if (!r) return;
                            setPrompt(r);
                            onStart(r);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                        style={{
                            background: 'rgba(139,92,246,0.1)',
                            border: '1px solid rgba(139,92,246,0.28)',
                            color: '#c4b5fd',
                            backdropFilter: 'blur(10px)',
                            transition: 'all 0.18s ease',
                        }}
                        onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.background = 'rgba(139,92,246,0.2)';
                            el.style.boxShadow = '0 0 18px rgba(139,92,246,0.25)';
                            el.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.background = 'rgba(139,92,246,0.1)';
                            el.style.boxShadow = 'none';
                            el.style.transform = 'translateY(0)';
                        }}
                    >
                        <span>Ã°Å¸Å½Â²</span>
                        <span>{t('code.random')}</span>
                    </button>
                </div>
            </div>

            {/* Ã¢â€â‚¬Ã¢â€â‚¬ Recent Projects Ã¢â€â‚¬Ã¢â€â‚¬ */}
            {recentProjects.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(100,116,139,0.8)' }}>
                        {t('code.recentProjects')}
                    </p>
                    <div className="space-y-1.5">
                        {recentProjects.slice(0, 4).map(p => (
                            <button
                                key={p.id}
                                onClick={() => onSelectProject(p)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer text-left"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    backdropFilter: 'blur(10px)',
                                    transition: 'all 0.18s ease',
                                }}
                                onMouseEnter={e => {
                                    const el = e.currentTarget as HTMLElement;
                                    el.style.background = 'rgba(139,92,246,0.08)';
                                    el.style.border = '1px solid rgba(139,92,246,0.22)';
                                    el.style.transform = 'translateY(-1px)';
                                    el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)';
                                }}
                                onMouseLeave={e => {
                                    const el = e.currentTarget as HTMLElement;
                                    el.style.background = 'rgba(255,255,255,0.03)';
                                    el.style.border = '1px solid rgba(255,255,255,0.06)';
                                    el.style.transform = 'translateY(0)';
                                    el.style.boxShadow = 'none';
                                }}
                            >
                                <span className="text-lg flex-shrink-0">
                                    {p.status === 'complete' ? 'Ã¢Å“â€¦' : p.status === 'failed' ? 'Ã¢ÂÅ’' : 'Ã¢ÂÂ¸Ã¯Â¸Â'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{p.name}</p>
                                    <p className="text-[10px]" style={{ color: 'rgba(100,116,139,0.75)' }}>
                                        {p.currentStep}/{p.totalSteps || p.steps.length} steps Ã‚Â· {p.status}
                                    </p>
                                </div>
                                {p.status !== 'complete' ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                                        style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}>
                                        {t('code.resume')}
                                    </span>
                                ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                                        style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                                        {t('code.view')}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* FTP deploy hint */}
            {ftpProfileCount > 0 && (
                <p className="text-xs text-center mt-2" style={{ color: 'rgba(100,116,139,0.5)' }}>
                    {t('code.ftpHint', { count: String(ftpProfileCount) })}
                </p>
            )}
        </div>
    );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Planning View
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function PlanningView({ projectName, prompt, messages, phase, plan, onConfirm, onModify, onCancel, scrollRef }: {
    projectName: string; prompt: string; messages: PlanningMessage[]; phase: string;
    plan: HandsFreeStudioPlan | null; onConfirm: () => void; onModify: (p: string) => void;
    onCancel: () => void; scrollRef: React.RefObject<HTMLDivElement>;
}) {
    const { t } = useTranslation();
    const [modifyInput, setModifyInput] = useState('');
    const [showModify, setShowModify] = useState(false);

    return (
        <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.15))', border: '1px solid rgba(139,92,246,0.3)' }}>
                    Ã°Å¸Â¦Â
                </div>
                <div>
                    <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {t('code.planning.title')} &ldquo;{projectName}&rdquo;
                    </h2>
                    <p className="text-xs truncate max-w-md" style={{ color: 'var(--text-muted)' }}>{prompt}</p>
                </div>
                <button onClick={onCancel} className="ml-auto text-xs px-2 py-1 rounded-lg hover:bg-[var(--surface-light)]" style={{ color: 'var(--text-muted)' }}>
                    {t('code.planning.cancel')}
                </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                {messages.map((msg, i) => (
                    <div key={i} className={`rounded-xl p-3 text-xs leading-relaxed ${msg.role === 'system' ? 'text-center' : ''}`}
                        style={{
                            background: msg.role === 'system' ? 'transparent' : msg.role === 'architect' ? 'rgba(59,130,246,0.08)' : 'rgba(249,115,22,0.08)',
                            border: msg.role === 'system' ? 'none' : msg.role === 'architect' ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(249,115,22,0.2)',
                            color: msg.role === 'system' ? 'var(--text-muted)' : 'var(--text-secondary)',
                        }}>
                        {msg.role !== 'system' && (
                            <p className="font-bold text-[10px] uppercase tracking-wider mb-1.5"
                                style={{ color: msg.role === 'architect' ? '#60a5fa' : '#fb923c' }}>
                                {msg.role === 'architect' ? `Ã°Å¸Ââ€”Ã¯Â¸Â ${t('code.planning.architect')}` : `Ã°Å¸â€Â ${t('code.planning.reviewer')}`}
                            </p>
                        )}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                ))}
                {phase && !plan && (
                    <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
                        style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)', color: 'var(--text-muted)' }}>
                        <Icon icon={Loader2} size={12} className="animate-spin flex-shrink-0" style={{ color: '#a78bfa' }} />
                        {phase}
                    </div>
                )}
            </div>

            {plan && (
                <div className="flex-shrink-0 rounded-2xl p-4 mb-4"
                    style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(99,102,241,0.05))', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 20px rgba(139,92,246,0.1)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#a78bfa' }}>Ã°Å¸â€œâ€¹ {t('code.planning.finalPlan')}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-3">
                        {[
                            { label: t('code.planning.tech'), value: plan.techStack },
                            { label: t('code.planning.files'), value: `${plan.files.length} ${t('code.planning.files').toLowerCase()}` },
                            { label: t('code.planning.steps'), value: `${plan.steps.length} ${t('code.planning.steps').toLowerCase()}` },
                            { label: t('code.planning.time'), value: plan.timeEstimate },
                            { label: t('code.planning.cost'), value: plan.costEstimate },
                            { label: t('code.planning.complexity'), value: plan.complexity },
                        ].map(item => (
                            <div key={item.label} className="p-2 rounded-lg" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                                <p className="text-[9px] uppercase tracking-wider font-bold mb-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white' }}>
                            Ã¢Å“â€¦ {t('code.planning.letsBuild')}
                        </button>
                        <button onClick={() => setShowModify(v => !v)} className="px-4 py-2.5 rounded-xl text-sm font-bold"
                            style={{ background: 'var(--surface-light)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                            Ã¢Å“ÂÃ¯Â¸Â {t('code.planning.modify')}
                        </button>
                        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-bold"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                            Ã¢Å“â€¢
                        </button>
                    </div>
                    {showModify && (
                        <div className="flex gap-2 mt-2">
                            <input type="text" value={modifyInput} onChange={e => setModifyInput(e.target.value)}
                                placeholder={t('code.planning.modifyPlaceholder')}
                                className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                onKeyDown={e => { if (e.key === 'Enter' && modifyInput.trim()) onModify(modifyInput.trim()); }} />
                            <button onClick={() => modifyInput.trim() && onModify(modifyInput.trim())}
                                className="px-3 py-2 rounded-lg text-xs font-bold"
                                style={{ background: 'rgba(139,92,246,0.2)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                                {t('code.planning.replan')}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Building View
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function BuildingView({ projectName, projectId, steps, currentStepIndex, progress, elapsedMs, buildLog, builtFiles, chatInput, setChatInput, onSendChat, onStop, buildLogRef }: {
    projectName: string; projectId: string | null; steps: BuildStep[]; currentStepIndex: number;
    progress: number; elapsedMs: number; buildLog: string[]; builtFiles: { name: string; size: number }[];
    chatInput: string; setChatInput: (v: string) => void; onSendChat: () => void; onStop: () => void;
    buildLogRef: React.RefObject<HTMLDivElement>;
}) {
    const { t } = useTranslation();
    const htmlFiles = builtFiles.filter(f => f.name.endsWith('.html'));
    const [selectedPreview, setSelectedPreview] = useState<string>('index.html');

    // Auto-select first available HTML file
    const activePreview = htmlFiles.some(f => f.name === selectedPreview) ? selectedPreview
        : htmlFiles[0]?.name || 'index.html';
    const hasPreview = htmlFiles.length > 0 && projectId;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-lg">Ã°Å¸Â¦Â</span>
                <p className="flex-1 text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{t('code.building.header')} &ldquo;{projectName}&rdquo;</p>
                <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>Ã¢ÂÂ±Ã¯Â¸Â {formatMs(elapsedMs)}</span>
                <button onClick={onStop} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400" title="Stop">
                    <Icon icon={Square} size={14} />
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left */}
                <div className="flex flex-col w-1/2 border-r overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex-shrink-0 max-h-48 overflow-y-auto p-3 border-b" style={{ borderColor: 'var(--border)' }}>
                        {steps.map(step => (
                            <div key={step.index} className="flex items-center gap-2 py-1 text-xs">
                                <span className="w-4 text-center flex-shrink-0">
                                    {step.status === 'done' ? 'Ã¢Å“â€¦' : step.status === 'running' ? <Icon icon={Loader2} size={12} className="animate-spin text-purple-400" /> : step.status === 'failed' ? 'Ã¢Å¡Â Ã¯Â¸Â' : 'Ã¢ÂÂ³'}
                                </span>
                                <span className={`truncate ${step.status === 'running' ? 'font-semibold' : ''}`}
                                    style={{ color: step.status === 'done' ? '#4ade80' : step.status === 'running' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    {step.index + 1}. {step.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="px-3 py-2 flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                            {t('code.building.progress' as any, { percent: progress, current: Math.min(currentStepIndex + 1, steps.length), total: steps.length })}
                        </span>
                        <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: 'var(--surface-light)' }}>
                            <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #8b5cf6, #6366f1)' }} />
                        </div>
                    </div>
                    <div ref={buildLogRef} className="flex-1 overflow-y-auto p-3 font-mono text-[10px] space-y-0.5" style={{ color: 'var(--text-muted)' }}>
                        {buildLog.map((line, i) => <p key={i} className="leading-relaxed">{line}</p>)}
                    </div>
                    <div className="flex-shrink-0 p-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Ã°Å¸â€™Â¬ {t('code.building.chatLabel')}</p>
                        <div className="flex gap-2">
                            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                                placeholder={t('code.building.chatPlaceholder')}
                                className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                                onKeyDown={e => { if (e.key === 'Enter') onSendChat(); }} />
                            <button onClick={onSendChat} className="px-2.5 py-1.5 rounded-lg text-xs font-bold"
                                style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}>
                                <Icon icon={Send} size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Live Preview */}
                <div className="flex flex-col w-1/2 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-1 overflow-x-auto flex-1 mr-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mr-1" style={{ color: 'var(--text-muted)' }}>{t('code.preview')}</span>
                            {htmlFiles.map(f => (
                                <button key={f.name} onClick={() => setSelectedPreview(f.name)}
                                    className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded font-medium transition-all"
                                    style={{
                                        background: activePreview === f.name ? 'rgba(139,92,246,0.2)' : 'var(--surface-light)',
                                        color: activePreview === f.name ? '#a78bfa' : 'var(--text-muted)',
                                        border: activePreview === f.name ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
                                    }}>
                                    {f.name}
                                </button>
                            ))}
                        </div>
                        {hasPreview && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse flex-shrink-0"
                                style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>Ã¢â€”Â {t('code.building.live')}</span>
                        )}
                    </div>
                    {hasPreview ? (
                        <iframe key={`${projectId}-${activePreview}`} src={`/api/code/preview/${projectId}/${activePreview}`}
                            className="flex-1 w-full border-0" sandbox="allow-scripts allow-same-origin" title="Live Preview" />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-6" style={{ background: 'var(--surface)' }}>
                            <Icon icon={Loader2} size={24} className="animate-spin mb-3" style={{ color: '#8b5cf6' }} />
                            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{t('code.previewEmpty')}</p>
                        </div>
                    )}
                </div>
            </div>

            {builtFiles.length > 0 && (
                <div className="flex-shrink-0 px-4 py-2 border-t flex items-center gap-3 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Ã°Å¸â€œÂ</span>
                    {builtFiles.map(f => (
                        <span key={f.name} className="text-[10px] flex-shrink-0 px-2 py-0.5 rounded"
                            style={{ background: 'var(--surface-light)', color: 'var(--text-secondary)' }}>
                            {f.name}{f.size > 0 ? ` (${formatBytes(f.size)})` : ''}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Complete View
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function CompleteView({ projectName, projectId, steps, elapsedMs, builtFiles, iteratePrompt, setIteratePrompt, onOpenFolder, onDownload, onIterate, onNew }: {
    projectName: string; projectId: string | null; steps: BuildStep[]; elapsedMs: number;
    builtFiles: { name: string; size: number }[]; iteratePrompt: string; setIteratePrompt: (v: string) => void;
    onOpenFolder: () => void; onDownload: () => void; onIterate: (p: string) => void; onNew: () => void;
}) {
    const { t } = useTranslation();
    const doneCount = steps.filter(s => s.status === 'done').length;
    const htmlFiles = builtFiles.filter(f => f.name.endsWith('.html'));
    const [selectedPreview, setSelectedPreview] = useState<string>('index.html');
    const activePreview = htmlFiles.some(f => f.name === selectedPreview) ? selectedPreview : htmlFiles[0]?.name || 'index.html';
    const hasPreview = htmlFiles.length > 0 && projectId;

    // Deploy state
    const [showDeploy, setShowDeploy] = useState(false);
    const [deployConfigured, setDeployConfigured] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [deployResult, setDeployResult] = useState<{ success: boolean; filesUploaded?: number; incremental?: boolean; error?: string; errors?: string[] } | null>(null);
    const [deployHost, setDeployHost] = useState('');
    const [deployPort, setDeployPort] = useState('21');
    const [deployUser, setDeployUser] = useState('');
    const [deployPass, setDeployPass] = useState('');
    const [deployRemotePath, setDeployRemotePath] = useState('/');
    const [deployProtocol, setDeployProtocol] = useState('ftp');
    const [testResult, setTestResult] = useState('');
    const [centralFtpProfiles, setCentralFtpProfiles] = useState<Array<{ id: string; alias: string; host: string; port: number; username: string; password: string; protocol: string; remotePath: string }>>([]);

    // Check if deploy config exists on mount
    useEffect(() => {
        if (projectId) {
            fetch(`/api/code/project/${projectId}/deploy-config`)
                .then(r => r.json())
                .then(data => {
                    if (data.configured) {
                        setDeployConfigured(true);
                        setDeployHost(data.host || '');
                        setDeployPort(String(data.port || 21));
                        setDeployUser(data.username || '');
                        setDeployRemotePath(data.remotePath || '/');
                        setDeployProtocol(data.protocol || 'ftp');
                    }
                })
                .catch(() => {});
            // Also load central FTP profiles
            fetch('/api/ftp/profiles').then(r => r.json()).then(data => {
                if (data.profiles) setCentralFtpProfiles(data.profiles);
            }).catch(() => {});
        }
    }, [projectId]);

    const loadFromCentralProfile = (profileId: string) => {
        const p = centralFtpProfiles.find(pr => pr.id === profileId);
        if (!p) return;
        setDeployHost(p.host);
        setDeployPort(String(p.port || 21));
        setDeployUser(p.username);
        setDeployPass(p.password === '******' ? '' : p.password);
        setDeployRemotePath(p.remotePath || '/');
        setDeployProtocol(p.protocol || 'ftp');
    };

    const saveDeployConfig = async () => {
        if (!projectId) return;
        const res = await fetch(`/api/code/project/${projectId}/deploy-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                host: deployHost, port: parseInt(deployPort), username: deployUser,
                password: deployPass, remotePath: deployRemotePath, protocol: deployProtocol,
            }),
        });
        if (res.ok) setDeployConfigured(true);
    };

    const testConnection = async () => {
        if (!projectId) return;
        setTestResult(t('ftp.testing'));
        try {
            const res = await fetch(`/api/code/project/${projectId}/deploy-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: deployHost, port: parseInt(deployPort), username: deployUser,
                    password: deployPass, remotePath: deployRemotePath, protocol: deployProtocol,
                }),
            });
            const data = await res.json();
            setTestResult(data.success ? `Ã¢Å“â€¦ ${data.message}` : `Ã¢ÂÅ’ ${data.error}`);
        } catch (e: any) {
            setTestResult(`Ã¢ÂÅ’ ${e.message}`);
        }
    };

    const deployProject = async () => {
        if (!projectId) return;
        setDeploying(true);
        setDeployResult(null);
        try {
            const res = await fetch(`/api/code/project/${projectId}/deploy`, { method: 'POST' });
            const data = await res.json();
            setDeployResult(data.success ? data : { success: false, error: data.error });
        } catch (e: any) {
            setDeployResult({ success: false, error: e.message });
        } finally {
            setDeploying(false);
        }
    };

    return (
        <div className="flex-1 flex overflow-hidden">
            {/* Left: summary */}
            <div className="flex flex-col items-center justify-center px-6 py-8 text-center w-1/2 border-r overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                <div className="text-6xl mb-2 animate-bounce-slow">Ã°Å¸Â¦Â</div>
                <div className="text-4xl mb-4">Ã¢Å“â€¦</div>
                <h2 className="text-2xl font-black mb-1" style={{ color: 'var(--text-primary)' }}>{t('code.projectComplete')}</h2>
                <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>&ldquo;{projectName}&rdquo; - {doneCount}/{steps.length} steps</p>
                <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                    {elapsedMs > 0 ? t('code.complete.builtIn' as any, { time: formatMs(elapsedMs) }) : t('code.complete.buildComplete')}
                    {builtFiles.length > 0 && ` Ã‚Â· ${builtFiles.length} ${t('code.complete.filesLabel')}`}
                </p>
                <div className="flex flex-wrap gap-3 justify-center mb-4">
                    <button onClick={onOpenFolder} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                        style={{ background: 'rgba(132,204,22,0.15)', color: '#84cc16', border: '1px solid rgba(132,204,22,0.3)' }}>
                        <Icon icon={FolderOpen} size={15} /> {t('code.complete.openFolder')}
                    </button>
                    <button onClick={onDownload} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                        style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        <Icon icon={Download} size={15} /> {t('code.complete.downloadZip')}
                    </button>
                    <button onClick={() => setShowDeploy(!showDeploy)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                        style={{ background: showDeploy ? 'rgba(244,114,182,0.15)' : 'rgba(244,114,182,0.08)', color: '#f472b6', border: `1px solid ${showDeploy ? 'rgba(244,114,182,0.4)' : 'rgba(244,114,182,0.2)'}` }}>
                        Ã°Å¸Å¡â‚¬ {t('code.complete.deploy')}
                    </button>
                </div>

                {/* Deploy panel */}
                {showDeploy && (
                    <div className="w-full max-w-sm mb-4 p-4 rounded-xl animate-fadeIn text-left" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <h3 className="text-xs font-bold flex items-center gap-2 mb-3" style={{ color: 'var(--text-primary)' }}>
                            Ã°Å¸Å¡â‚¬ {t('ftp.title')}
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-lime-500/20 text-lime-400 font-bold">BETA</span>
                        </h3>
                        {!deployConfigured ? (
                            <div className="space-y-2">
                                {centralFtpProfiles.length > 0 && (
                                    <select
                                        defaultValue=""
                                        onChange={e => { if (e.target.value) loadFromCentralProfile(e.target.value); }}
                                        className="w-full px-2.5 py-1.5 rounded-lg text-xs mb-1"
                                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}
                                    >
                                        <option value="">{t('ftp.loadFromProfile')}</option>
                                        {centralFtpProfiles.map(p => (
                                            <option key={p.id} value={p.id}>{p.alias || p.host} ({p.protocol.toUpperCase()})</option>
                                        ))}
                                    </select>
                                )}
                                <select value={deployProtocol} onChange={e => setDeployProtocol(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                                    <option value="ftp">FTP</option>
                                    <option value="sftp">SFTP</option>
                                </select>
                                <input placeholder={t('ftp.host')} value={deployHost} onChange={e => setDeployHost(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input placeholder={t('ftp.port')} type="number" value={deployPort} onChange={e => setDeployPort(e.target.value)}
                                        className="px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                                    <input placeholder={t('ftp.username')} value={deployUser} onChange={e => setDeployUser(e.target.value)}
                                        className="px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                                </div>
                                <input placeholder={t('ftp.password')} type="password" value={deployPass} onChange={e => setDeployPass(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                                <input placeholder={t('ftp.remotePath')} value={deployRemotePath} onChange={e => setDeployRemotePath(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                                <div className="flex gap-2 pt-1">
                                    <button onClick={testConnection} className="flex-1 py-1.5 text-xs font-bold rounded-lg" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                        {t('ftp.testConnection')}
                                    </button>
                                    <button onClick={saveDeployConfig} className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-lime-500 hover:bg-lime-400 text-black">
                                        {t('ftp.save')}
                                    </button>
                                </div>
                                {testResult && <p className="text-[10px]" style={{ color: testResult.startsWith('Ã¢Å“â€¦') ? '#4ade80' : testResult.startsWith('Ã¢ÂÅ’') ? '#f87171' : 'var(--text-muted)' }}>{testResult}</p>}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    {deployProtocol}://{deployHost}:{deployPort}{deployRemotePath}
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={deployProject} disabled={deploying}
                                        className="flex-1 py-2 text-xs font-bold rounded-lg disabled:opacity-50 transition-all"
                                        style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: 'white' }}>
                                        {deploying ? t('ftp.uploading') : `Ã°Å¸Å¡â‚¬ ${t('code.complete.deployNow')}`}
                                    </button>
                                    <button onClick={() => setDeployConfigured(false)} className="px-3 py-2 text-xs font-bold rounded-lg"
                                        style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                        {t('code.complete.edit')}
                                    </button>
                                </div>
                                {deployResult && (
                                    <p className="text-[10px]" style={{ color: deployResult.success ? '#4ade80' : '#f87171' }}>
                                        {deployResult.success
                                            ? `Ã¢Å“â€¦ ${deployResult.filesUploaded} ${t('ftp.filesUploaded')}${deployResult.incremental ? ` ${t('code.complete.incremental')}` : ''}`
                                            : `Ã¢ÂÅ’ ${deployResult.error}`}
                                    </p>
                                )}
                                {/* incremental note is rendered inside the success string above */}
                                {deployResult?.errors && deployResult.errors.length > 0 && (
                                    <div className="text-[10px] text-red-400 space-y-0.5">
                                        {deployResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="w-full max-w-sm mb-4">
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Ã¢Å“ÂÃ¯Â¸Â {t('code.complete.requestChanges')}</p>
                    <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>{t('code.complete.requestChangesDesc')}</p>
                    <div className="flex gap-2">
                        <input type="text" value={iteratePrompt} onChange={e => setIteratePrompt(e.target.value)}
                            placeholder={t('code.complete.iteratePlaceholder')}
                            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                            onKeyDown={e => { if (e.key === 'Enter' && iteratePrompt.trim()) onIterate(iteratePrompt.trim()); }} />
                        <button onClick={() => iteratePrompt.trim() && onIterate(iteratePrompt.trim())}
                            disabled={!iteratePrompt.trim()}
                            className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-30"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white' }}>
                            {t('code.complete.apply')}
                        </button>
                    </div>
                </div>
                <button onClick={onNew} className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Ã°Å¸â€ â€¢ {t('code.complete.newProject')}</button>
            </div>
            {/* Right: preview */}
            <div className="flex flex-col w-1/2 overflow-hidden">
                <div className="flex items-center gap-1 px-3 py-2 flex-shrink-0 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mr-1" style={{ color: 'var(--text-muted)' }}>{t('code.preview')}</span>
                    {htmlFiles.map(f => (
                        <button key={f.name} onClick={() => setSelectedPreview(f.name)}
                            className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded font-medium transition-all"
                            style={{
                                background: activePreview === f.name ? 'rgba(139,92,246,0.2)' : 'var(--surface-light)',
                                color: activePreview === f.name ? '#a78bfa' : 'var(--text-muted)',
                                border: activePreview === f.name ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
                            }}>
                            {f.name}
                        </button>
                    ))}
                </div>
                {hasPreview ? (
                    <iframe key={`${projectId}-${activePreview}`} src={`/api/code/preview/${projectId}/${activePreview}`}
                        className="flex-1 w-full border-0" sandbox="allow-scripts allow-same-origin" title="Project Preview" />
                ) : (
                    <div className="flex-1 flex items-center justify-center p-6" style={{ background: 'var(--surface)' }}>
                        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{t('code.noHtmlPreview')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Utilities Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
}
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(1)}KB`;
}
