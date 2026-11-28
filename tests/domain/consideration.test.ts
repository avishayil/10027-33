/**
 * Iteration 9 / F01 (owner decision (a)): one consideration, two views. The owner model keeps 2.25 rights per 167 m²
 * and 100 m² apartments; the developer gives up the official share; the difference is explicit and conserved.
 */
import { describe, expect, it } from 'vitest';
// Pinned to the simulation basis (2.25 rights per 167 m²): numbers reconciled on it (iteration 10).
import { C_SIM as C } from '../fixtures/configs';
import { PROJECT_CONFIG } from '../../src/data/config';
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

describe('iteration 10: official entitlement basis (owner decision) and physical inventory (review F4, F5)', () => {
  // The product default: the owner's entitlement is the official share of the lot's saleable area.
  const O = PROJECT_CONFIG;
  const oInfo = calculateRights(167, O, '149');
  it('167 m² in lot 149: R = 2.353% × 11,209 ÷ 100 ≈ 2.6375 standard-apartment equivalents', () => {
    expect(oInfo.apartmentEquivalents).toBeCloseTo((0.02353 * 11209) / 100, 9);
  });
  it('35% full combination: owner ₪2,307,793 = what the developer gives up; nothing unallocated', () => {
    const s02 = { ...S02, legs: [{ kind: 'combination' as const, rights: oInfo.apartmentEquivalents }] };
    const plan = buildTransactionPlan(s02, { info: oInfo, profile: MODERATE, terms: TERMS, config: O });
    const r = considerationReconciliation({ info: oInfo, profile: MODERATE, config: O }, plan);
    expect(r.ownerValue).toBeCloseTo(11209 * 0.02353 * 0.35 * 25000, 0);
    expect(r.ownerValue).toBeCloseTo(r.developerForgoneValue, 4);
    expect(r.unallocatedValue).toBeCloseTo(0, 4);
    expect(r.material).toBe(false);
  });
  it('the simulation basis keeps its ₪339,043 residual, explicitly unallocated and material', () => {
    const plan = buildTransactionPlan(S02, { info, profile: MODERATE, terms: TERMS, config: C });
    const r = considerationReconciliation(ctx, plan);
    expect(r.material).toBe(true);
    expect(r.claims.find((x) => x.recipient === 'unallocated')!.value).toBeCloseTo(339_043, 0);
  });
  it('two 81 m² three-room apartments: 2 physical apartments, 162 m², valued separately from area', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 334, availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, O);
    const r = d.results.find((x) => x.id === 'S13-3r+3r');
    expect(r).toBeDefined();
    const c = r!.developerLot!.consideration;
    expect(c.physicalApartments).toBe(2);
    expect(c.physicalAreaSqm).toBeCloseTo(162, 6);
    const rel3 = O.market.apartmentTypes.find((t) => t.rooms === 3)!.relativeValue;
    expect(c.ownerValue).toBeCloseTo(2 * rel3 * 2_500_000, 0);
  });
});
