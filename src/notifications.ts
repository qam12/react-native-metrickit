import NativeMetrickit from './NativeMetrickit';
import { safeVoid } from './safe';

/**
 * Local diagnostic notifications. Default off; the native side additionally
 * requires consent and only fires on a non-empty drain. See ARCHITECTURE.md.
 */

export function setDiagnosticNotifications(enabled: boolean): void {
  safeVoid('setDiagnosticNotifications', () => {
    NativeMetrickit.setDiagnosticNotifications(enabled);
  });
}
