import { Platform } from 'react-native';
import NativeMetrickit from './NativeMetrickit';
import type { MetricListener, Unsubscribe } from './types';
import { parseMetricsBatch } from './internal/parseMetrics';
import { noop, safeAsync, safeVoid } from './safe';

/**
 * The iOS metrics stream. Surfaces MetricKit `MXMetricPayload` snapshots via
 * `onIOSMetrics`. Pull-based and consent-gated (natively), batched ~daily like
 * the diagnostics streams. iOS-only; a no-op elsewhere. See ARCHITECTURE.md.
 */

const listeners = new Set<MetricListener>();

async function drainMetrics(): Promise<void> {
  const json = await safeAsync(
    'getIOSMetrics',
    () => NativeMetrickit.getIOSMetrics(),
    '[]'
  );
  const metrics = parseMetricsBatch(json);
  if (metrics.length === 0) {
    return;
  }
  for (const listener of listeners) {
    safeVoid('metricListener', () => listener(metrics));
  }
}

export function onIOSMetrics(listener: MetricListener): Unsubscribe {
  if (Platform.OS !== 'ios') {
    return noop;
  }

  listeners.add(listener);
  // Drain whatever MetricKit already delivered before this subscription.
  drainMetrics();

  return () => {
    listeners.delete(listener);
  };
}
