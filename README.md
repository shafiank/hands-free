<div align="center">
  <h1>Hands Free</h1>
  <p><strong>Your local-first desktop AI agent for Windows, macOS, and Linux.</strong></p>
  <p>
    One-click desktop experience, OpenAI-first for fast hackathon setup, and Ollama-first when you want private local mode.
  </p>
  <p>
    One-click install. No Docker. No terminal. 15+ AI providers. Runs locally with Ollama.<br/>
    Chat, code autonomously, control your desktop, browse the web, organize multi-agent teams, manage calendars, send emails, and automate your day.
  </p>

  <p>
    <a href="https://img.shields.io/badge/desktop-Electron-2f2f2f"><img alt="Electron" src="https://img.shields.io/badge/desktop-Electron-2f2f2f" /></a>
    <a href="https://img.shields.io/badge/frontend-Next.js%2014-111111"><img alt="Next.js 14" src="https://img.shields.io/badge/frontend-Next.js%2014-111111" /></a>
    <a href="https://img.shields.io/badge/language-TypeScript-3178c6"><img alt="TypeScript" src="https://img.shields.io/badge/language-TypeScript-3178c6" /></a>
    <a href="https://img.shields.io/badge/style-Tailwind-06b6d4"><img alt="Tailwind" src="https://img.shields.io/badge/style-Tailwind-06b6d4" /></a>
    <a href="https://github.com/shafiank/hands-free/releases"><img alt="Releases" src="https://img.shields.io/badge/releases-latest-success" /></a>
  </p>
</div>

## Release and Downloads

- Releases: [GitHub Releases](https://github.com/shafiank/hands-free/releases)
- Windows: EXE installer artifact in latest release
- macOS: DMG artifact in latest release
- Linux: AppImage artifact in latest release

## Watch It In Action

Click the preview to open the demo video:

watch this out
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

Hands Free is an AI agent that lives on your desktop. Not in a browser tab, not behind a restrictive API, not in a complex Docker container. It sits on your machine, has access to your files, your browser, your calendar, your email, and it does real work.

| | Typical AI Agents | Hands Free |
|---|---|---|
| Setup | Docker, Terminal, Python CLI | Download EXE/DMG/AppImage, double-click |
| RAM Usage | 1.5GB - 3GB+ | ~300MB |
| OS Support | Linux / Docker required | Windows + macOS + Linux native |
| Time to first task | Hours to days | 30 seconds |
| Privacy | Cloud only | Local-first, BYOK, Offline capable |
| Updates | Manual Git pull and rebuild | One-click auto-updater |
| Security | Unsigned scripts | Apple Developer ID signed (Windows signing coming) |
| Migration | Start from scratch | Import from ChatGPT, Claude, OpenClaw, Hermes |

A 6-year-old built a game with it. A Developer approved the setup.

this how we do it

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

## Full Capability Overview

### Agent Skills (Open Standard)

Import and run skill packs across chat, codework, browser, spotlight, and studio flows. Supports SKILL.md style skills and packaged skill bundles.

### Hands Free Codework

Point to a project folder, describe the task, and run an autonomous loop that:

- Reads project files
- Proposes a plan
- Writes code
- Runs checks/tests where configured
- Shows diffs and execution logs

### Organization and Multi-Agent Delegation

Create specialized roles and route tasks between them. Useful for architecture, review, and implementation workflows.

### Computer Use

Desktop control includes screenshot capture, mouse, keyboard, scrolling, and app/window actions. Safety mode keeps sensitive actions approval-gated.

### Hands Free Studio (Code Builder)

Multi-role builder flow for architect/reviewer/builder style generation with live preview and deployment helpers (for supported targets).

### Browser Agent

Automates navigation, form filling, content extraction, and repeatable web workflows.

### Spotlight and Vision

Hotkey-driven command interface with screen/screenshot analysis.

### Desktop Buddy

Floating companion UI with tray/minimize behavior, quick chat, and approval prompts.

### Planner and Autopilot

Calendar-aware planning plus background task automation for recurring workflows.

## Integrations

| Category | Integrations |
|---|---|
| Calendars | Google Calendar, Apple Calendar (CalDAV), Outlook (Graph) |
| Email | Gmail and IMAP-based flows |
| Productivity | Notion, Todoist, Google Drive/Docs, GitHub |
| Messaging | Telegram, Discord, WhatsApp, Slack, Signal (availability depends on setup) |
| Smart Home | Home Assistant |
| Voice | OpenAI, Groq, Azure, ElevenLabs paths where configured |
| Developer | Dev-style APIs, MCP-compatible workflows, skill imports |

## Provider Matrix

Hands Free is BYOK and local-first.

| Local / Self-hosted | Cloud |
|---|---|
| Ollama | OpenAI |
| LM Studio | Anthropic |
| KoboldCpp | Google AI |
| vLLM / OpenAI-compatible endpoints | Groq |
| text-generation-webui | OpenRouter, Mistral, DeepSeek, xAI, others |

## Installation and Platform

Target platforms:

- Windows
- macOS
- Linux

Packaging/build outputs are managed through Electron builder config in this repository.

## Privacy and Security Model

- Local-first storage in `~/.handsfree-data`
- BYOK provider model (keys go directly to selected providers)
- Local provider mode with Ollama for offline/private workflows
- Safety controls for desktop/browser/file actions
- Sandboxed boundaries configurable in settings

## Architecture

| Layer | Technology |
|---|---|
| Shell | Electron |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Language | TypeScript |
| Storage | JSON + SQLite under `~/.handsfree-data` |
| Agent Runtime | Tool-driven autonomous loop with approval checkpoints |

## Differentiation

Hands Free is optimized for practical desktop execution rather than chat-only experiences:

- Native desktop UX instead of browser-only agent tabs
- OpenAI-first onboarding for quick demo velocity
- Local Ollama mode for privacy and offline work
- Integrated codework + browser + desktop control in one app
- Skill extensibility and multi-agent task orchestration
