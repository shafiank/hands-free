/** @type {import('next').NextConfig} */
const nextConfig = {
  // â”€â”€ Desktop build â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // `standalone` bundles a self-contained server.js + minimal node_modules into
  // .next/standalone/. Electron's main process spawns this directly with its
  // own Node runtime â€” no npm, no next CLI, no user-installed Node required.
  //
  // The .next/standalone/ output must be complemented by:
  //   cp -r .next/static  .next/standalone/.next/static
  //   cp -r public        .next/standalone/public
  // (electron-builder's asarUnpack handles this in the packaged app.)
  //
  // The app still works as a plain web server when NOT packaged (Tailscale access).
  output: 'standalone',

  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Fix: lucide-react v0.307+ changed its ESM internal structure (createLucideIcon.js moved).
  // Next.js 14's __barrel_optimize__ loader cannot resolve the new layout.
  // transpilePackages forces Next.js to compile lucide-react directly, bypassing the
  // barrel optimizer and fixing the "Module not found: Can't resolve '../createLucideIcon.js'" error.
  transpilePackages: ['lucide-react'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Tell Next.js NOT to bundle these packages â€” load them from node_modules at runtime.
    // This fixes "pdf-parse library missing" errors when the package IS installed but
    // webpack can't resolve it through dynamic import() in server actions/components.
    serverComponentsExternalPackages: ['pdf-parse', 'node-ssdp', 'whatsapp-web.js', 'discord.js'],
  },
  webpack: (config) => {
    // Suppress expected warning from runtime plugin loader in orchestrator.ts.
    // Skills are loaded from .handsfree-data/skills/ at runtime via dynamic require/import
    // with webpackIgnore: true â€” webpack cannot resolve these paths at build time by design.
    config.ignoreWarnings = [
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];
    return config;
  },
};

export default nextConfig;
