type PendingOperation<T> = {
  id: string;
  label: string;
  attempts: number;
  maxAttempts: number;
  action: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

export type QueueSnapshot = {
  pending: number;
  lastLabel?: string;
  lastError?: string | null;
  isProcessing: boolean;
};

const getOnlineStatus = () => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
};

class OperationQueue {
  private queue: PendingOperation<unknown>[] = [];
  private listeners = new Set<(state: QueueSnapshot) => void>();
  private lastLabel?: string;
  private lastError: string | null = null;
  private processing = false;

  enqueue<T>(label: string, action: () => Promise<T>, maxAttempts = 3) {
    return new Promise<T>((resolve, reject) => {
      const op: PendingOperation<T> = {
        id: crypto.randomUUID(),
        label,
        attempts: 0,
        maxAttempts,
        action,
        resolve,
        reject,
      };
      this.queue.push(op);
      this.emit();
      this.process();
    });
  }

  subscribe(listener: (state: QueueSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): QueueSnapshot {
    return {
      pending: this.queue.length,
      lastLabel: this.lastLabel,
      lastError: this.lastError,
      isProcessing: this.processing,
    };
  }

  forceProcess() {
    this.process(true);
  }

  private emit() {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private async process(force = false) {
    if (this.processing) return;
    if (!force && !getOnlineStatus()) return;
    if (!this.queue.length) return;
    this.processing = true;
    this.emit();

    while (this.queue.length && (force || getOnlineStatus())) {
      const op = this.queue[0];
      this.lastLabel = op.label;
      try {
        op.attempts += 1;
        const result = await op.action();
        op.resolve(result);
        this.queue.shift();
        this.lastError = null;
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
        if (op.attempts >= op.maxAttempts) {
          op.reject(err);
          this.queue.shift();
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
      this.emit();
    }
    this.processing = false;
    this.emit();
  }
}

export const operationQueue = new OperationQueue();

if (typeof window !== "undefined") {
  window.addEventListener("online", () => operationQueue.forceProcess());
}

export const enqueueWithQueue = <T,>(
  label: string,
  action: () => Promise<T>,
  maxAttempts?: number
) => {
  if (!getOnlineStatus()) {
    return operationQueue.enqueue(label, action, maxAttempts);
  }
  return action();
};
