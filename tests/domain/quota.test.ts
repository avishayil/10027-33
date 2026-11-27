/** Iteration 9 / F02: the construction-services quota is counted in whole apartment slots on both sides. */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { lotDeveloperPnL, quotaSlots, quotaUse } from '../../src/domain/lotDeveloper';
import { lotPolicy, serviceApartments } from '../../src/domain/policy';
import { calculateRights } from '../../src/domain/rights';
import { mixedSplit } from '../../src/optimizer/generate';
import { MODERATE, TERMS } from '../fixtures/profiles';

const info = calculateRights(167, C, '149');
const ctx = { info, profile: MODERATE, config: C };

describe('quota slots', () => {
  it('lot 149: ⌊25% × 102⌋ = 25, the same number the policy shows', () => {
    expect(quotaSlots(C, 102)).toBe(25);
    expect(lotPolicy(info, C).capUnits).toBe(25);
  });
  it('a partial S11 apartment (0.326923 built) takes one whole slot', () => {
    const x = mixedSplit(1, 2.25, 0.35);
    const s11 = { id: 'S11-1', type: 'S11' as const, targetApartments: 1, legs: [{ kind: 'combination' as const, rights: 2.25 - x }, { kind: 'build' as const, apartments: x, ownRightsUsed: x, purchasedRightsUsed: 0 }] };
    expect(serviceApartments(s11)).toBe(1);
  });
  it('full quota: the user displaces exactly one typical participant, who moves into combination', () => {
    const u = quotaUse(C, 102, 1, 1);
    expect(u).toEqual({ quota: 25, typical: 24, user: 1, displaced: 1, free: 0 });
    const base = lotDeveloperPnL(ctx, 'mixed', TERMS.combinationPct, { participation: 1 });
    const withUser = lotDeveloperPnL(ctx, 'mixed', TERMS.combinationPct, { participation: 1, userServicesUnits: 1 });
    expect(base.servicesUnits).toBe(25);
    expect(withUser.servicesUnits).toBe(24);
    // The displaced slot's area goes to combination: owners' + developer's combination units grow by one unit.
    expect(withUser.ownerCombinationUnits + withUser.developerUnits).toBeCloseTo(base.ownerCombinationUnits + base.developerUnits + 1, 9);
  });
  it('spare quota: the user takes a free slot and displaces no one', () => {
    const u = quotaUse(C, 102, 0.5, 1);
    expect(u.typical).toBe(12);
    expect(u.displaced).toBe(0);
    expect(u.free).toBe(12);
  });
  it('never negative, never above the quota', () => {
    for (const p of [0, 0.3, 0.99, 1]) for (const user of [0, 1, 2, 30]) {
      const u = quotaUse(C, 102, p, user);
      expect(u.typical).toBeGreaterThanOrEqual(0);
      expect(u.typical + u.user).toBeLessThanOrEqual(u.quota);
      expect(u.free).toBeGreaterThanOrEqual(0);
    }
  });
});
