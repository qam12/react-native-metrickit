import { beforeEach, describe, expect, it } from '@jest/globals';
import { disableBuffer, enableBuffer, getBufferedDiagnostics } from '../buffer';
import { deliver } from '../internal/registry';
import type { DiagnosticEvent } from '../types';

function event(timestamp: number): DiagnosticEvent {
  return {
    platform: 'ios',
    type: 'crash',
    timestamp,
    summary: 'test',
    appVersion: '1',
    osVersion: '1',
    raw: {},
  };
}

describe('buffer', () => {
  beforeEach(() => {
    disableBuffer();
  });

  it('captures delivered events once enabled', () => {
    enableBuffer(10);
    deliver('ios', [event(1), event(2)]);
    expect(getBufferedDiagnostics()).toHaveLength(2);
  });

  it('overwrites oldest beyond capacity', () => {
    enableBuffer(2);
    deliver('ios', [event(1), event(2), event(3)]);
    const buffered = getBufferedDiagnostics();
    expect(buffered.map((e) => e.timestamp)).toEqual([2, 3]);
  });

  it('captures nothing while disabled', () => {
    deliver('ios', [event(1)]);
    expect(getBufferedDiagnostics()).toEqual([]);
  });
});
