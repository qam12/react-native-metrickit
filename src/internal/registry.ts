import type {
  DiagnosticEvent,
  DiagnosticListener,
  DiagnosticPlatform,
  Unsubscribe,
} from '../types';
import { safeVoid } from '../safe';

/**
 * Internal fan-out. Holds subscriber callbacks per stream plus an optional
 * buffer sink, and delivers batches to both. Used by `subscriptions` (real
 * events) and `simulate` (injected events). Delivery is crash-isolated: one
 * listener throwing never blocks the others or the host.
 */

type BufferSink = (events: DiagnosticEvent[]) => void;

const listeners: Record<DiagnosticPlatform, Set<DiagnosticListener>> = {
  ios: new Set<DiagnosticListener>(),
  android: new Set<DiagnosticListener>(),
};

let bufferSink: BufferSink | null = null;

export function setBufferSink(sink: BufferSink | null): void {
  bufferSink = sink;
}

export function addListener(
  stream: DiagnosticPlatform,
  listener: DiagnosticListener
): Unsubscribe {
  listeners[stream].add(listener);
  return () => {
    listeners[stream].delete(listener);
  };
}

export function deliver(
  stream: DiagnosticPlatform,
  events: DiagnosticEvent[]
): void {
  if (events.length === 0) {
    return;
  }
  if (bufferSink !== null) {
    const sink = bufferSink;
    safeVoid('buffer.sink', () => sink(events));
  }
  for (const listener of listeners[stream]) {
    safeVoid('listener', () => listener(events));
  }
}
