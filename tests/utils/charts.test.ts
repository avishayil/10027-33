/** The chart kit's arithmetic: bridges close on their total, axis ticks cover the data, colours follow the entity. */
import { describe, expect, it } from 'vitest';
import { bridge, niceTicks, ON_SERIES, SERIES } from '../../src/components/charts/Charts';
import { DEST_COLORS } from '../../src/components/charts/outputs';

describe('bridge', () => {
  it('each step starts where the previous ended; the last end is the sum', () => {
    const b = bridge([
      { label: 'a', value: 2_780_000, text: '' },
      { label: 'b', value: -1_240_000, text: '' },
      { label: 'c', value: -36_000, text: '' },
    ]);
    expect(b.map((x) => [x.from, x.to])).toEqual([
      [0, 2_780_000],
      [2_780_000, 1_540_000],
      [1_540_000, 1_504_000],
    ]);
  });
});

describe('niceTicks', () => {
  for (const [lo, hi] of [
    [0, 800_000],
    [0, 1],
    [-250_000, 1_300_000],
    [0, 27_950_000],
  ] as const)
    it(`${lo}..${hi}: clean steps that cover the range`, () => {
      const t = niceTicks(lo, hi, 4);
      expect(t[0]).toBeLessThanOrEqual(lo);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(hi);
      const step = t[1] - t[0];
      const mag = Math.pow(10, Math.floor(Math.log10(step)));
      expect([1, 2, 2.5, 5, 10]).toContain(Math.round((step / mag) * 10) / 10);
      for (let i = 1; i < t.length; i += 1) expect(t[i] - t[i - 1]).toBeCloseTo(step, 6);
    });
});

describe('colours', () => {
  it('each rights destination has its own fixed colour from the validated order', () => {
    const cs = Object.values(DEST_COLORS);
    expect(new Set(cs).size).toBe(cs.length);
    for (const c of cs) expect(SERIES).toContain(c);
  });
  it('text inside a fill takes the higher-contrast ink: dark on light fills, white on dark ones', () => {
    expect(ON_SERIES('#f2a600')).toBe('#0b0b0b'); // yellow
    expect(ON_SERIES('#ee7fac')).toBe('#0b0b0b'); // magenta
    expect(ON_SERIES('#0f4a96')).toBe('#ffffff'); // dark blue
    expect(ON_SERIES('#6a4ce2')).toBe('#ffffff'); // violet
  });
});
