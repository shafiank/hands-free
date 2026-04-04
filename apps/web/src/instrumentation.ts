/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * Two responsibilities:
 *  1. Suppress the harmless "Error: aborted" noise in the dev console when
 *     the browser cancels in-flight requests during navigation.
 *  2. Initialise the Autonomous Runner background heartbeat so it starts
 *     automatically if the user had Autonomous Mode enabled.
 */
export async function register() {
    // ── 1. Dev noise suppression ──────────────────────────────────
    if (process.env.NODE_ENV === 'development') {
        const originalWrite = process.stderr.write.bind(process.stderr);

        // @ts-ignore — patching native stream for noise reduction
        process.stderr.write = function (chunk: any, encoding?: any, callback?: any): boolean {
            const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk ?? '');

            // Suppress "aborted" connection errors — these are harmless client disconnections
            if (
                text.includes('Error: aborted') ||
                text.includes('abortIncoming') ||
                (text.includes('aborted') && text.includes('_http_server'))
            ) {
                if (typeof encoding === 'function') encoding(null);
                else if (typeof callback === 'function') callback(null);
                return true;
            }

            return originalWrite(chunk, encoding, callback);
        };
    }

    // ── 2. Autonomous Runner init (Node.js runtime only) ──────────
    // This guard ensures we only run the background loop in the Node.js
    // server process, not in the Edge runtime or during build.
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
            const { initAutonomousRunner } = await import('@/lib/autonomous-runner');
            await initAutonomousRunner();
        } catch (err) {
            // Non-fatal — log and continue server startup
            console.error('[instrumentation] Failed to init autonomous runner:', err);
        }
    }
}
