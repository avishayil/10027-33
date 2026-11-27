/**
 * The summary shows one route per deal family. Since iteration 6 a whole smaller apartment (S13) is shown on the
 * combination + payment card when it is the best way there — always marked as depending on inventory.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { FAMILY_OF, priorityRoutes } from '../../src/optimizer/families';
import type { Goal } from '../../src/domain/types';
import { TERMS, profile } from '../fixtures/profiles';

const cases: { area: number; cap: number; rep: number; goal: Goal; sole?: boolean }[] = [];
for (const area of [167, 334, 500])
  for (const cap of [0, 250_000, 1_000_000])
    for (const rep of [0, 4000, 10000])
      for (const goal of ['balanced', 'maximize_apartments', 'minimize_risk'] as Goal[]) cases.push({ area, cap, rep, goal, sole: area === 334 ? true : undefined });

describe('summary priorities by deal family', () => {
  it.each(cases)('$area m², ₪$cap, ₪$rep/month, $goal', ({ area, cap, rep, goal, sole }) => {
    const d = analyzeProfile(profile({ landAreaSqm: area, availableCapital: cap, maxMonthlyRepayment: rep, goal, soleHome: sole }), TERMS, C);
    const p = priorityRoutes(d, goal);
    const families = p.map((x) => x.family);
    expect(new Set(families).size).toBe(families.length);
    expect(p.length).toBeLessThanOrEqual(4);
    for (const x of p) {
      if (x.r.strategyType === 'S13') expect(x.family).toBe('combination_paid');
      expect(FAMILY_OF[x.r.strategyType]).toBe(x.family);
    }
    // Variants: other payment methods for the same apartments, only on the combination + payment card.
    for (const x of p) {
      if (x.family !== 'combination_paid') expect(x.variants).toEqual([]);
      const types = new Set([x.r.strategyType, ...x.variants.map((v) => v.r.strategyType)]);
      expect(types.size).toBe(1 + x.variants.length);
      for (const v of x.variants) {
        expect(v.family).toBe(x.family);
        expect(v.r.metrics.wholeApartments).toBe(x.r.metrics.wholeApartments);
      }
    }
    // Every family the engine evaluated appears once.
    const evaluated = new Set(d.results.map((r) => FAMILY_OF[r.strategyType]).filter(Boolean));
    expect(new Set(families)).toEqual(evaluated);
    // Fitting routes come first.
    const firstNonFit = p.findIndex((x) => x.kind !== 'fits');
    if (firstNonFit >= 0) expect(p.slice(firstNonFit).every((x) => x.kind !== 'fits')).toBe(true);
  });
});

it('167 m²: completion and construction services are one card, not two', () => {
  const d = analyzeProfile(profile({ landAreaSqm: 167, availableCapital: 500_000, maxMonthlyRepayment: 4000, goal: 'balanced' }), TERMS, C);
  const p = priorityRoutes(d, 'balanced');
  const paid = p.filter((x) => x.family === 'combination_paid');
  expect(paid).toHaveLength(1);
  const types = [paid[0].r.strategyType, ...paid[0].variants.map((v) => v.r.strategyType)];
  expect(types).toEqual(expect.arrayContaining(['S06', 'S11']));
});

describe('a smaller whole apartment is shown when it is the best way to one (review §10)', () => {
  it('167 m², ₪800K: the 3-room route appears on the combination + payment card', () => {
    const d = analyzeProfile(profile({ availableCapital: 800_000, maxMonthlyRepayment: 5000 }), TERMS, C);
    const card = priorityRoutes(d, 'balanced').find((x) => x.family === 'combination_paid')!;
    const types = [card.r.strategyType, ...card.variants.map((v) => v.r.strategyType)];
    expect(types).toContain('S13');
  });
});
