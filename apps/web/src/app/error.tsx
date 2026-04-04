'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[Hands Free] Page error:', error);
    }, [error]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background, #0f0f0f)',
            color: 'var(--text-primary, #fff)',
            padding: '24px',
            textAlign: 'center',
            gap: '16px',
        }}>
            <div style={{ fontSize: '48px' }}>ðŸ¦Ž</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Oops - something crashed
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #888)', margin: 0, maxWidth: '320px' }}>
                {error?.message && error.message !== 'An error occurred in the Server Components render.'
                    ? error.message
                    : 'An unexpected error occurred. Try reloading the page.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                    onClick={reset}
                    style={{
                        padding: '8px 18px',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'rgba(132,204,22,0.15)',
                        color: '#84cc16',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '13px',
                    }}
                >
                    Try again
                </button>
                <button
                    onClick={() => window.location.href = '/'}
                    style={{
                        padding: '8px 18px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'transparent',
                        color: 'var(--text-muted, #888)',
                        cursor: 'pointer',
                        fontSize: '13px',
                    }}
                >
                    Go home
                </button>
            </div>
        </div>
    );
}
