// Next.js Route Segment loading.tsx
// Shown on hard-refresh (CTRL+F5 / CMD+R) before React hydration
// Uses CSS variables + blocking theme script in layout.tsx to respect light/dark mode

export default function Loading() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                gap: '24px',
                background: 'var(--background)',
            }}
        >
            {/* Gecko logo with spinning ring */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Outer spinning ring */}
                <div style={{
                    position: 'absolute',
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    border: '2px solid transparent',
                    borderTopColor: '#84cc16',
                    borderRightColor: 'rgba(132,204,22,0.3)',
                    animation: 'handsfree-spin 1.2s linear infinite',
                }} />
                {/* Middle glow ring */}
                <div style={{
                    position: 'absolute',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(132,204,22,0.15) 0%, transparent 70%)',
                    animation: 'handsfree-pulse 2s ease-in-out infinite',
                }} />
                {/* Gecko icon */}
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, rgba(132,204,22,0.2) 0%, rgba(34,197,94,0.1) 100%)',
                    border: '1px solid rgba(132,204,22,0.3)',
                    boxShadow: '0 8px 24px rgba(132,204,22,0.15)',
                }}>
                    <span style={{ fontSize: '24px', animation: 'handsfree-float 3s ease-in-out infinite' }}>ðŸ¦Ž</span>
                </div>
            </div>

            {/* Text + animated dots */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
                    Starting Hands Free
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {[0, 1, 2, 3].map(i => (
                        <span
                            key={i}
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#84cc16',
                                display: 'inline-block',
                                opacity: 0.4,
                                animation: `handsfree-bounce 1.2s ease-in-out infinite`,
                                animationDelay: `${i * 0.15}s`,
                            }}
                        />
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes handsfree-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes handsfree-float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-4px); }
                }
                @keyframes handsfree-bounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40% { transform: translateY(-6px); opacity: 1; }
                }
                @keyframes handsfree-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(0.95); }
                }
            `}</style>
        </div>
    );
}
