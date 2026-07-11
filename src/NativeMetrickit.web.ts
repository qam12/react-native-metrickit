import type { Spec } from './NativeMetrickit';
import { noop } from './safe';

/**
 * Web stub.
 *
 * Neither MetricKit nor `ApplicationExitInfo` exists on the web, and
 * `react-native-web` does not export `TurboModuleRegistry` — so importing the
 * real spec would break any web bundle. Web bundlers resolve `.web.ts` ahead of
 * `.ts`, so this inert implementation is used there while native builds keep
 * using `NativeMetrickit.ts` (the codegen spec).
 *
 * Every method is a safe no-op: drains return an empty JSON batch, so the JS
 * layer delivers nothing and the package is simply inert on web.
 */
const NativeMetrickitWeb: Spec = {
  setConsent: noop,
  setDiagnosticNotifications: noop,
  getIOSDiagnostics: () => Promise.resolve('[]'),
  getAndroidExitInfo: () => Promise.resolve('[]'),
  getIOSMetrics: () => Promise.resolve('[]'),
  addListener: noop,
  removeListeners: noop,
};

export default NativeMetrickitWeb;
