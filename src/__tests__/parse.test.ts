import { describe, expect, it } from '@jest/globals';
import { parseDiagnosticBatch } from '../internal/parse';
import iosFixture from '../__fixtures__/ios-diagnostics.json';
import androidFixture from '../__fixtures__/android-exit-info.json';
import malformedFixture from '../__fixtures__/malformed.json';

describe('parseDiagnosticBatch', () => {
  it('normalizes a captured iOS diagnostic batch', () => {
    const events = parseDiagnosticBatch(JSON.stringify(iosFixture), 'ios');
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      platform: 'ios',
      type: 'crash',
      reasonCode: 11,
    });
    expect(typeof events[0]?.callStack).toBe('string');
    expect(events[1]).toMatchObject({ type: 'hang' });
    expect(events[1]?.callStack).toBeUndefined();
  });

  it('normalizes a captured Android ApplicationExitInfo batch', () => {
    const events = parseDiagnosticBatch(
      JSON.stringify(androidFixture),
      'android'
    );
    expect(events.map((e) => e.type)).toEqual(['anr', 'native-crash']);
    expect(events[0]).toMatchObject({ platform: 'android', reasonCode: 6 });
  });

  it('drops malformed records and coerces unknown types to "other"', () => {
    const events = parseDiagnosticBatch(
      JSON.stringify(malformedFixture),
      'ios'
    );
    // Only the final well-formed (but unknown-type) record survives.
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('other');
  });

  it('returns [] for non-JSON input', () => {
    expect(parseDiagnosticBatch('this is not json', 'ios')).toEqual([]);
  });

  it('returns [] for JSON that is not an array', () => {
    expect(parseDiagnosticBatch('{"not":"an array"}', 'android')).toEqual([]);
  });
});
