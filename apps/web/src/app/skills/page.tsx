'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { toggleSkill, loadSkills } from '@/actions/skills';
import { Puzzle, Zap, Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

const Icon = ({ icon: I, ...p }: { icon: any; [k: string]: any }) => <I {...p} />;

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Types ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
interface SkillDef {
    id: string;
    name: string;
    emoji: string;
    category: 'Communication' | 'Productivity' | 'Creative' | 'Security' | 'Automation';
    description: string;
    detail: string;
    requiresKey?: string;
    keyLabel?: string;
    alwaysOn?: boolean;
    providers?: { id: string; label: string; active: boolean }[];
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Optional Skills ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â grouped by category ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
const SKILL_DEFS: SkillDef[] = [
    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Communication ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    {
        id: 'group_chat', name: 'Group Chat (Multi-AI)', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â¥', category: 'Communication',
        description: 'Start a multi-model discussion - up to 4 AI agents with unique personas debate any topic.',
        detail: 'Configure participants from any provider (OpenAI, Anthropic, Google, OpenRouter, Groq, and more), each with their own name and persona (e.g. "The Skeptic", "The Visionary"). Models take turns in structured rounds. Perfect for getting diverse AI perspectives, devil\'s-advocate feedback, or creative brainstorming. Configure participants in Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Group Chat.',
        requiresKey: 'Any LLM provider API key', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ AI Providers',
    },
    {
        id: 'voice_chat', name: 'Voice Chat Mode', emoji: 'ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â', category: 'Communication',
        description: 'Speak to Hands Free and hear responses aloud - hands-free conversation in the browser.',
        detail: 'Adds a Voice Chat toggle to the chat header. Press the mic button to start recording. Your voice is transcribed via Groq Whisper (or OpenAI Whisper if Groq is unavailable). Responses are spoken back using ElevenLabs or the built-in TTS engine. Both turns are saved to chat history.',
        requiresKey: 'Groq or OpenAI API key (for Whisper)', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ AI Providers',
    },
    {
        id: 'email', name: 'Email (SMTP/IMAP)', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â§', category: 'Communication',
        description: 'Read inbox, send replies, and manage email directly in chat.',
        detail: 'Connect your email via SMTP/IMAP. Hands Free can read, summarize, search, and reply to emails from the chat interface. Works with Gmail, Outlook, and any IMAP-compatible provider.',
        requiresKey: 'SMTP/IMAP credentials', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Email',
    },
    {
        id: 'telegram', name: 'Telegram Bot', emoji: 'ÃƒÂ¢Ã…â€œÃ‹â€ ÃƒÂ¯Ã‚Â¸Ã‚Â', category: 'Communication',
        description: 'Full two-way chat via Telegram - text, voice, images, and file attachments.',
        detail: 'Create a bot via @BotFather, paste your token in Settings, and Hands Free appears in Telegram. Supports text, voice transcription, images, GIFs, and file uploads. Always-on background listener.',
        requiresKey: 'Telegram Bot Token', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Telegram',
    },
    {
        id: 'whatsapp', name: 'WhatsApp', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â±', category: 'Communication',
        description: 'Receive and reply to WhatsApp messages via approved contacts.',
        detail: 'Powered by whatsapp-web.js - no official API required. Scan a QR code to link your WhatsApp account. Responds only to approved contacts for privacy.',
        requiresKey: 'WhatsApp QR scan', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ WhatsApp',
    },
    {
        id: 'discord', name: 'Discord Bot', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¬', category: 'Communication',
        description: 'Chat with Hands Free in your Discord server via @mention or DM.',
        detail: 'Create a Discord application, add a bot token, and invite it to your server. Hands Free responds to @mentions in any channel and to DMs. Supports text, files, and slash commands.',
        requiresKey: 'Discord Bot Token', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Discord',
    },
    {
        id: 'twitter', name: 'X / Twitter', emoji: 'ÃƒÂ°Ã‚ÂÃ¢â‚¬Â¢Ã‚Â', category: 'Communication',
        description: 'Post tweets, read your timeline, fetch mentions, and reply - from chat or Telegram.',
        detail: 'Connect via OAuth 1.0a (API Key + Access Token). Three modes: Send Only (post & reply), Read & Write (also reads timeline & mentions), Full Autonomous (Hands Free posts proactively). API credentials stored securely in .handsfree-data/integrations/.',
        requiresKey: 'Twitter API Key + Access Token', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ X / Twitter',
    },

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Productivity ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    {
        id: 'google_places', name: 'Google Places', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â', category: 'Productivity',
        description: 'Search nearby places, get opening hours, reviews, directions, and geocode addresses.',
        detail: 'Powered by the Google Maps Platform REST API. Ask Hands Free to find restaurants, hospitals, or any POI near you. Get full place details including hours, ratings, reviews, phone, and website. Also provides turn-by-turn directions and address geocoding.',
        requiresKey: 'Google Places API key', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ APIs & Integrations',
    },
    {
        id: 'documents', name: 'Documents (Excel Ãƒâ€šÃ‚Â· Word Ãƒâ€šÃ‚Â· PDF)', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾', category: 'Productivity',
        description: 'Create, edit, and read Excel spreadsheets, Word documents, and PDFs - all from chat.',
        detail: 'Generate multi-sheet Excel workbooks with formulas, create styled Word documents (.docx) with tables and headings, and produce PDFs. For document creation requests (e.g. "Write me a resume"), Hands Free automatically generates both a .docx AND a .pdf simultaneously.',
    },
    {
        id: 'googleCalendar', name: 'Google Calendar', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦', category: 'Productivity',
        description: 'Read events, create meetings, and get scheduling help in chat.',
        detail: 'Connect your Google Calendar via OAuth or Service Account. Ask Hands Free what\'s on your schedule, create new events in plain language, or get conflict-free meeting suggestions.',
        requiresKey: 'Google OAuth credentials', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Integrations',
    },
    {
        id: 'weather', name: 'Weather', emoji: 'ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â¤ÃƒÂ¯Ã‚Â¸Ã‚Â', category: 'Productivity',
        description: 'Real-time weather and 7-day forecast for any city - free, no API key needed.',
        detail: 'Powered by Open-Meteo, a completely free and open weather API. Ask Hands Free for current conditions or the weekly forecast in any city. No configuration required.',
        alwaysOn: true,
    },
    {
        id: 'summarize', name: 'Summarize', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾', category: 'Productivity',
        description: 'Instantly summarize any URL, document, or pasted text with one click.',
        detail: 'Adds a Summarize button to the chat toolbar. Paste any URL or block of text and get structured key points, a brief overview, and main takeaways. No additional API key required.',
    },
    {
        id: 'web_search', name: 'Web Search (Tavily)', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â', category: 'Productivity',
        description: 'Real-time internet search - find current news and information in chat.',
        detail: 'Powered by Tavily AI Search. Ask Hands Free to look something up and it searches the web and summarizes results. Requires a free Tavily API key (generous free tier).',
        requiresKey: 'Tavily API key', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Skills ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Web Search',
    },

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Creative ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    {
        id: 'image_generation', name: 'Image Generation', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â¼ÃƒÂ¯Ã‚Â¸Ã‚Â', category: 'Creative',
        description: 'Generate images from text prompts using Google Imagen 3.',
        detail: 'Powered by Google Imagen 3. Choose style, aspect ratio, and generate directly from the chat toolbar. Uses the same Google AI API key as Gemini.',
        requiresKey: 'Google AI API key', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ AI Provider ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Google',
        providers: [
            { id: 'imagen3', label: 'Google Imagen 3', active: true },
            { id: 'flux', label: 'Flux (soon)', active: false },
            { id: 'sdxl', label: 'SDXL (soon)', active: false },
        ],
    },
    {
        id: 'video_generation', name: 'Video Generation', emoji: 'ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¬', category: 'Creative',
        description: 'Generate short videos from text descriptions using Google Veo 3.',
        detail: 'Powered by Google Veo 3. Select aspect ratio, duration (5ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“8s), and quality from the chat toolbar. Generation takes 1ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“3 minutes. Uses the same Google AI API key.',
        requiresKey: 'Google AI API key', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ AI Provider ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Google',
        providers: [
            { id: 'veo3', label: 'Google Veo 3', active: true },
            { id: 'kling', label: 'Kling (soon)', active: false },
            { id: 'runway', label: 'Runway (soon)', active: false },
        ],
    },
    {
        id: 'gif_sticker', name: 'GIF & Sticker', emoji: 'ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â­', category: 'Creative',
        description: 'Generate animated GIFs and emoji-style stickers from text prompts.',
        detail: 'Create animated GIFs and custom stickers directly in chat. Share in conversations or download for use in other apps. Powered by Google AI.',
        requiresKey: 'Google AI API key', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ AI Provider ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Google',
    },

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Security ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    {
        id: 'virustotal', name: 'VirusTotal Scan', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â', category: 'Security',
        description: 'Scan files and URLs for malware using 70+ antivirus engines.',
        detail: 'Upload or paste a file/URL and Hands Free will scan it via VirusTotal. Returns detection results from 70+ engines with a clear verdict. Requires a free VirusTotal API key.',
        requiresKey: 'VirusTotal API key', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Security',
    },

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Automation ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    {
        id: 'network_scanner', name: 'Network Scanner', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¡', category: 'Automation',
        description: 'Scan your local network for live hosts, open ports, and other Hands Free instances.',
        detail: 'Pure Node.js TCP port scanner - no nmap or shell commands required. Detects live IPs on your /24 subnet, identifies open ports with service names (SSH, HTTP, MQTT, etc.), and specifically highlights other Hands Free instances running on port 3000 for instant local linking.',
    },
    {
        id: 'casting', name: 'Media Casting (DLNA/UPnP)', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Âº', category: 'Automation',
        description: 'Discover DLNA smart TVs and speakers on your LAN and cast any media URL to them.',
        detail: 'Uses SSDP M-SEARCH (node-ssdp) to discover UPnP/DLNA media renderers (smart TVs, DLNA speakers, etc.) on your local network. Send, pause, stop, seek, and control volume via standard UPnP AVTransport SOAP commands - no Chromecast SDK or native binaries needed.',
    },
    {
        id: 'vision_screenshots', name: 'Vision & Screenshots', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚ÂÃƒÂ¯Ã‚Â¸Ã‚Â', category: 'Automation',
        description: 'Analyze images, take desktop screenshots, and use vision-capable models when your main model lacks vision.',
        detail: 'Captures desktop screenshots as a native tool - never routed through shell commands. Screenshots appear inline in chat and are forwarded to Telegram if configured. Configure your vision model in Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Vision Provider. Required prerequisite for Browser Control.',
        requiresKey: 'Vision Provider API key', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Vision Provider',
    },
    {
        id: 'browser_control', name: 'Browser Control', emoji: 'ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â', category: 'Automation',
        description: 'Automate browser actions, fill forms, scrape pages, and interact with any website using a real headless browser.',
        detail: 'Powered by Playwright (Chromium). Hands Free can navigate URLs, click elements, fill forms, extract structured data, and take full-page screenshots. Install Chromium via Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Browser Control once enabled. Requires Vision & Screenshots skill to be enabled.',
        requiresKey: 'Playwright (Chromium) + Vision skill', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Browser Control',
    },
    {
        id: 'webhooks', name: 'Webhooks', emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â€', category: 'Automation',
        description: 'Receive HTTP triggers from Zapier, n8n, IFTTT, and any service.',
        detail: 'Exposes a local webhook endpoint that external services can POST to. Triggers any Hands Free skill - run scripts, send messages, create tasks, or chain automations. Configure endpoint URL in Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Webhooks.',
        requiresKey: 'Webhook endpoint setup', keyLabel: 'Settings ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Webhooks',
    },
];

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Category order for grouped "All" view ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
const CATEGORY_ORDER = ['Communication', 'Productivity', 'Creative', 'Security', 'Automation'] as const;
type Category = typeof CATEGORY_ORDER[number];

// Category accent colors
const CATEGORY_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
    Communication: { accent: '#38bdf8', bg: 'rgba(56,189,248,0.06)', border: 'rgba(56,189,248,0.2)' },
    Productivity:  { accent: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.2)' },
    Creative:      { accent: '#f472b6', bg: 'rgba(244,114,182,0.06)', border: 'rgba(244,114,182,0.2)' },
    Security:      { accent: '#fb923c', bg: 'rgba(251,146,60,0.06)',  border: 'rgba(251,146,60,0.2)'  },
    Automation:    { accent: '#a78bfa', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.2)' },
};

const CATEGORY_EMOJI: Record<string, string> = {
    Communication: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¬', Productivity: 'ÃƒÂ¢Ã…Â¡Ã‚Â¡', Creative: 'ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¨', Security: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â„¢', Automation: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â€',
};

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Built-in Skills (always active, not toggleable) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
const BUILTIN_SKILLS = [
    { id: 'filesystem',     name: 'File Management',  emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â', desc: 'Read, write, and organize files on your computer.' },
    { id: 'shell',          name: 'Shell Execution',  emoji: 'ÃƒÂ¢Ã…Â¡Ã‚Â¡', desc: 'Run terminal commands and scripts.' },
    { id: 'tasks',          name: 'Task Management',  emoji: 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦', desc: 'Create and manage background tasks and cron jobs.' },
    { id: 'memory',         name: 'Memory',           emoji: 'ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â ', desc: 'Persistent memory across conversations.' },
    { id: 'multiagent',     name: 'Multi-Agent',      emoji: 'ÃƒÂ°Ã…Â¸Ã‚Â¤Ã¢â‚¬â€œ', desc: 'Dispatch parallel sub-tasks to specialized agents.' },
    { id: 'system-monitor', name: 'System Monitor',   emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â¥ÃƒÂ¯Ã‚Â¸Ã‚Â', desc: 'CPU, RAM, disk usage, and running processes.' },
    { id: 'local-file-chat',name: 'Local File Chat',  emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¡', desc: 'Read, summarize, and analyze files on your computer.' },
    { id: 'datetime',       name: 'Date & Time',      emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬Â¢Ã‚Â', desc: 'Current time, timezone conversions, date math, and calendar queries.' },
    { id: 'safety_mode',    name: 'Safety Mode',       emoji: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â', desc: 'Three-level command guard: Safe (blocks dangerous shell commands), Advanced (asks before executing), Unrestricted (no blocking).' },
];

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Component ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
export default function SkillsPage() {
    const { t } = useTranslation();
    const [enabledSkills, setEnabledSkills] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | Category>('all');

    useEffect(() => {
        loadSkills().then(state => {
            const map: Record<string, boolean> = {};
            Object.entries(state.skills).forEach(([id, cfg]) => { map[id] = cfg.enabled; });
            setEnabledSkills(map);
            setLoading(false);
        });
    }, []);

    const handleToggle = async (skillId: string, newValue: boolean) => {
        setToggling(skillId);
        setEnabledSkills(prev => ({ ...prev, [skillId]: newValue }));
        await toggleSkill(skillId, newValue);
        setToggling(null);
    };

    const activeCount = Object.values(enabledSkills).filter(Boolean).length;

    const filterTabs: Array<'all' | Category> = ['all', ...CATEGORY_ORDER];

    // Skills to display ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â if filtered, flat list; if 'all', grouped
    const skillsForCategory = (cat: Category) => SKILL_DEFS.filter(s => s.category === cat);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Icon icon={Loader2} size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

            {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Header ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Icon icon={Puzzle} size={26} />
                    {t('skills.page.title')}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t('skills.page.subtitle')}
                </p>
            </div>

            {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Active count banner ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
            {activeCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
                    style={{ background: 'rgba(132,204,22,0.08)', border: '1px solid rgba(132,204,22,0.2)', color: '#84cc16' }}>
                    <Icon icon={Zap} size={15} />
                    <span className="font-medium">
                        {t('skills.page.activeCount', { count: activeCount })}
                    </span>
                </div>
            )}

            {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Filter tabs ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
            <div className="flex gap-2 flex-wrap">
                {filterTabs.map(tab => {
                    const isActive = filter === tab;
                    const color = tab !== 'all' ? CATEGORY_COLORS[tab]?.accent : '#84cc16';
                    return (
                        <button key={tab} onClick={() => setFilter(tab)}
                            className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                            style={{
                                background: isActive ? color : 'var(--surface)',
                                color: isActive ? (tab === 'all' ? 'black' : '#0f0f0f') : 'var(--text-secondary)',
                                border: `1px solid ${isActive ? color : 'var(--border)'}`,
                                boxShadow: isActive ? `0 0 12px ${color}40` : 'none',
                            }}>
                            {tab === 'all' ? t('skills.filter.all') : `${CATEGORY_EMOJI[tab]} ${tab}`}
                        </button>
                    );
                })}
            </div>

            {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Optional Skills ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
            {filter === 'all' ? (
                // Grouped by category
                <div className="space-y-8">
                    {CATEGORY_ORDER.map(cat => {
                        const catSkills = skillsForCategory(cat);
                        const colors = CATEGORY_COLORS[cat];
                        return (
                            <div key={cat}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-base">{CATEGORY_EMOJI[cat]}</span>
                                    <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.accent }}>{cat}</h2>
                                    <div className="flex-1 h-px" style={{ background: colors.border }} />
                                </div>
                                <div className="space-y-2.5">
                                    {catSkills.map(skill => (
                                        <SkillCard key={skill.id} skill={skill}
                                            isEnabled={enabledSkills[skill.id] ?? false}
                                            isToggling={toggling === skill.id}
                                            onToggle={v => handleToggle(skill.id, v)}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                // Flat filtered list
                <div className="space-y-2.5">
                    {skillsForCategory(filter as Category).length === 0 ? (
                        <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>{t('skills.noSkillsInCategory')}</p>
                    ) : skillsForCategory(filter as Category).map(skill => (
                        <SkillCard key={skill.id} skill={skill}
                            isEnabled={enabledSkills[skill.id] ?? false}
                            isToggling={toggling === skill.id}
                            onToggle={v => handleToggle(skill.id, v)}
                        />
                    ))}
                </div>
            )}

            {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Hands Free Studio Premium Card ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
            {filter === 'all' && (
                <>
                    <div className="flex items-center gap-3">
                        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('skills.sections.premium')}</h2>
                        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    </div>
                    <HandsFreeStudioCard
                        isEnabled={enabledSkills['handsfree_studio'] ?? false}
                        isToggling={toggling === 'handsfree_studio'}
                        onToggle={v => handleToggle('handsfree_studio', v)}
                    />
                </>
            )}

            {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Built-in Skills ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
            {filter === 'all' && (
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            {t('skills.sections.builtIn')}
                        </h2>
                        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {BUILTIN_SKILLS.map(skill => (
                            <div key={skill.id}
                                className="rounded-xl border p-3 flex items-start gap-2.5"
                                style={{ background: 'var(--surface)', borderColor: 'rgba(132,204,22,0.15)' }}>
                                <span className="text-lg flex-shrink-0 mt-0.5">{skill.emoji}</span>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <p className="text-xs font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{skill.name}</p>
                                        <Icon icon={Lock} size={9} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    </div>
                                    <p className="text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>{skill.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Custom Skills banner ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
            {filter === 'all' && (
                <div className="rounded-2xl border p-4 flex items-center gap-4"
                    style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(59,130,246,0.04) 100%)', borderColor: 'rgba(139,92,246,0.2)' }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>ÃƒÂ°Ã…Â¸Ã‚Â¤Ã¢â‚¬â€œ</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('skills.customSection.title')}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {t('skills.customSection.desc')}
                        </p>
                    </div>
                    <a href="/custom-skills"
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.8), rgba(99,102,241,0.8))', color: 'white' }}>
                        {t('skills.customSection.link')}
                    </a>
                </div>
            )}
        </div>
    );
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Skill Card ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
function SkillCard({ skill, isEnabled, isToggling, onToggle }: {
    skill: SkillDef;
    isEnabled: boolean;
    isToggling: boolean;
    onToggle: (v: boolean) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="rounded-2xl border overflow-hidden transition-all"
            style={{
                background: 'var(--surface)',
                borderColor: isEnabled ? 'rgba(132,204,22,0.4)' : 'var(--border)',
                boxShadow: isEnabled ? '0 0 0 1px rgba(132,204,22,0.12)' : 'none',
            }}>
            {/* Main row */}
            <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                    style={{
                        background: isEnabled ? 'linear-gradient(135deg, rgba(132,204,22,0.2), rgba(34,197,94,0.1))' : 'var(--surface-light)',
                        border: `1px solid ${isEnabled ? 'rgba(132,204,22,0.3)' : 'var(--border)'}`,
                    }}>
                    {skill.emoji}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{skill.name}</h3>
                        {skill.alwaysOn && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                style={{ background: 'rgba(132,204,22,0.12)', color: '#84cc16' }}>{t('skills.badges.alwaysOn')}</span>
                        )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{skill.description}</p>
                    {skill.requiresKey && !skill.alwaysOn && (
                        <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <Icon icon={AlertCircle} size={10} />
                            {t('skills.requires')} {skill.requiresKey} - <span className="underline">{skill.keyLabel}</span>
                        </p>
                    )}
                </div>

                {/* Toggle */}
                <div className="flex-shrink-0">
                    {skill.alwaysOn ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#84cc16' }}>
                            <Icon icon={CheckCircle2} size={15} /> {t('skills.badges.active')}
                        </div>
                    ) : (
                        <button
                            onClick={() => onToggle(!isEnabled)}
                            disabled={isToggling}
                            className="relative flex items-center flex-shrink-0"
                            style={{ width: 44, height: 24 }}
                            title={isEnabled ? t('skills.toggles.disable') : t('skills.toggles.enable')}>
                            {isToggling ? (
                                <Icon icon={Loader2} size={16} className="animate-spin mx-auto" style={{ color: 'var(--text-muted)' }} />
                            ) : (
                                <div className="w-full h-full rounded-full transition-all duration-200"
                                    style={{ background: isEnabled ? '#84cc16' : 'var(--border)' }}>
                                    <div className="absolute top-0.5 rounded-full bg-white shadow transition-all duration-200"
                                        style={{ width: 20, height: 20, left: isEnabled ? 22 : 2 }} />
                                </div>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Detail panel */}
            <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{skill.detail}</p>
                {skill.providers && (
                    <div className="mt-3">
                        <p className="text-[10px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{t('skills.aiProvider')}</p>
                        <div className="flex flex-wrap gap-2">
                            {skill.providers.map(prov => (
                                <div key={prov.id}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5"
                                    style={{
                                        background: prov.active ? 'rgba(132,204,22,0.1)' : 'var(--surface-light)',
                                        border: `1px solid ${prov.active ? 'rgba(132,204,22,0.25)' : 'var(--border)'}`,
                                        color: prov.active ? '#84cc16' : 'var(--text-muted)',
                                        opacity: prov.active ? 1 : 0.5,
                                    }}>
                                    {prov.active && <Icon icon={CheckCircle2} size={10} />}
                                    {prov.label}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Hands Free Studio Premium Card ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â always dark ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
function HandsFreeStudioCard({ isEnabled, isToggling, onToggle }: {
    isEnabled: boolean; isToggling: boolean; onToggle: (v: boolean) => void;
}) {
    const { t } = useTranslation();
    const CAPABILITIES = [
        { icon: 'ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â', label: 'Websites & Landing Pages' },
        { icon: 'ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂºÃƒÂ¯Ã‚Â¸Ã‚Â', label: 'React / Next.js Apps' },
        { icon: 'ÃƒÂ¢Ã…Â¡Ã‚Â¡', label: 'APIs & Backend Services' },
        { icon: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ…â€™', label: 'Chrome Extensions' },
        { icon: 'ÃƒÂ°Ã…Â¸Ã‚ÂÃ‚Â', label: 'Python Scripts & Tools' },
        { icon: 'ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â®', label: 'Games & Interactive Demos' },
    ];

    return (
        <div className="rounded-2xl overflow-hidden transition-all duration-500"
            style={{
                background: isEnabled
                    ? 'linear-gradient(135deg, #0f0a1e 0%, #0d0d1a 50%, #0a1020 100%)'
                    : 'linear-gradient(135deg, #111118 0%, #0d0d18 100%)',
                border: isEnabled ? '1px solid rgba(139,92,246,0.45)' : '1px solid rgba(99,102,241,0.2)',
                boxShadow: isEnabled ? '0 0 40px rgba(139,92,246,0.12), inset 0 0 60px rgba(139,92,246,0.03)' : 'none',
                filter: isEnabled ? 'none' : 'saturate(0.7) brightness(0.9)',
            }}>
            {/* Top accent strip */}
            <div className="h-0.5 w-full"
                style={{ background: isEnabled ? 'linear-gradient(90deg, transparent, #8b5cf6 30%, #6366f1 70%, transparent)' : 'rgba(99,102,241,0.2)' }} />
            <div className="p-6">
                <div className="flex items-start gap-5 mb-5">
                    {/* Hands Free Studio */}
                    <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
                            style={{
                                background: isEnabled ? 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.15))' : 'rgba(139,92,246,0.06)',
                                border: `1px solid ${isEnabled ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.15)'}`,
                                boxShadow: isEnabled ? '0 0 20px rgba(139,92,246,0.2)' : 'none',
                                animation: isEnabled ? 'float 4s ease-in-out infinite' : 'none',
                            }}>
                            ÃƒÂ°Ã…Â¸Ã‚Â¦Ã‚Â
                        </div>
                        {isEnabled && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-[#0f0a1e]" />
                        )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-black" style={{
                                background: 'linear-gradient(135deg, #c4b5fd, #818cf8)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                            }}>{t('skills.handsFreeStudio.title')}</h3>
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                                style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}>
                                {t('skills.badges.codeBuilder')}
                            </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(196,181,253,0.7)' }}>
                            {t('skills.handsFreeStudio.desc')}
                        </p>
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(148,163,184,0.6)' }}>
                            {t('skills.handsFreeStudio.detail')}
                        </p>
                    </div>
                    {/* Toggle button */}
                    <button onClick={() => onToggle(!isEnabled)} disabled={isToggling}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                        style={{
                            background: isEnabled ? 'rgba(139,92,246,0.2)' : 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.2))',
                            color: isEnabled ? '#a78bfa' : 'white',
                            border: `1px solid ${isEnabled ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.35)'}`,
                            boxShadow: isEnabled ? 'none' : '0 0 15px rgba(139,92,246,0.2)',
                        }}>
                        {isToggling ? <span className="animate-spin">ÃƒÂ¢Ã…Â¸Ã‚Â³</span>
                            : isEnabled ? t('skills.handsFreeStudio.enabled') : t('skills.handsFreeStudio.enable')}
                    </button>
                </div>

                {/* Capabilities */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
                    {CAPABILITIES.map(c => (
                        <div key={c.label} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                            style={{
                                background: isEnabled ? 'rgba(139,92,246,0.08)' : 'rgba(99,102,241,0.04)',
                                border: `1px solid ${isEnabled ? 'rgba(139,92,246,0.2)' : 'rgba(99,102,241,0.1)'}`,
                                color: isEnabled ? 'rgba(196,181,253,0.8)' : 'rgba(148,163,184,0.5)',
                            }}>
                            <span>{c.icon}</span>
                            <span className="font-medium">{c.label}</span>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'rgba(139,92,246,0.12)' }}>
                    <div className="flex items-center gap-4 text-[11px]" style={{ color: 'rgba(148,163,184,0.5)' }}>
                        <span>{t('skills.handsFreeStudio.requires')}</span>
                        <span>{t('skills.handsFreeStudio.credits')}</span>
                    </div>
                    {isEnabled && (
                        <Link href="/code"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold hover:scale-105 transition-transform"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white' }}>
                            {t('skills.handsFreeStudio.open')}
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

