'use client';

/**
 * ErrorBoundary â€” Hands Free v5
 *
 * Catches unhandled React render errors and unhandled Promise rejections
 * (e.g., background polling failures after the OS suspends the tab/process).
 *
 * Instead of the default blank Next.js crash screen, the user sees a
 * Hands Free-themed fallback UI with a one-click "Reload" button.
 *
 * Usage (in layout.tsx):
 *   <ErrorBoundary>
 *     {children}
 *   </ErrorBoundary>
 */

import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    message:  string;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, message: '' };
    }

    // â”€â”€ React render error (synchronous) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    static getDerivedStateFromError(error: unknown): State {
        const message =
            error instanceof Error
                ? error.message
                : typeof error === 'string'
                ? error
                : 'An unexpected error occurred.';
        return { hasError: true, message };
    }

    componentDidCatch(error: unknown, info: React.ErrorInfo) {
        // Log for debugging; never re-throw so the boundary stays in control.
        console.error('[ErrorBoundary] Caught render error:', error, info?.componentStack);
    }

    // â”€â”€ Also catch unhandled Promise rejections from background polling â”€â”€â”€â”€â”€
    // These don't trigger getDerivedStateFromError (they're async), but we
    // surface them here so the UI doesn't silently break.
    componentDidMount() {
        this._onUnhandledRejection = (event: PromiseRejectionEvent) => {
            // Only trap rejections that look like network/suspension errors.
            // Ignore intentional AbortErrors from cancelled fetches.
            const reason = event?.reason;
            if (reason instanceof DOMException && reason.name === 'AbortError') return;

            console.error('[ErrorBoundary] Unhandled promise rejection:', reason);
            // Don't crash the whole UI for a rejected poll â€” just log it.
            // The visibilitychange guard in the polling code prevents most of these.
        };
        window.addEventListener('unhandledrejection', this._onUnhandledRejection);
    }

    componentWillUnmount() {
        if (this._onUnhandledRejection) {
            window.removeEventListener('unhandledrejection', this._onUnhandledRejection);
        }
    }

    private _onUnhandledRejection?: (e: PromiseRejectionEvent) => void;

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        // â”€â”€ Hands Free-themed fallback UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg, #0f0f0f)',
                    color: 'var(--text-primary, #f5f5f5)',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    padding: '2rem',
                    textAlign: 'center',
                    gap: '1.5rem',
                }}
            >
                {/* Icon */}
                <div
                    style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '20px',
                        background: 'rgba(132,204,22,0.12)',
                        border: '1.5px solid rgba(132,204,22,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                    }}
                >
                    ðŸ¦Ž
                </div>

                {/* Heading */}
                <div style={{ maxWidth: '420px' }}>
                    <h1
                        style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            margin: '0 0 0.5rem',
                            color: 'var(--text-primary, #f5f5f5)',
                        }}
                    >
                        Something went wrong
                    </h1>
                    <p
                        style={{
                            fontSize: '0.875rem',
                            margin: 0,
                            color: 'var(--text-muted, #888)',
                            lineHeight: 1.6,
                        }}
                    >
                        Hands Free hit an unexpected error - this can happen when the app
                        wakes up after being suspended in the background. Your chat
                        history is safe.
                    </p>
                    {this.state.message && (
                        <p
                            style={{
                                marginTop: '0.75rem',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted, #666)',
                                fontFamily: 'monospace',
                                background: 'rgba(255,255,255,0.04)',
                                borderRadius: '8px',
                                padding: '0.5rem 0.75rem',
                                wordBreak: 'break-all',
                            }}
                        >
                            {this.state.message}
                        </p>
                    )}
                </div>

                {/* Reload button */}
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        background: '#84cc16',
                        color: '#000',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '0.625rem 1.5rem',
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}
                >
                    â†º Reload Hands Free
                </button>
            </div>
        );
    }
}
