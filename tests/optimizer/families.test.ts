/** The summary shows one route per deal family and never assumes a requested apartment size. */
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
      expect(x.r.strategyType).not.toBe('S13');
      expect(FAMILY_OF[x.r.strategyType]).toBe(x.family);
    }
    // Every family the engine evaluated appears once.
    const evaluated = new Set(d.results.map((r) => FAMILY_OF[r.strategyType]).filter(Boolean));
    expect(new Set(families)).toEqual(evaluated);
    // Fitting routes come first.
    const firstNonFit = p.findIndex((x) => x.kind !== 'fits');
    if (firstNonFit >= 0) expect(p.slice(firstNonFit).every((x) => x.kind !== 'fits')).toBe(true);
  });
});
