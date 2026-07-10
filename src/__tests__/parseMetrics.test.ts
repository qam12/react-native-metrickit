import { describe, expect, it } from '@jest/globals';
import { parseMetricsBatch } from '../internal/parseMetrics';
import metricsFixture from '../__fixtures__/ios-metrics.json';

describe('parseMetricsBatch', () => {
  it('normalizes a captured MXMetricPayload snapshot', () => {
    const snapshots = parseMetricsBatch(JSON.stringify(metricsFixture));
    expect(snapshots).toHaveLength(1);
    const snapshot = snapshots[0];
    expect(snapshot?.platform).toBe('ios');
    expect(snapshot?.cpuTimeMs).toBeCloseTo(543210.5);
    expect(snapshot?.peakMemoryBytes).toBe(268435456);
    expect(snapshot?.backgroundExitCounts?.normalAppExit).toBe(12);
    expect(snapshot?.foregroundExitCounts?.badAccessExit).toBe(1);
  });

  it('drops malformed records and keeps valid ones', () => {
    const json = JSON.stringify([
      null,
      42,
      { appVersion: 'x' }, // missing timestamp -> dropped
      { timestamp: 1719965200000 }, // valid, minimal
    ]);
    const snapshots = parseMetricsBatch(json);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.timestamp).toBe(1719965200000);
  });

  it('keeps only numeric exit counts', () => {
    const json = JSON.stringify([
      { timestamp: 1, backgroundExitCounts: { a: 5, b: 'nope', c: 2 } },
    ]);
    const snapshot = parseMetricsBatch(json)[0];
    expect(snapshot?.backgroundExitCounts).toEqual({ a: 5, c: 2 });
  });

  it('returns [] for non-JSON and non-array input', () => {
    expect(parseMetricsBatch('not json')).toEqual([]);
    expect(parseMetricsBatch('{"a":1}')).toEqual([]);
  });
});
