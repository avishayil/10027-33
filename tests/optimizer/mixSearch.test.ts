/** Iteration 9 / D1: the apartment-mix search keeps the cash-positive and the no-payment options, not only the closest. */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { calculateRights } from '../../src/domain/rights';
import { generateStrategies, keepMixes } from '../../src/optimizer/generate';
import { TERMS } from '../fixtures/profiles';

const rel = (r: number) => C.market.apartmentTypes.find((t) => t.rooms === r)!.relativeValue;
const value = (m: number[]) => m.reduce((s, r) => s + rel(r), 0);

describe('keepMixes', () => {
  const mixes = [[3, 3, 3], [3, 3, 4], [3, 3, 5], [3, 4, 4], [3, 4, 5], [3, 5, 5], [4, 4, 4], [4, 4, 5], [4, 5, 5], [5, 5, 5]];
  const finished = 2.9;
  const kept = keepMixes(mixes, value, finished);
  it('keeps the cheapest (most money back) and the most valuable mix', () => {
    expect(kept).toContainEqual([3, 3, 3]);
    expect(kept).toContainEqual([5, 5, 5]);
  });
  it('keeps the most valuable mix that needs no payment', () => {
    const best = mixes.filter((m) => value(m) <= finished).sort((a, b) => value(b) - value(a))[0];
    expect(kept).toContainEqual(best);
  });
  it('at most seven, no duplicates', () => {
    expect(kept.length).toBeLessThanOrEqual(7);
    expect(new Set(kept.map((m) => m.join())).size).toBe(kept.length);
  });
  it('few mixes: all kept', () => {
    expect(keepMixes(mixes.slice(0, 3), value, finished)).toHaveLength(3);
  });
});

describe('generated candidates', () => {
  it('exact integer entitlement (3 rights at 1/3 ≈ 1 apartment) still offers mixes; ids are unique', () => {
    const info = calculateRights((3 / 2.25) * 167, C);
    const cands = generateStrategies(info, { ...TERMS, combinationPct: 1 / 3 }, C);
    expect(new Set(cands.map((c) => c.id)).size).toBe(cands.length);
  });
  it('a large holding can reach two apartments more than its whole entitlement when the value window allows it', () => {
    const info = calculateRights(1000, C);
    const cands = generateStrategies(info, TERMS, C);
    const whole = Math.floor(info.apartmentEquivalents * TERMS.combinationPct + 1e-9);
    const counts = cands.filter((c) => c.id.startsWith('S13-') && c.id.includes('+')).map((c) => c.targetApartments);
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(whole + 1);
  });
});
