#!/usr/bin/env node
// ============================================================
// Hands-Free Telegram Bot — Full Agent Gateway
// ============================================================
//
// Flow Overview:
//   1. User connects using `/pair <CODE>` in Telegram
//   2. Only paired users are allowed to interact
//   3. Incoming Telegram messages → /api/chat/telegram (Agent Brain)
//   4. AI processes request (with tool access) → response sent back
//   5. All conversations synced to dashboard (Telegram + Web)
//   6. Scheduler triggers cron jobs → sends Telegram notifications
//
// Key Features:
//   • Secure pairing system
//   • Full agent integration (tools, tasks, automation)
//   • Multi-channel chat sync
//   • Background job execution via cron
//   • Media support (voice, images, files)
//
// ============================================================
