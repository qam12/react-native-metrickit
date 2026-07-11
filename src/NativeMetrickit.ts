/**
 * react-native-metrickit
 * TurboModule spec (codegen).
 *
 * @author Qamber Haider <qamb565@gmail.com>
 * @license MIT
 * @see https://github.com/qam12/react-native-metrickit
 */

import { TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * TurboModule contract. Diagnostic batches cross the bridge as JSON strings so
 * the arbitrary `raw` payload survives codegen's concrete-type constraint; the
 * JS layer parses them into `DiagnosticEvent[]`. The consent gate is applied
 * natively before any batch is returned.
 */
export interface Spec extends TurboModule {
  /** Gate all emission. Defaults to off (false) until explicitly enabled. */
  setConsent(consent: boolean): void;

  /** Toggle local notification on a non-empty diagnostic drain. Default off. */
  setDiagnosticNotifications(enabled: boolean): void;

  /**
   * Drain pending iOS MetricKit diagnostics as a JSON array string.
   * Returns "[]" when unavailable (iOS < 14), without consent, or when empty.
   */
  getIOSDiagnostics(): Promise<string>;

  /**
   * Drain new Android `ApplicationExitInfo` records (advancing the last-seen
   * cursor) as a JSON array string. Returns "[]" when unavailable (API < 30),
   * without consent, or when there is nothing new.
   */
  getAndroidExitInfo(): Promise<string>;

  /**
   * Drain pending iOS MetricKit metrics (`MXMetricPayload`) as a JSON array
   * string. Returns "[]" when unavailable (iOS-only), without consent, or empty.
   */
  getIOSMetrics(): Promise<string>;

  /** Required for NativeEventEmitter; native buffers/drains regardless. */
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Metrickit');
