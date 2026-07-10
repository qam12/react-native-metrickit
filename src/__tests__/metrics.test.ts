import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../NativeMetrickit', () => ({
  __esModule: true,
  default: {
    getIOSMetrics: jest.fn(),
    getIOSDiagnostics: jest.fn(),
    getAndroidExitInfo: jest.fn(),
    setConsent: jest.fn(),
    setDiagnosticNotifications: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  },
}));

import NativeMetrickit from '../NativeMetrickit';
import { onIOSMetrics } from '../metrics';
import metricsFixture from '../__fixtures__/ios-metrics.json';
import type { MetricSnapshot } from '../types';

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

describe('onIOSMetrics', () => {
  it('drains metrics on subscribe (iOS) and delivers snapshots', async () => {
    jest
      .mocked(NativeMetrickit.getIOSMetrics)
      .mockResolvedValue(JSON.stringify(metricsFixture));
    const received: MetricSnapshot[] = [];
    const off = onIOSMetrics((batch) => received.push(...batch));
    await flush();
    off();

    expect(NativeMetrickit.getIOSMetrics).toHaveBeenCalled();
    expect(received).toHaveLength(1);
    expect(received[0]?.backgroundExitCounts?.normalAppExit).toBe(12);
  });
});
