export interface ProgressBatcherOptions<K, V> {
  intervalMs: number;
  onFlush: (events: Array<[K, V]>) => void;
  setTimeout?: (callback: () => void, delay: number) => number;
  clearTimeout?: (timerId: number) => void;
}

export interface ProgressBatcher<K, V> {
  enqueue: (key: K, value: V) => void;
  flush: () => void;
  dispose: () => void;
}

export function createProgressBatcher<K, V>({
  intervalMs,
  onFlush,
  setTimeout: schedule = (callback, delay) =>
    window.setTimeout(callback, delay),
  clearTimeout: cancel = (timerId) => window.clearTimeout(timerId),
}: ProgressBatcherOptions<K, V>): ProgressBatcher<K, V> {
  let pending = new Map<K, V>();
  let timerId: number | null = null;

  const flush = () => {
    timerId = null;
    if (pending.size === 0) {
      return;
    }

    const events = Array.from(pending.entries());
    pending = new Map();
    onFlush(events);
  };

  return {
    enqueue(key, value) {
      pending.set(key, value);
      if (timerId === null) {
        timerId = schedule(flush, intervalMs);
      }
    },
    flush,
    dispose() {
      if (timerId !== null) {
        cancel(timerId);
        timerId = null;
      }
      pending.clear();
    },
  };
}
