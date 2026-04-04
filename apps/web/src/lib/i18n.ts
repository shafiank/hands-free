/**
 * i18n.ts
 *
 * Lightweight internationalisation hook for Hands Free.
 *
 * Usage:
 *   const { t, locale, setLocale } = useTranslation();
 *   <p>{t('chat.send')}</p>
 *   <p>{t('chat.queueMessageCount', { count: 3 })}</p>
 *
 * Adding a new language:
 *   1. Create src/locales/{locale}.json  (copy en.json as template)
 *   2. Add the locale to SUPPORTED_LOCALES below
 *
 * The selected locale is persisted to localStorage (key: 'handsfree-locale').
 * Falls back to 'en' for any missing key or unsupported locale.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import en from '@/locales/en.json';

// â”€â”€â”€ Supported locales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface LocaleInfo {
    code: string;   // BCP 47 language tag, e.g. 'en', 'de', 'es'
    name: string;   // Human-readable name in its own language
    flag?: string;  // Emoji flag (optional)
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
    { code: 'en', name: 'English',    flag: '[EN]' },
    { code: 'de', name: 'Deutsch',    flag: '[DE]' },
    { code: 'es', name: 'Espanol',    flag: '[ES]' },
    { code: 'fr', name: 'Francais',   flag: '[FR]' },
    { code: 'ru', name: 'Russian',    flag: '[RU]' },
    { code: 'zh', name: 'Chinese',    flag: '[ZH]' },
    { code: 'ja', name: 'Japanese',   flag: '[JA]' },
    { code: 'ko', name: 'Korean',     flag: '[KO]' },
    { code: 'pt', name: 'Portugues',  flag: '[PT]' },
];

// â”€â”€â”€ Catalogue (lazy-loaded translation maps) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type TranslationMap = Record<string, any>;

const catalogue: Record<string, TranslationMap> = {
    en,
};

async function loadLocale(code: string): Promise<TranslationMap> {
    if (catalogue[code]) return catalogue[code];
    try {
        const mod = await import(`@/locales/${code}.json`);
        catalogue[code] = mod.default ?? mod;
        return catalogue[code];
    } catch {
        // Unknown locale â€” fall back to English
        return catalogue['en'];
    }
}

// â”€â”€â”€ Key resolver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Resolve a dot-separated key like 'chat.send' against a translation map,
 * optionally interpolating `{{variable}}` placeholders.
 *
 * Returns the English fallback if the key is missing in the active locale.
 */
function resolve(
    map: TranslationMap,
    key: string,
    vars?: Record<string, string | number>,
): string {
    const parts = key.split('.');
    let node: any = map;
    for (const part of parts) {
        if (node == null || typeof node !== 'object') break;
        node = node[part];
    }

    // Fall back to English if missing
    if (typeof node !== 'string') {
        let fallback: any = en;
        for (const part of parts) {
            if (fallback == null || typeof fallback !== 'object') break;
            fallback = fallback[part];
        }
        node = typeof fallback === 'string' ? fallback : key;
    }

    // Interpolate {{variable}} placeholders
    if (vars) {
        node = (node as string).replace(/\{\{(\w+)\}\}/g, (_, name) =>
            vars[name] !== undefined ? String(vars[name]) : `{{${name}}}`,
        );
    }

    return node as string;
}

// â”€â”€â”€ Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STORAGE_KEY = 'handsfree-locale';

export function useTranslation() {
    const [locale, setLocaleState] = useState<string>('en');
    const [map, setMap]           = useState<TranslationMap>(en);

    // Hydrate from localStorage on mount
    useEffect(() => {
        const stored = typeof localStorage !== 'undefined'
            ? localStorage.getItem(STORAGE_KEY) ?? 'en'
            : 'en';
        const valid = SUPPORTED_LOCALES.find(l => l.code === stored)?.code ?? 'en';
        if (valid !== 'en') {
            loadLocale(valid).then(m => {
                setMap(m);
                setLocaleState(valid);
            });
        }
    }, []);

    const setLocale = useCallback((code: string) => {
        const valid = SUPPORTED_LOCALES.find(l => l.code === code)?.code ?? 'en';
        loadLocale(valid).then(m => {
            setMap(m);
            setLocaleState(valid);
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, valid);
            }
        });
    }, []);

    const t = useCallback(
        (key: string, vars?: Record<string, string | number>): string =>
            resolve(map, key, vars),
        [map],
    );

    return { t, locale, setLocale };
}
