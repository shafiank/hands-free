/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: 'var(--background)',
                surface: 'var(--surface)',
                'surface-light': 'var(--surface-light)',
                'surface-hover': 'var(--surface-hover)',
                foreground: 'var(--foreground)',

                primary: '#84cc16',
                'primary-dark': '#65a30d',
                'primary-foreground': '#0f172a',

                secondary: '#6b7280',
                accent: '#a3e635',

                border: 'var(--border)',
                'border-light': 'var(--border-light)',
                input: 'var(--input)',
                ring: 'var(--ring)',

                danger: 'var(--danger)',
                warning: 'var(--warning)',
                success: 'var(--success)',
                info: 'var(--info)',
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
            },
            animation: {
                'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        },
    },
    plugins: [],
};
