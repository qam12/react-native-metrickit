import type { DiagnosticEvent } from './types';
import { setBufferSink } from './internal/registry';
import { safeSync } from './safe';

/**
 * Opt-in, capped ring buffer for the debug screen. Off by default; when
 * enabled it captures delivered diagnostics (overwrite-oldest) for inspection
 * only. Not a delivery mechanism and never a leak source. See ARCHITECTURE.md.
 */

const DEFAULT_CAPACITY = 100;

let ring: DiagnosticEvent[] = [];
let capacity = DEFAULT_CAPACITY;
let enabled = false;

function push(events: DiagnosticEvent[]): void {
  if (!enabled) {
    return;
  }
  for (const event of events) {
    ring.push(event);
  }
  if (ring.length > capacity) {
    ring = ring.slice(ring.length - capacity);
  }
}

/** Enable capture with an optional capacity (default 100, overwrite-oldest). */
export function enableBuffer(maxEntries: number = DEFAULT_CAPACITY): void {
  capacity = maxEntries > 0 ? maxEntries : DEFAULT_CAPACITY;
  enabled = true;
  setBufferSink(push);
}

/** Disable capture and drop any retained entries. */
export function disableBuffer(): void {
  enabled = false;
  ring = [];
  setBufferSink(null);
}

/** Snapshot of buffered diagnostics, oldest first. */
export function getBufferedDiagnostics(): DiagnosticEvent[] {
  return safeSync('getBufferedDiagnostics', () => ring.slice(), []);
}

export function clearBuffer(): void {
  ring = [];
}
