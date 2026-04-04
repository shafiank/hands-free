export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

// â”€â”€â”€ OG / Meta Scraper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fetches Open Graph and Twitter Card metadata for a URL.
// Used by the chat UI to show rich link previews.

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Hands Free/1.0; +https://github.com/handsfree)',
                'Accept': 'text/html,application/xhtml+xml',
            },
        });
        clearTimeout(timeout);

        if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            // Non-HTML: return basic info from URL
            return NextResponse.json({ url, title: decodeURIComponent(url.split('/').pop() || url) });
        }

        // Read up to 80KB (enough for <head>)
        const reader = res.body?.getReader();
        let html = '';
        let bytesRead = 0;
        if (reader) {
            const decoder = new TextDecoder();
            while (bytesRead < 80000) {
                const { done, value } = await reader.read();
                if (done) break;
                html += decoder.decode(value, { stream: !done });
                bytesRead += value.length;
                // Stop once we've passed </head> â€” no need to read body
                if (html.includes('</head>')) break;
            }
            reader.cancel().catch(() => { });
        }

        const get = (pattern: RegExp) => {
            const m = html.match(pattern);
            return m ? m[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim() : null;
        };

        const title =
            get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
            get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
            get(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
            get(/<title[^>]*>([^<]+)<\/title>/i) ||
            null;

        const description =
            get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
            get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ||
            get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
            get(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
            null;

        const image =
            get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
            get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
            null;

        const siteName =
            get(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
            get(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i) ||
            null;

        // Derive domain for favicon
        let domain = '';
        try { domain = new URL(url).hostname; } catch { }

        return NextResponse.json({
            url,
            title: title ? title.slice(0, 200) : null,
            description: description ? description.slice(0, 400) : null,
            image: image || null,
            siteName: siteName || domain || null,
            favicon: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
    }
}
