'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home, MessageCircle, ListTodo, Brain, Clock,
    BarChart3, Settings, FileText, ChevronLeft, ChevronRight,
    Plus, BookOpen, CalendarDays, Users,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// ─── Static nav items (always visible) ───────────────────────

const NAV_ITEMS = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/chat', label: 'Chat', icon: MessageCircle },
    { href: '/calendar', label: 'Calendar', icon: CalendarDays },
    { href: '/sessions', label: 'Sessions', icon: Clock },
    { href: '/tasks', label: 'Tasks', icon: ListTodo },
    { href: '/memory', label: 'Memory', icon: Brain },
    { href: '/usage', label: 'Usage', icon: BarChart3 },
    { href: '/logs', label: 'Logs', icon: FileText },
];

// ─── Skill-gated nav items ────────────────────────────────────
// Add entries here as new skill-based pages are implemented.
// Each entry is shown only when `skillId` is enabled in skills.json.
// This list is the single source of truth — no other changes needed
// to show/hide future skill nav items.

const SKILL_NAV_ITEMS = [
    { skillId: 'group_chat', href: '/group-chat', label: 'Group Chat', icon: Users },
] as const;

// ─── Component ───────────────────────────────────────────────

export default function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [activeSkills, setActiveSkills] = useState<Set<string>>(new Set());

    const fetchActiveSkills = () => {
        fetch('/api/skills/active')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data.skills)) {
                    setActiveSkills(new Set(data.skills));
                }
            })
            .catch(() => { /* silently ignore — skill items just won't show */ });
    };

    // Fetch on mount and on every route change.
    useEffect(() => {
        fetchActiveSkills();
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-fetch when skills are toggled — two signals cover all cases:
    // 1. CustomEvent 'skalesSkillsChanged' — same tab (settings page → sidebar in same window)
    // 2. StorageEvent 'skalesSkillsChanged' — other tabs (multi-window setups)
    // window.storage events do NOT fire in the same tab that set the value,
    // so the CustomEvent is mandatory for same-tab updates.
    useEffect(() => {
        const onCustomEvent = () => fetchActiveSkills();
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'skalesSkillsChanged') fetchActiveSkills();
        };
        window.addEventListener('skalesSkillsChanged', onCustomEvent);
        window.addEventListener('storage', onStorage);
        window.addEventListener('focus', onCustomEvent);
        return () => {
            window.removeEventListener('skalesSkillsChanged', onCustomEvent);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('focus', onCustomEvent);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Merge static + active skill nav items
    const visibleSkillItems = SKILL_NAV_ITEMS.filter(item => activeSkills.has(item.skillId));

    const navLink = (href: string, label: string, Icon: React.ElementType) => {
        const isActive = href === '/'
            ? pathname === href
            : pathname === href || pathname.startsWith(href + '/');
        return (
            <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${collapsed ? 'justify-center' : ''} ${isActive
                    ? 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border border-lime-500/20'
                    : 'text-text-secondary hover:text-foreground hover:bg-surface-light border border-transparent'
                    }`}
                title={collapsed ? label : undefined}
            >
                <Icon size={20} className={`shrink-0 ${isActive ? 'text-lime-500' : 'group-hover:text-foreground'}`} />
                {!collapsed && <span>{label}</span>}
            </Link>
        );
    };

    return (
        <aside className={`h-screen sticky top-0 flex flex-col bg-surface border-r border-border transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[220px]'}`}>
            {/* Logo */}
            <div className="h-16 flex items-center gap-3 px-4 border-b border-border shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-lime-500 to-green-600 flex items-center justify-center text-lg shrink-0 shadow-lg shadow-lime-500/20">
                    🦎
                </div>
                {!collapsed && (
                    <span className="text-lg font-bold bg-gradient-to-r from-lime-500 to-green-600 bg-clip-text text-transparent">
                        Skales
                    </span>
                )}
            </div>

            {/* New Chat Button */}
            <div className="px-3 pt-4 pb-2">
                <Link
                    href="/chat?new=1"
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-lime-500 hover:bg-lime-400 text-black font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-lime-500/20 ${collapsed ? 'justify-center' : ''}`}
                >
                    <Plus size={18} />
                    {!collapsed && <span>New Chat</span>}
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
                {/* Static items */}
                {NAV_ITEMS.map(item => navLink(item.href, item.label, item.icon))}

                {/* Skill-gated items — rendered only when the skill is enabled */}
                {visibleSkillItems.length > 0 && (
                    <>
                        {!collapsed && (
                            <div className="pt-2 pb-1 px-3">
                                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    Skills
                                </span>
                            </div>
                        )}
                        {visibleSkillItems.map(item => navLink(item.href, item.label, item.icon))}
                    </>
                )}
            </nav>

            {/* Settings + Collapse */}
            <div className="px-3 py-3 border-t border-border space-y-1">
                <a
                    href="https://docs.skales.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-foreground hover:bg-surface-light transition-all border border-transparent ${collapsed ? 'justify-center' : ''}`}
                    title={collapsed ? 'Docs' : undefined}
                >
                    <BookOpen size={20} />
                    {!collapsed && <span>Docs</span>}
                </a>
                <Link
                    href="/settings"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-foreground hover:bg-surface-light transition-all ${collapsed ? 'justify-center' : ''} ${pathname === '/settings' ? 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border border-lime-500/20' : 'border border-transparent'}`}
                    title={collapsed ? 'Settings' : undefined}
                >
                    <Settings size={20} />
                    {!collapsed && <span>Settings</span>}
                </Link>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-text-secondary hover:text-foreground hover:bg-surface-light transition-all w-full ${collapsed ? 'justify-center' : ''}`}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    {!collapsed && <span className="text-xs">Collapse</span>}
                </button>
            </div>
        </aside>
    );
}
