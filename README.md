<div align="center">
  <h1>Hands Free</h1>
  <p><strong>Your local-first desktop AI agent for Windows, macOS, and Linux.</strong></p>
  <p>
    One-click desktop experience, OpenAI-first for fast hackathon setup, and Ollama-first when you want private local mode.
  </p>

  <p>
    <a href="https://img.shields.io/badge/desktop-Electron-2f2f2f"><img alt="Electron" src="https://img.shields.io/badge/desktop-Electron-2f2f2f" /></a>
    <a href="https://img.shields.io/badge/frontend-Next.js%2014-111111"><img alt="Next.js 14" src="https://img.shields.io/badge/frontend-Next.js%2014-111111" /></a>
    <a href="https://img.shields.io/badge/language-TypeScript-3178c6"><img alt="TypeScript" src="https://img.shields.io/badge/language-TypeScript-3178c6" /></a>
    <a href="https://img.shields.io/badge/style-Tailwind-06b6d4"><img alt="Tailwind" src="https://img.shields.io/badge/style-Tailwind-06b6d4" /></a>
  </p>
</div>

## Watch It In Action

Click the preview to open the demo video:
 now watch this 

## Interactive Gallery

Click any image to view a larger version:

<p align="center">
  <a href="https://handsfree.app/rm_1.png"><img src="https://handsfree.app/rm_1.png" alt="Main interface" width="48%" /></a>
  <a href="https://handsfree.app/rm_0.png"><img src="https://handsfree.app/rm_0.png" alt="Feature overview" width="48%" /></a>
</p>
<p align="center">
  <a href="https://handsfree.app/rm_4.png"><img src="https://handsfree.app/rm_4.png" alt="Spotlight and vision" width="48%" /></a>
  <a href="https://handsfree.app/magic.gif"><img src="https://handsfree.app/magic.gif" alt="Desktop buddy" width="48%" /></a>
</p>

## Why Hands Free

Hands Free is designed to run as a real desktop teammate, not a browser-only assistant.

| Category | Typical Agent Setup | Hands Free |
|---|---|---|
| First run | CLI + Docker + env setup | Desktop app flow |
| Coding workflow | External toolchain | Built-in plan, diff, and execution UI |
| Computer use | Limited/no native control | Desktop actions with approval gating |
| Privacy mode | Mostly cloud-first | Local-first with Ollama support |
| Provider strategy | Single-vendor lock-in | OpenAI-first plus multi-provider BYOK |

## What It Can Do

- Autonomous codework on a selected project folder
- Desktop control with safety approvals
- Browser automation and extraction workflows
- Planner, tasks, skills, and assistant memory
- Calendar, email, and integration-oriented agent actions
- Desktop buddy and tray-based quick interaction

## Provider Strategy

Hands Free currently prioritizes:

- OpenAI as the default hackathon path
- Ollama as the private local/offline path
- Additional OpenAI-compatible and cloud providers through settings

## Quick Start (Development)

From repo root:

```bash
npm install
npm run dev
```

Build web app:

```bash
npm run build:web
```

## Project Layout

- `apps/web` - Next.js app, agent UI, routes, and server actions
- `electron` - desktop shell, main process, tray, preload, updater
- `scripts` - packaging and build helper scripts

## Data and Storage

- Local app data path: `~/.handsfree-data`
- Storage model: JSON + SQLite

## Current Focus

This repository is the active Hands Free hackathon codebase with full rebrand in progress, OpenAI-first onboarding, and local Ollama support retained.
