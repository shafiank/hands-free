#!/usr/bin/env node
/**
 * post-nextjs-build.js
 *
 * Post-build script: copies static assets into the Next.js standalone output.
 * Run automatically after `npm run build` in apps/web/ via the "postbuild"
 * npm lifecycle hook, and before electron-builder via build:win / build:mac.
 *
 * This automates the manual copy steps documented in next.config.mjs:
 *   .next/static   Ã¢â€ â€™ .next/standalone/.next/static
 *   public/        Ã¢â€ â€™ .next/standalone/public/
 *
 * Without this step the packaged app serves a blank page because the
 * standalone server.js cannot find its static assets.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// Resolve paths relative to this script's location (scripts/)
const ROOT       = path.join(__dirname, '..');
const WEB_DIR    = path.join(ROOT, 'apps', 'web');
const STANDALONE = path.join(WEB_DIR, '.next', 'standalone');

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function copyDirSync(src, dest) {
    if (!fs.existsSync(src)) {
        console.error(`Ã¢ÂÅ’  Source not found: ${src}`);
        process.exit(1);
    }
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath  = path.join(src,  entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function countFiles(dir) {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        count += entry.isDirectory()
            ? countFiles(path.join(dir, entry.name))
            : 1;
    }
    return count;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Guard: standalone output must exist Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

if (!fs.existsSync(STANDALONE)) {
    console.error('Ã¢ÂÅ’  .next/standalone not found.');
    console.error('    Run `npm run build` in apps/web/ before this script.');
    process.exit(1);
}

console.log('Ã°Å¸â€œÂ¦  Hands Free post-build: copying static assets into standalone output...');

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ 1. .next/static Ã¢â€ â€™ .next/standalone/.next/static Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const staticSrc  = path.join(WEB_DIR, '.next', 'static');
const staticDest = path.join(STANDALONE, '.next', 'static');
console.log(`    .next/static Ã¢â€ â€™ standalone/.next/static`);
copyDirSync(staticSrc, staticDest);
console.log(`    Ã¢Å“â€œ  ${countFiles(staticDest)} files`);

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ 2. public/ Ã¢â€ â€™ .next/standalone/public/ Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const publicSrc  = path.join(WEB_DIR, 'public');
const publicDest = path.join(STANDALONE, 'public');
console.log(`    public/ Ã¢â€ â€™ standalone/public/`);
copyDirSync(publicSrc, publicDest);
console.log(`    Ã¢Å“â€œ  ${countFiles(publicDest)} files`);

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ 3. Explicit mascot check Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Belt-and-suspenders: confirm mascot videos are in place after the copy.
// The Desktop Buddy will silently show nothing if these are missing.
//
// Folder structure (since Phase 3D):
//   public/mascot/<skin>/<category>/*.webm
//   e.g. public/mascot/handy/idle/stand.webm
//
// The default skin is 'handy'. At least one category subfolder must exist.

const mascotDest     = path.join(publicDest, 'mascot');
const defaultSkin    = 'handy';
const skinDest       = path.join(mascotDest, defaultSkin);
const CATEGORIES     = ['idle', 'action', 'intro', 'outro'];

if (!fs.existsSync(mascotDest)) {
    console.error('Ã¢ÂÅ’  mascot/ directory is missing from standalone/public/.');
    console.error('    Check that apps/web/public/mascot/ exists and is not empty.');
    process.exit(1);
}

if (!fs.existsSync(skinDest)) {
    console.error(`Ã¢ÂÅ’  mascot/${defaultSkin}/ skin folder is missing from standalone/public/.`);
    console.error(`    Expected: apps/web/public/mascot/${defaultSkin}/ with category subfolders.`);
    console.error(`    Did you forget to move videos from mascot/idle/ Ã¢â€ â€™ mascot/${defaultSkin}/idle/ ?`);
    process.exit(1);
}

// Warn (not fatal) if any expected category folder is absent
for (const cat of CATEGORIES) {
    const catDir = path.join(skinDest, cat);
    if (!fs.existsSync(catDir)) {
        console.warn(`Ã¢Å¡Â Ã¯Â¸Â   mascot/${defaultSkin}/${cat}/ not found Ã¢â‚¬â€ Buddy will skip that state.`);
    }
}

const mascotCount = countFiles(mascotDest);
console.log(`    Ã¢Å“â€œ  mascot/${defaultSkin}/ verified (${mascotCount} video files total)`);

console.log('Ã¢Å“â€¦  Post-build copy complete Ã¢â‚¬â€ standalone output is ready for electron-builder.');
