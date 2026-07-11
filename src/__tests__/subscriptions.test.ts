import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../NativeMetrickit', () => ({
  __esModule: true,
  default: {
    getIOSDiagnostics: jest.fn(),
    getAndroidExitInfo: jest.fn(),
    setConsent: jest.fn(),
    setDiagnosticNotifications: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

import NativeMetrickit from '../NativeMetrickit';
import { onAndroidExitInfo, onIOSDiagnostics } from '../subscriptions';
import iosFixture from '../__fixtures__/ios-diagnostics.json';
import type { DiagnosticEvent } from '../types';

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

describe('subscriptions', () => {
  beforeEach(() => {
    jest.mocked(NativeMetrickit.getIOSDiagnostics).mockReset();
    jest.mocked(NativeMetrickit.getAndroidExitInfo).mockReset();
  });

  it('drains pending iOS diagnostics on subscribe', async () => {
    jest
      .mocked(NativeMetrickit.getIOSDiagnostics)
      .mockResolvedValue(JSON.stringify(iosFixture));
    const received: DiagnosticEvent[] = [];
    const off = onIOSDiagnostics((batch) => received.push(...batch));
    await flush();
    off();

    expect(NativeMetrickit.getIOSDiagnostics).toHaveBeenCalled();
    expect(received).toHaveLength(2);
    expect(received[0]?.platform).toBe('ios');
  });

  it('is a safe no-op for the Android stream while running on iOS', () => {
    const off = onAndroidExitInfo(() => {
      throw new Error('should not be invoked on iOS');
    });
    off();
    expect(NativeMetrickit.getAndroidExitInfo).not.toHaveBeenCalled();
  });
});
