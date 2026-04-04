/**
 * Shared Lucide icon name list for Custom Skills.
 *
 * Instead of emojis, custom skills store a Lucide icon name string (e.g. "Wrench").
 * The sidebar and skill pages use SKILL_ICON_MAP to render the matching component.
 *
 * Backward-compat: if the stored icon is an emoji (non-ASCII), it's rendered as text.
 */

// Curated icon names users can choose from when creating / editing a skill.
// Order matters — the first one is the default.
export const SKILL_ICON_NAMES = [
    'Wrench',
    'Code',
    'Image',
    'Quote',
    'Music',
    'Globe',
    'Search',
    'FileText',
    'BarChart3',
    'Zap',
    'Shield',
    'Camera',
    'Heart',
    'Star',
    'Briefcase',
    'Database',
    'Mail',
    'Bell',
    'Bookmark',
    'Calculator',
    'Calendar',
    'Compass',
    'Cpu',
    'Film',
    'Hash',
    'Headphones',
    'Key',
    'Layers',
    'Link',
    'Lock',
    'Map',
    'Monitor',
    'Package',
    'PenTool',
    'Rocket',
    'Server',
    'Terminal',
    'TrendingUp',
    'Tv',
    'Video',
    'Wifi',
    'Bot',
    'Palette',
    'Gamepad2',
    'Lightbulb',
    'Megaphone',
    'Settings',
    'Users',
    'Eye',
    'Activity',
] as const;

/** Default icon name for new skills. */
export const DEFAULT_SKILL_ICON = 'Wrench';

/** Returns true when the value is an emoji string (non-ASCII, <= 4 chars). */
export function isEmoji(icon: string): boolean {
    // eslint-disable-next-line no-control-regex
    return icon.length <= 4 && /[^\x00-\x7F]/.test(icon);
}
