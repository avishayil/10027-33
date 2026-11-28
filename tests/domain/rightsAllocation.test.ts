/**
 * Every output uses all the owner's land rights: each route accounts for its entitlement (plus any rights bought)
 * across the destinations — combination with the developer, sold to the developer, sold on the open market (now or
 * after approval), built with construction services, revenue share, or kept as land. Nothing is left unaccounted.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { rightsAllocation } from '../../src/domain/rightsAllocation';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { C_SIM } from '../fixtures/configs';
import { profile, TERMS } from '../fixtures/profiles';

const check = (landAreaSqm: number, cap: number, rep: number, cfg = C, pct = 0.35) => {
  const d = analyzeProfile(profile({ landAreaSqm, availableCapital: cap, maxMonthlyRepayment: rep }), { ...TERMS, combinationPct: pct }, cfg);
  const R = d.rights.apartmentEquivalents;
  for (const r of d.results) {
    const a = rightsAllocation(r, R);
    const total = a.parts.reduce((s, p) => s + p.rights, 0);
    expect(total, `${r.id}: destinations ${total} vs rights ${a.total}`).toBeCloseTo(a.total, 9);
    expect(a.total).toBeCloseTo(R + r.plan.rightsPurchased, 9);
    expect(a.unaccounted).toBeCloseTo(0, 9);
    for (const p of a.parts) expect(p.rights).toBeGreaterThan(0);
  }
  return d;
};

describe('rights allocation', () => {
  it('representative holdings, both entitlement bases: every route accounts for all rights', () => {
    for (const cfg of [C, C_SIM]) {
      check(167, 300_000, 5000, cfg);
      check(83.5, 2_000_000, 15_000, cfg);
      check(300, 3_000_000, 20_000, cfg);
      check(60, 1_500_000, 10_000, cfg);
    }
  });
  it('property: any valid holding, means and combination %', () => {
    fc.assert(
      fc.property(fc.double({ min: 20, max: 900, noNaN: true }), fc.integer({ min: 0, max: 3_000_000 }), fc.integer({ min: 0, max: 20_000 }), fc.double({ min: 0.25, max: 0.45, noNaN: true }), (a, cap, rep, pct) => {
        check(a, cap, rep, C, pct);
      }),
      { numRuns: 25 },
    );
  });
  it('sales are split by buyer, and add up to the rights sold', () => {
    const d = check(167, 300_000, 5000);
    const R = d.rights.apartmentEquivalents;
    for (const r of d.results) {
      const a = rightsAllocation(r, R);
      const sold = a.parts.filter((p) => p.kind.startsWith('sold_')).reduce((s, p) => s + p.rights, 0);
      expect(sold).toBeCloseTo(r.plan.rightsSold, 9);
    }
    const s01 = d.results.find((r) => r.strategyType === 'S01')!;
    expect(rightsAllocation(s01, R).parts.map((p) => p.kind)).toEqual(['sold_developer']);
    const s01m = d.results.find((r) => r.strategyType === 'S01M')!;
    expect(rightsAllocation(s01m, R).parts.map((p) => p.kind)).toEqual(['sold_open_market']);
  });
  it('rights bought from other owners are shown as coming in, and used', () => {
    const d = check(60, 1_500_000, 10_000);
    const s10 = d.results.find((r) => r.strategyType === 'S10' && r.plan.rightsPurchased > 0);
    if (s10) {
      const a = rightsAllocation(s10, d.rights.apartmentEquivalents);
      expect(a.bought).toBeCloseTo(s10.plan.rightsPurchased, 9);
      expect(a.total).toBeCloseTo(d.rights.apartmentEquivalents + a.bought, 9);
    }
  });
});
