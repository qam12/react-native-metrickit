import { describe, expect, it } from '@jest/globals';
import { simulate } from '../simulate';
import { addListener } from '../internal/registry';
import type { DiagnosticEvent } from '../types';

describe('simulate', () => {
  it('delivers a synthetic event to subscribers of the same platform', () => {
    const received: DiagnosticEvent[] = [];
    const off = addListener('ios', (batch) => received.push(...batch));
    simulate({ platform: 'ios', type: 'hang', summary: 'boom' });
    off();

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      platform: 'ios',
      type: 'hang',
      summary: 'boom',
    });
  });

  it('fills sensible defaults', () => {
    const received: DiagnosticEvent[] = [];
    const off = addListener('ios', (batch) => received.push(...batch));
    simulate({ platform: 'ios' });
    off();

    expect(received[0]?.type).toBe('crash');
    expect(typeof received[0]?.timestamp).toBe('number');
    expect(received[0]?.appVersion).toBe('simulated');
  });
});
