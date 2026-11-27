/** Iteration 9 / phase F: contracts with an option — values per state and regret, no probabilities. */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { contingentPlan } from '../../src/optimizer/contingent';
import { profile, TERMS } from '../fixtures/profiles';

describe('contingent plan', () => {
  const p = profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 });
  const d = analyzeProfile(p, TERMS, C);
  const c = contingentPlan(d, p, TERMS, C);
  it('the fallback is the full combination and appears as a fixed row', () => {
    expect(['S02', 'S02P']).toContain(c.fallbackId);
    expect(c.rows.some((r) => r.routeId === c.fallbackId && r.optionRouteId === null)).toBe(true);
  });
  it('regret is zero for the best choice in each state and never negative', () => {
    for (const state of ['regretFinanced', 'regretNoFinancing'] as const) {
      const vals = c.rows.map((r) => r[state]).filter((x): x is number => x !== null);
      if (!vals.length) continue;
      expect(Math.min(...vals)).toBeCloseTo(0, 6);
      for (const v of vals) expect(v).toBeGreaterThanOrEqual(-1e-6);
    }
  });
  it('an option row takes the target route when financed and the combination otherwise', () => {
    const fb = c.rows.find((r) => r.routeId === c.fallbackId && r.optionRouteId === null)!;
    for (const o of c.rows.filter((r) => r.optionRouteId)) {
      const target = c.rows.find((r) => r.routeId === o.optionRouteId && r.optionRouteId === null)!;
      expect(o.financed).toBeCloseTo(target.financed!, 6);
      expect(o.noFinancing).toBe(fb.noFinancing);
      expect(o.noApprovalExposure).toBe(fb.noApprovalExposure);
    }
  });
  it('rows are ordered by largest regret', () => {
    for (let i = 1; i < c.rows.length; i += 1) expect(c.rows[i].maxRegret).toBeGreaterThanOrEqual(c.rows[i - 1].maxRegret);
  });
});
