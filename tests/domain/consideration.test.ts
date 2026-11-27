/**
 * Iteration 9 / F01 (owner decision (a)): one consideration, two views. The owner model keeps 2.25 rights per 167 m²
 * and 100 m² apartments; the developer gives up the official share; the difference is explicit and conserved.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { considerationReconciliation, officialAreaPerRight, routeDelta } from '../../src/domain/lotDeveloper';
import { calculateRights } from '../../src/domain/rights';
import { buildTransactionPlan } from '../../src/domain/transactions';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { MODERATE, profile, TERMS } from '../fixtures/profiles';

const info = calculateRights(167, C, '149');
const ctx = { info, profile: MODERATE, config: C };
const S02 = { id: 'S02', type: 'S02' as const, targetApartments: 0, legs: [{ kind: 'combination' as const, rights: 2.25 }] };

describe('consideration reconciliation, lot 149, 35% full combination', () => {
  const plan = buildTransactionPlan(S02, { info, profile: MODERATE, terms: TERMS, config: C });
  const r = considerationReconciliation(ctx, plan);
  it('official area per simulation right = 11,209 × 2.353% / 2.25 ≈ 117.22 m²', () => {
    expect(officialAreaPerRight(ctx)).toBeCloseTo((11209 * 0.02353) / 2.25, 6);
  });
  it('owner ₪1,968,750 + not credited ₪339,043 = developer gives up ₪2,307,793', () => {
    expect(r.apartmentEquivalents).toBeCloseTo(0.7875, 9);
    expect(r.ownerValue).toBeCloseTo(1_968_750, 0);
    expect(r.developerForgoneValue).toBeCloseTo(11209 * 0.02353 * 0.35 * 25000, 0);
    expect(r.unallocatedValue).toBeCloseTo(r.developerForgoneValue - r.ownerValue, 6);
    expect(r.unallocatedValue).toBeCloseTo(339_043, 0);
  });
  it('the lot delta uses exactly the reconciled official area', () => {
    const d = routeDelta(ctx, plan, TERMS);
    expect(d.consideration).toEqual(r);
  });
});

describe('every route reconciles', () => {
  for (const [area, cap] of [[167, 800_000], [334, 1_000_000], [100, 300_000]] as const) {
    it(`${area} m²`, () => {
      const d = analyzeProfile(profile({ landAreaSqm: area, availableCapital: cap, maxMonthlyRepayment: 8000 }), TERMS, C);
      for (const x of d.results) {
        const c = x.developerLot?.consideration;
        if (!c) continue;
        expect(c.ownerValue + c.unallocatedValue).toBeCloseTo(c.developerForgoneValue, 4);
        expect(c.standardAreaSqm).toBeCloseTo(c.apartmentEquivalents * 100, 6);
        expect(c.unallocatedAreaSqm).toBeGreaterThanOrEqual(-1e-6);
      }
    });
  }
});
