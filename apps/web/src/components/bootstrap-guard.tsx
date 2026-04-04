'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isFirstRun } from '@/actions/identity';

export default function BootstrapGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setMounted(true);

        if (pathname === '/bootstrap') {
            setLoading(false);
            return;
        }

        // Timeout: if server action hangs >4s, unblock the UI anyway
        const timeout = setTimeout(() => setLoading(false), 4000);

        isFirstRun().then(firstRun => {
            clearTimeout(timeout);
            // Always clear loading BEFORE navigating so spinner doesn't persist
            setLoading(false);
            if (firstRun) {
                router.push('/bootstrap');
            }
        }).catch(() => {
            clearTimeout(timeout);
            setLoading(false);
        });

        return () => clearTimeout(timeout);
    }, [pathname, router]);

    if (!mounted || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-lime-400 to-green-600 flex items-center justify-center text-3xl shadow-lg shadow-lime-500/20 animate-pulse">
                        🦎
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading Hands Free...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
