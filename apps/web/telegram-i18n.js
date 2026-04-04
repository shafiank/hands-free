/**
 * telegram-i18n.js
 * Translation helper for the Telegram bot (plain JavaScript â€” cannot import TypeScript).
 * Reads the user's locale from settings.json and loads the matching locale file.
 *
 * Usage:
 *   const { t } = require('./telegram-i18n');
 *   t('system.telegram.welcome')
 *   t('system.telegram.taskComplete', { task: 'Morning briefing' })
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.HANDSFREE_DATA_DIR || path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.handsfree-data'
);

let cache = {};

function getUserLocale() {
    try {
        const settings = JSON.parse(
            fs.readFileSync(path.join(DATA_DIR, 'settings.json'), 'utf-8')
        );
        return settings.language || settings.locale || 'en';
    } catch {
        return 'en';
    }
}

function loadLocale(code) {
    if (cache[code]) return cache[code];
    try {
        // Dev mode: telegram-bot.js lives at apps/web/, locales at apps/web/src/locales/
        const p = path.join(__dirname, 'src', 'locales', `${code}.json`);
        cache[code] = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return cache[code];
    } catch {
        try {
            // Standalone build fallback
            const p2 = path.join(process.cwd(), 'locales', `${code}.json`);
            cache[code] = JSON.parse(fs.readFileSync(p2, 'utf-8'));
            return cache[code];
        } catch {
            // TODO: If neither path resolves, log and check:
            //   console.log('[telegram-i18n] __dirname:', __dirname);
            //   console.log('[telegram-i18n] cwd:', process.cwd());
            if (code !== 'en') return loadLocale('en');
            return {};
        }
    }
}

function get(obj, keyPath) {
    return keyPath.split('.').reduce((a, k) => a?.[k], obj);
}

/**
 * Translate a dot-notation key for the current user locale.
 * Falls back to English, then to the key itself.
 *
 * @param {string} key  Dot-notation key, e.g. 'system.telegram.welcome'
 * @param {Object} [vars]  Variables to interpolate into {{varName}} placeholders
 * @returns {string}
 */
function t(key, vars) {
    const msgs = loadLocale(getUserLocale());
    let text = get(msgs, key) || get(loadLocale('en'), key) || key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
    }
    return text;
}

module.exports = { t };
