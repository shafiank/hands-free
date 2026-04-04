// ============================================================
// Hands Free Message Queue â€” v1.0
// ============================================================
// In-memory FIFO queue for serializing LLM requests.
// Prevents race conditions when multiple messages arrive
// while a previous request is still being processed.
//
// Usage:
//   Server-side (Telegram/WhatsApp): Import and use the singleton.
//   Browser: Uses React state (see chat/page.tsx).
//
// Max queue size: 20 messages (configurable via MAX_QUEUE_SIZE).
// ============================================================

export interface QueueItem {
    id: string;
    message: string;
    source: 'chat' | 'telegram' | 'whatsapp';
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface QueueStatus {
    isProcessing: boolean;
    queueLength: number;
    items: Array<{
        id: string;
        message: string; // truncated to 50 chars
        source: QueueItem['source'];
        timestamp: number;
    }>;
}

export interface AddResult {
    success: boolean;
    position: number;  // 1-based position in queue (0 = not queued / error)
    id?: string;
    error?: string;
}

const MAX_QUEUE_SIZE = 20;

// â”€â”€â”€ Combine multiple AbortSignals into one â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Uses AbortSignal.any() (Node 20+) for clean multi-signal support.
export function combineAbortSignals(...signals: (AbortSignal | undefined | null)[]): AbortSignal {
    const valid = signals.filter((s): s is AbortSignal => s != null);
    if (valid.length === 0) return AbortSignal.timeout(90_000);
    if (valid.length === 1) return valid[0];
    return AbortSignal.any(valid);
}

// â”€â”€â”€ MessageQueue Singleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class MessageQueue {
    private _queue: QueueItem[] = [];
    private _isProcessing = false;
    private _currentAbortController: AbortController | null = null;

    // â”€â”€ State Accessors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    get isProcessing(): boolean {
        return this._isProcessing;
    }

    get length(): number {
        return this._queue.length;
    }

    // â”€â”€ Queue Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Add a message to the queue.
     * Returns the 1-based position in queue, or an error if queue is full.
     */
    add(
        message: string,
        source: QueueItem['source'],
        metadata?: Record<string, unknown>
    ): AddResult {
        if (this._queue.length >= MAX_QUEUE_SIZE) {
            return {
                success: false,
                position: 0,
                error: `Queue is full (max ${MAX_QUEUE_SIZE} messages). Please wait for the current messages to be processed.`,
            };
        }

        const item: QueueItem = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            message,
            source,
            timestamp: Date.now(),
            metadata,
        };

        this._queue.push(item);

        return {
            success: true,
            position: this._queue.length,
            id: item.id,
        };
    }

    /**
     * Remove and return the next message from the front of the queue.
     * Returns null if the queue is empty.
     */
    next(): QueueItem | null {
        return this._queue.shift() ?? null;
    }

    /**
     * Peek at the next message without removing it.
     */
    peek(): QueueItem | null {
        return this._queue[0] ?? null;
    }

    /**
     * Remove a specific message by ID (e.g., user clicks "X" on a queued item).
     * Returns true if the item was found and removed.
     */
    cancel(id: string): boolean {
        const before = this._queue.length;
        this._queue = this._queue.filter(item => item.id !== id);
        return this._queue.length < before;
    }

    /**
     * Clear all queued messages.
     */
    clearAll(): void {
        this._queue = [];
    }

    // â”€â”€ Processing State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /**
     * Mark that processing has started.
     * Optionally pass an AbortController to enable cancelCurrent().
     */
    setProcessing(value: boolean, abortController?: AbortController): void {
        this._isProcessing = value;
        if (value && abortController) {
            this._currentAbortController = abortController;
        } else if (!value) {
            this._currentAbortController = null;
        }
    }

    /**
     * Abort the currently running LLM request.
     * Returns true if a request was aborted, false if nothing was running.
     */
    cancelCurrent(): boolean {
        if (this._currentAbortController) {
            this._currentAbortController.abort('User cancelled');
            this._currentAbortController = null;
            return true;
        }
        return false;
    }

    /**
     * Cancel the current request AND clear all queued messages.
     */
    cancelAll(): void {
        this.cancelCurrent();
        this.clearAll();
        this._isProcessing = false;
    }

    // â”€â”€ Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    getStatus(): QueueStatus {
        return {
            isProcessing: this._isProcessing,
            queueLength: this._queue.length,
            items: this._queue.map(item => ({
                id: item.id,
                message: item.message.length > 50
                    ? item.message.slice(0, 50) + 'â€¦'
                    : item.message,
                source: item.source,
                timestamp: item.timestamp,
            })),
        };
    }
}

// â”€â”€â”€ Singleton export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// One shared instance for the entire Node.js process lifetime.
// This ensures all Telegram route handlers share the same state.
export const telegramQueue = new MessageQueue();

// Named export of the class for testing or custom instances
export { MessageQueue };
