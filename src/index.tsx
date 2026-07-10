export type {
  DiagnosticEvent,
  DiagnosticListener,
  DiagnosticPlatform,
  DiagnosticType,
  MetricExitCounts,
  MetricListener,
  MetricSnapshot,
  Unsubscribe,
} from './types';

export { onIOSDiagnostics, onAndroidExitInfo } from './subscriptions';
export { onIOSMetrics } from './metrics';
export { setConsent, hasConsent } from './consent';
export { setDiagnosticNotifications } from './notifications';
export {
  enableBuffer,
  disableBuffer,
  getBufferedDiagnostics,
  clearBuffer,
} from './buffer';
export { simulate } from './simulate';
