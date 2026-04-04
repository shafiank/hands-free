import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: 'var(--background)', color: 'var(--text-primary)' }}>
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-6"
                style={{ background: 'rgba(132, 204, 22, 0.1)', border: '1px solid rgba(132, 204, 22, 0.2)' }}>
                🦎
            </div>
            <h2 className="text-5xl font-bold mb-2 bg-gradient-to-r from-lime-400 to-green-600 bg-clip-text text-transparent">404</h2>
            <p className="mb-8" style={{ color: 'var(--text-muted)' }}>This page could not be found.</p>
            <Link href="/" className="px-6 py-3 bg-lime-500 hover:bg-lime-400 rounded-xl transition-colors text-black font-semibold shadow-lg shadow-lime-500/20">
                Back to Dashboard
            </Link>
        </div>
    );
}
