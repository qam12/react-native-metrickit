import NativeMetrickit from './NativeMetrickit';
import { safeVoid } from './safe';

/**
 * Consent gate. Defaults to off — nothing leaves native until the host app
 * grants consent. The authoritative gate lives natively (applied before any
 * batch is returned); this mirror is forwarded on every call and kept for
 * introspection. See ARCHITECTURE.md.
 */

let granted = false;

export function setConsent(consent: boolean): void {
  safeVoid('setConsent', () => {
    granted = consent;
    NativeMetrickit.setConsent(consent);
  });
}

export function hasConsent(): boolean {
  return granted;
}
