// â”€â”€â”€ Hands Free Custom Skill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Gallery â€” Media library for all workspace images
// Uses framework's built-in GalleryView (grid + lightbox + keyboard nav)
'use strict';

const fs   = require('fs');
const path = require('path');

// Supported image extensions
const IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
  '.tiff', '.tif', '.avif', '.ico',
]);

/**
 * Recursively collect all image files from a directory.
 * Skips hidden directories and unreadable paths.
 */
function collectImages(dir, baseDir, results) {
  results = results || [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results; // skip unreadable dirs
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // skip hidden
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip common non-image directories for performance
      if (['node_modules', '.git', '__pycache__', 'dist', 'build'].includes(entry.name)) continue;
      collectImages(fullPath, baseDir, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTS.has(ext)) {
        try {
          const stat = fs.statSync(fullPath);
          results.push({
            path:     fullPath,
            name:     entry.name,
            url:      '/api/custom-skills/image?path=' + encodeURIComponent(fullPath),
            size:     stat.size,
            modified: stat.mtime.toISOString(),
          });
        } catch {
          // stat failed â€” skip this file
        }
      }
    }
  }
  return results;
}

module.exports = {
  name:        "Gallery",
  id:          "gallery",
  description: "Media library with grid view and lightbox for all workspace images",
  category:    "creative",
  icon:        "\uD83D\uDDBC\uFE0F",
  version:     "1.0.0",
  author:      "Hands Free",
  hasUI:       true,
  menuName:    "Gallery",
  menuRoute:   "/custom/gallery",

  /**
   * Scans the user's workspace for images and returns them for the
   * framework's built-in GalleryView (grid + lightbox + keyboard nav).
   *
   * @param {object} input   - Not used
   * @param {object} context - { dataDir, workspacePath, settings }
   * @returns {Promise<{success: boolean, result?: any, error?: string}>}
   */
  async execute(input, context) {
    try {
      const workspaceDir = context.workspacePath;
      if (!workspaceDir) {
        return { success: false, error: 'No workspace path configured. Set it in Settings.' };
      }
      if (!fs.existsSync(workspaceDir)) {
        return { success: false, error: `Workspace directory not found: ${workspaceDir}` };
      }

      const images = collectImages(workspaceDir, workspaceDir, []);

      // Sort newest first
      images.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

      if (images.length === 0) {
        return {
          success: true,
          result: {
            type: 'html',
            html: '<div style="text-align:center;padding:60px 20px;color:#888;">'
                + '<div style="font-size:3rem;margin-bottom:12px;">\uD83D\uDDBC\uFE0F</div>'
                + '<p>No images found in your workspace.</p>'
                + '<p style="font-size:0.85rem;margin-top:8px;color:#666;">Add images to your workspace folder and refresh.</p>'
                + '</div>',
          },
        };
      }

      // Return gallery type â€” framework renders grid + lightbox automatically
      return {
        success: true,
        result: {
          type:   'gallery',
          images: images,
        },
      };
    } catch (err) {
      return { success: false, error: err.message ?? String(err) };
    }
  },
};
