import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../NativeMetrickit', () => ({
  __esModule: true,
  default: {
    setConsent: jest.fn(),
    setDiagnosticNotifications: jest.fn(),
    getIOSDiagnostics: jest.fn(),
    getAndroidExitInfo: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

import NativeMetrickit from '../NativeMetrickit';
import { hasConsent, setConsent } from '../consent';
import { setDiagnosticNotifications } from '../notifications';

describe('consent + notifications', () => {
  it('forwards consent to native and mirrors the state', () => {
    setConsent(true);
    expect(jest.mocked(NativeMetrickit.setConsent)).toHaveBeenCalledWith(true);
    expect(hasConsent()).toBe(true);

    setConsent(false);
    expect(hasConsent()).toBe(false);
  });

  it('forwards the notifications toggle to native', () => {
    setDiagnosticNotifications(true);
    expect(
      jest.mocked(NativeMetrickit.setDiagnosticNotifications)
    ).toHaveBeenCalledWith(true);
  });
});
