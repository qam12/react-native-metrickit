'use strict';

const {
  parseArgs,
  flattenFrames,
  extractBinaryUUIDs,
  normalizeUUID,
  parseCallStackTree,
} = require('../rn-metrickit-symbolicate.js');

describe('symbolicate helpers', () => {
  test('parseArgs reads flags and defaults arch to arm64', () => {
    const opts = parseArgs([
      '--input',
      'e.json',
      '-p',
      'ios',
      '--dsym',
      'A.dSYM',
    ]);
    expect(opts.input).toBe('e.json');
    expect(opts.platform).toBe('ios');
    expect(opts.dsym).toBe('A.dSYM');
    expect(opts.arch).toBe('arm64');
  });

  test('parseArgs throws on unknown flags', () => {
    expect(() => parseArgs(['--nope'])).toThrow(/unknown argument/);
  });

  test('flattenFrames walks subframes and extractBinaryUUIDs dedupes/normalizes', () => {
    const tree = {
      callStacks: [
        {
          callStackRootFrames: [
            {
              binaryUUID: 'aabbccdd-1122',
              offsetIntoBinaryTextSegment: 1,
              subFrames: [
                { binaryUUID: 'AABBCCDD1122', offsetIntoBinaryTextSegment: 2 },
              ],
            },
          ],
        },
      ],
    };
    expect(flattenFrames(tree)).toHaveLength(2);
    expect(extractBinaryUUIDs(tree)).toEqual(['AABBCCDD1122']);
  });

  test('normalizeUUID strips dashes and upper-cases', () => {
    expect(normalizeUUID('aa-bb-cc')).toBe('AABBCC');
  });

  test('parseCallStackTree handles JSON strings and bad input', () => {
    expect(parseCallStackTree('{"callStacks":[]}')).toEqual({ callStacks: [] });
    expect(parseCallStackTree('not json')).toBeNull();
    expect(parseCallStackTree(null)).toBeNull();
  });
});
