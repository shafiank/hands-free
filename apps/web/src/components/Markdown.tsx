import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Terminal } from 'lucide-react';

interface MarkdownProps {
    content: string;
    className?: string;
}

/**
 * Strip raw tool-call markup that some models leak into text content.
 *
 * Affected models include Kimi / Moonshot which use internal markers like:
 *   ```
 *   <|tool_calls_section_begin|>
 *   <|tool_call_begin|>
 *   functions.list_tasks:5
 *   <|tool_call_argument_begin|>{}
 *   <|tool_call_end|>
 *   <|tool_calls_section_end|>
 *   ```
 * These should never be shown to the user â€” they are parse artefacts.
 */
/**
 * Pre-process special Hands Free media tokens in text content so they render correctly.
 *
 * Some LLMs (especially weaker ones like minimax / kimi) echo the tool-result tokens
 * back into their final text response. We convert these to standard markdown so
 * the ReactMarkdown renderer displays them as images/links instead of raw text.
 *
 *  GIF_URL:https://cdn.giphy.com/xxx|Cat doing backflip  â†’  ![Cat doing backflip](url)
 *  IMG_FILE:images/gemini_img_xxx.png|a cat|auto|1:1     â†’  ![a cat](/api/file?path=images/gemini_img_xxx.png)
 *  VIDEO_FILE:videos/veo_xxx.mp4|a cat running           â†’  ðŸŽ¬ [Watch video](/api/file?path=videos/veo_xxx.mp4)
 */
function preprocessMediaTokens(text: string): string {
    if (!text) return text;

    // GIF_URL:url|title  â†’  ![title](url)
    text = text.replace(/GIF_URL:(https?:\/\/[^\s|]+)\|?([^\n]*)/g, (_match, url, title) => {
        const alt = (title || 'GIF').trim();
        return `![${alt}](${url})`;
    });

    // IMG_FILE:relPath|prompt|style|ratio  â†’  ![prompt](/api/file?path=relPath)
    text = text.replace(/IMG_FILE:([^|\s]+)\|?([^|\n]*)/g, (_match, relPath, prompt) => {
        const alt = (prompt || 'Generated image').trim();
        const src = `/api/file?path=${encodeURIComponent(relPath)}`;
        return `![${alt}](${src})`;
    });

    // VIDEO_FILE:relPath|prompt  â†’  ðŸŽ¬ [Watch video](/api/file?path=relPath)
    text = text.replace(/VIDEO_FILE:([^|\s]+)\|?([^\n]*)/g, (_match, relPath, prompt) => {
        const label = (prompt || 'Generated video').trim();
        const src = `/api/file?path=${encodeURIComponent(relPath)}`;
        return `ðŸŽ¬ [${label}](${src})`;
    });

    return text;
}

function sanitizeContent(text: string): string {
    // Pre-process media tokens before any other sanitization
    text = preprocessMediaTokens(text);

    if (!text || !text.includes('<|')) return text;

    // Kimi / Moonshot wraps BOTH the user-visible text AND the tool-call markers
    // inside the same fenced code block, e.g.:
    //
    //   ```text
    //   Perfekt! Lass mich noch die aktiven Tasks checken:
    //   <|tool_calls_section_begin|>
    //   <|tool_call_begin|>functions.list_tasks:5<|tool_call_argument_begin|>{}<|tool_call_end|>
    //   <|tool_calls_section_end|>
    //   ```
    //
    // Step 1: For any fenced block that contains tool-call markers, extract the
    //         plain-text content that precedes (and follows) the markers and
    //         return that without the fence.
    let out = text.replace(
        /```[^\n]*\n([\s\S]*?)<\|tool_calls_section_begin\|>[\s\S]*?<\|tool_calls_section_end\|>([\s\S]*?)```/g,
        (_match, before, after) => {
            const plain = (before + after)
                .replace(/<\|[^|>]*\|>/g, '') // strip any leftover tokens
                .trim();
            return plain; // return unwrapped text (or nothing if empty)
        }
    );

    // Step 2: Remove bare (un-fenced) tool-call sections
    out = out.replace(
        /<\|tool_calls_section_begin\|>[\s\S]*?<\|tool_calls_section_end\|>/g,
        ''
    );

    // Step 3: Remove any remaining <|...|> sentinel tokens
    out = out.replace(/<\|[^|>]*\|>/g, '');

    // Step 4: Remove now-empty fenced code blocks left behind
    out = out.replace(/```[^\n]*\n\s*```\n?/g, '');

    // Step 5: Collapse runs of blank lines
    out = out.replace(/\n{3,}/g, '\n\n').trim();

    return out;
}

const Markdown: React.FC<MarkdownProps> = ({ content, className = '' }) => {
    const sanitized = sanitizeContent(content);
    return (
        <div className={`markdown-body break-words w-full max-w-full ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Headings
                    h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-3 mt-4 text-lime-400" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-lg font-bold mb-2 mt-3 text-lime-300" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-md font-bold mb-2 mt-3 text-lime-200" {...props} />,

                    // Paragraphs and Lists
                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1" {...props} />,
                    li: ({ node, ...props }) => <li className="pl-1" {...props} />,

                    // Formatting
                    strong: ({ node, ...props }) => <strong className="font-bold text-lime-400" {...props} />,
                    em: ({ node, ...props }) => <em className="italic text-gray-300" {...props} />,
                    blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-4 border-lime-500/50 pl-4 py-1 my-2 bg-lime-500/5 rounded-r italic" {...props} />
                    ),

                    // Code Blocks
                    code: ({ node, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match && !String(children).includes('\n');

                        if (isInline) {
                            return (
                                <code className="bg-lime-500/10 text-lime-400 px-1.5 py-0.5 rounded text-xs font-mono border border-lime-500/20" {...props}>
                                    {children}
                                </code>
                            );
                        }

                        return (
                            <div className="relative group my-3 rounded-lg overflow-hidden border border-lime-500/20 bg-[#1e1e1e] w-full max-w-full">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-lime-500/10 border-b border-lime-500/10 text-xs text-lime-400/70 font-mono select-none">
                                    <span className="flex items-center gap-2">
                                        <Terminal size={12} />
                                        {match ? match[1] : 'text'}
                                    </span>
                                </div>
                                <div className="w-full max-w-full overflow-x-auto">
                                    <code className={`block p-3 text-sm font-mono text-gray-200 leading-relaxed whitespace-pre-wrap break-words ${className || ''}`} {...props}>
                                        {children}
                                    </code>
                                </div>
                            </div>
                        );
                    },
                    pre: ({ node, ...props }) => <pre className="not-prose" {...props} />, // Remove wrapper div styling for pre if handled in code

                    // Images (GIFs, generated images embedded in text via media token conversion)
                    img: ({ node, src, alt, ...props }) => (
                        <img
                            src={src}
                            alt={alt || ''}
                            className="max-w-full max-h-72 rounded-xl object-contain border my-2"
                            style={{ borderColor: 'rgba(132,204,22,0.25)' }}
                            loading="lazy"
                            {...props}
                        />
                    ),

                    // Links
                    a: ({ node, href, children, ...props }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-lime-400 hover:text-lime-300 underline underline-offset-2 transition-colors break-words"
                            {...props}
                        >
                            {children}
                        </a>
                    ),

                    // Tables
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4 rounded-lg border w-full max-w-full" style={{ borderColor: 'rgba(132,204,22,0.2)' }}>
                            <table className="min-w-full divide-y" style={{ borderColor: 'rgba(132,204,22,0.15)' }} {...props} />
                        </div>
                    ),
                    thead: ({ node, ...props }) => <thead style={{ background: 'rgba(132,204,22,0.08)' }} {...props} />,
                    tbody: ({ node, ...props }) => <tbody className="divide-y" style={{ borderColor: 'rgba(132,204,22,0.08)', background: 'var(--surface)' }} {...props} />,
                    tr: ({ node, ...props }) => <tr className="transition-colors hover:bg-lime-500/5" {...props} />,
                    th: ({ node, ...props }) => <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-lime-400" {...props} />,
                    td: ({ node, ...props }) => <td className="px-3 py-2 text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }} {...props} />,
                }}
            >
                {sanitized}
            </ReactMarkdown>
        </div>
    );
};

export default Markdown;
