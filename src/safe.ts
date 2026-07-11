/**
 * Crash-free guarantee (JS side). Every public method routes through one of
 * these wrappers so an internal failure degrades to a benign fallback plus a
 * log, and never throws into the host app. See `diagnostic-event-contract`.
 */

const TAG = '[react-native-metrickit]';

/** Shared no-op, used for benign unsubscribe handles on unsupported platforms. */
export function noop(): void {
  /* intentional no-op */
}

export function logError(context: string, error: unknown): void {
  console.warn(`${TAG} ${context} failed (ignored):`, error);
}

/** Run a synchronous body; on any throw, log and return `fallback`. */
export function safeSync<T>(context: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (error) {
    logError(context, error);
    return fallback;
  }
}

/** Run a synchronous body whose result is discarded; swallow any throw. */
export function safeVoid(context: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    logError(context, error);
  }
}

/** Await an async body; on any rejection/throw, log and resolve `fallback`. */
export async function safeAsync<T>(
  context: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(context, error);
    return fallback;
  }
}
