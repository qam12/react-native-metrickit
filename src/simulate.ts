import { Platform } from 'react-native';
import type { DiagnosticEvent, DiagnosticPlatform } from './types';
import { deliver } from './internal/registry';
import { safeVoid } from './safe';

/**
 * Dev-only test injection. Pushes a synthetic `DiagnosticEvent` through the
 * same delivery path as real diagnostics (subscribers + buffer) so the debug
 * screen shows data immediately, without waiting for a real OS drain. Bypasses
 * the consent gate intentionally — the payload is synthetic, not user data.
 * See ARCHITECTURE.md.
 */

export function simulate(partial: Partial<DiagnosticEvent> = {}): void {
  safeVoid('simulate', () => {
    const platform: DiagnosticPlatform =
      partial.platform ?? (Platform.OS === 'android' ? 'android' : 'ios');

    const event: DiagnosticEvent = {
      platform,
      type: partial.type ?? 'crash',
      timestamp: partial.timestamp ?? Date.now(),
      summary: partial.summary ?? 'Simulated diagnostic (test payload)',
      appVersion: partial.appVersion ?? 'simulated',
      osVersion: partial.osVersion ?? 'simulated',
      raw: partial.raw ?? { simulated: true },
    };
    if (partial.reasonCode !== undefined) {
      event.reasonCode = partial.reasonCode;
    }
    if (partial.callStack !== undefined) {
      event.callStack = partial.callStack;
    }

    deliver(platform, [event]);
  });
}
