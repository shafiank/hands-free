// â€Œâ€â€Œâ€Œâ€â€Œâ€â€â€Œâ€Œâ€â€â€Œâ€â€Œâ€â€â€â€Œâ€Œâ€â€â€â€Œâ€Œâ€â€Œâ€â€â€Œâ€Œâ€â€Œâ€â€â€Œâ€â€Œâ€Œâ€â€â€Œâ€Œâ€Œâ€â€â€Œâ€Œâ€â€Œâ€Œâ€â€Œâ€â€Œâ€â€Œâ€Œâ€â€Œ
// Hands Free v6.0.0 â€” BSL 1.1 â€” Mario Simic
// â€Œâ€â€Œâ€Œâ€â€Œâ€â€â€Œâ€Œâ€â€â€Œâ€â€Œâ€â€â€â€Œâ€Œâ€â€â€â€Œâ€Œâ€â€Œâ€â€â€Œâ€Œâ€â€Œâ€â€â€Œâ€â€Œâ€Œâ€â€â€Œâ€Œâ€Œâ€â€â€Œâ€Œâ€â€Œâ€Œâ€â€Œâ€â€Œâ€â€Œâ€Œâ€â€Œ
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import AppShell from '@/components/app-shell';
import { NotificationManager } from '@/components/system/notification-manager';
import { ErrorBoundary } from '@/components/error-boundary';

export const metadata = {
    title: 'Hands Free - Your Desktop AI Agent',
    description: 'A local-first desktop AI agent for coding, browsing, and getting real work done.',
    icons: {
        icon: [
            { url: '/favicon.ico', type: 'image/x-icon' },
        ],
        shortcut: '/favicon.ico',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* Blocking theme script: runs before body renders to prevent flash */}
                <script dangerouslySetInnerHTML={{ __html: `
                    (function() {
                        try {
                            var stored = localStorage.getItem('theme');
                            var theme = stored === 'light' ? 'light' : stored === 'dark' ? 'dark' : 'dark';
                            if (!stored) {
                                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                                theme = prefersDark ? 'dark' : 'light';
                            }
                            document.documentElement.classList.remove('light', 'dark');
                            document.documentElement.classList.add(theme);
                        } catch(e) {
                            document.documentElement.classList.add('dark');
                        }
                    })();
                ` }} />
            </head>
            <body suppressHydrationWarning>
                {/* Skip-to-main: visible only on keyboard focus (Tab from address bar) */}
                <a href="#main-content" className="skip-to-main">
                    Skip to main content
                </a>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <ErrorBoundary>
                        <AppShell>
                            <NotificationManager />
                            {children}
                        </AppShell>
                    </ErrorBoundary>
                </ThemeProvider>
            </body>
        </html>
    );
}
