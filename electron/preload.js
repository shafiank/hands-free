'use strict';

/**
 * preload.js â€” Electron Preload Script
 *
 * This script runs in the renderer process (the browser window) BEFORE any
 * web content loads. It has access to Node.js APIs, but the renderer itself
 * does NOT â€” keeping the sandbox intact.
 *
 * Only expose what the Next.js app actually needs via contextBridge.
 * Never expose raw Node.js modules to the renderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

// â”€â”€â”€ Exposed API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Anything added to `window.handsfree` is accessible from the Next.js app.
// Keep this surface minimal.
contextBridge.exposeInMainWorld('handsfree', {
  /**
   * Platform string â€” useful for platform-specific UI tweaks.
   * e.g. window.handsfree.platform === 'darwin'
   */
  platform: process.platform,

  /**
   * App version from package.json, injected by main process.
   */
  version: process.env.npm_package_version || '6.0.0',

  /**
   * Send a fire-and-forget message to the main process.
   */
  send: (channel, ...args) => {
    const allowed = [
      'minimize-to-tray', 'show-window',
      // â”€â”€ Update channels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      'check-update',    // trigger a manual update check
      'download-update', // confirm download of the available update
      'install-update',  // quitAndInstall â€” restart + apply downloaded update
      // â”€â”€ Other â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      'set-auto-launch', 'relaunch-app', 'set-desktop-buddy', 'open-chat',
    ];
    if (allowed.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },

  /**
   * Send a message and await a reply from the main process.
   */
  invoke: (channel, ...args) => {
    const allowed = ['get-auto-launch', 'show-save-dialog', 'copy-file', 'get-desktop-buddy', 'execute-skill'];
    if (!allowed.includes(channel)) return Promise.reject(new Error(`Channel '${channel}' not allowed`));
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Execute a custom skill by ID from the renderer.
   * Calls the Next.js /api/custom-skills/execute endpoint via the main process.
   *
   * Usage: const result = await window.handsfree.executeSkill('monitor', { action: 'on' })
   */
  executeSkill: (skillId, args) => {
    return ipcRenderer.invoke('execute-skill', skillId, args);
  },

  /**
   * Listen for a message from the main process (one-time).
   */
  once: (channel, callback) => {
    const allowed = ['update-available', 'update-downloaded'];
    if (allowed.includes(channel)) {
      ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    }
  },

  /**
   * Listen for a message from the main process (persistent).
   * Returns an unsubscribe function.
   */
  on: (channel, callback) => {
    const allowed = [
      // â”€â”€ Update events (from updater.js) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      'update-available',          // { version, releaseDate, releaseNotes }
      'update-not-available',      // { version }
      'update-download-progress',  // { percent, bytesPerSecond, transferred, total }
      'update-downloaded',         // { version, releaseDate }
      'update-error',              // errorMessage string
      // â”€â”€ Other â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      'server-status',
    ];
    if (!allowed.includes(channel)) return () => {};
    const handler = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
});
