/**
 * Iteration 7 (review §9): optimise the apartment allocation instead of adding one residual apartment. For an
 * entitlement of E standard-apartment equivalents, every mix of 3/4/5-room apartments within one standard apartment of
 * E is a candidate: the owner pays the gap (completion) or receives the excess (developer buy-back). Values from the
 * appraisal comparables; inventory is not established.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { calculateRights } from '../../src/domain/rights';
import { buildTransactionPlan } from '../../src/domain/transactions';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { generateStrategies, rightsBalance } from '../../src/optimizer/generate';
import { MODERATE, TERMS } from '../fixtures/profiles';

const rel = (rooms: number) => C.market.apartmentTypes.find((t) => t.rooms === rooms)!.relativeValue;

describe('apartment mixes', () => {
  const info = calculateRights(334, C);
  const E = info.apartmentEquivalents * TERMS.combinationPct; // 1.575
  const cands = generateStrategies(info, TERMS, C);
  it('334 m²: two smaller apartments are candidates; duplicates of the single-tier routes are not', () => {
    const ids = cands.map((c) => c.id);
    expect(ids).toContain('S13-3r+3r');
    expect(ids).toContain('S13-3r+5r');
    expect(ids).not.toContain('S13-3r+4r'); // = S13-3r (one standard + one 3-room)
    for (const c of cands) expect(Math.abs(rightsBalance(c, info.apartmentEquivalents))).toBeLessThan(1e-9);
  });
  it('two 3-room apartments: the owner pays the value gap; both are whole apartments', () => {
    const c = cands.find((x) => x.id === 'S13-3r+3r')!;
    const p = buildTransactionPlan(c, { info, profile: MODERATE, terms: TERMS, config: C });
    expect(p.wholeApartmentsRetained).toBe(2);
    expect(p.apartmentRooms).toEqual([3, 3]);
    expect(p.fractionalShare).toBe(0);
    const paid = p.ledger.filter((e) => e.category === 'completion_payment').reduce((s, e) => s + e.amount, 0);
    expect(paid).toBeCloseTo((2 * rel(3) - E) * 2_500_000, 2);
  });
  it('500 m²: two 3-room apartments leave an excess the developer pays out', () => {
    const big = calculateRights(500, C);
    const c = generateStrategies(big, TERMS, C).find((x) => x.id === 'S13-3r+3r')!;
    const p = buildTransactionPlan(c, { info: big, profile: MODERATE, terms: TERMS, config: C });
    const excess = big.apartmentEquivalents * TERMS.combinationPct - 2 * rel(3);
    expect(excess).toBeGreaterThan(0);
    const got = p.ledger.filter((e) => e.category === 'fraction_settlement').reduce((s, e) => s + e.amount, 0);
    expect(got).toBeCloseTo(excess * 2_500_000 * C.commercial.fractionCashSettlementFactor, 2);
    expect(p.fractionSettled?.mode).toBe('cash');
  });
  it('mixes are titled by their rooms and sit on the combination + payment card', () => {
    const d = analyzeProfile({ ...MODERATE, landAreaSqm: 334, availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }, TERMS, C);
    const r = d.results.find((x) => x.id === 'S13-3r+3r')!;
    expect(r.plan.apartmentRooms).toEqual([3, 3]);
  });
});

describe('bounded mix search (iteration 8, review §7)', () => {
  // Exactly two standard-apartment equivalents at 35%: R = 2 / 0.35.
  const area = ((2 / 0.35) / 2.25) * 167;
  const info = calculateRights(area, C);
  const ids = generateStrategies(info, TERMS, C).map((c) => c.id);
  it('an exact integer entitlement still considers smaller and larger mixes', () => {
    expect(ids).toContain('S13-3r+4r'); // receive the excess
    expect(ids).toContain('S13-4r+5r'); // pay the gap
    expect(ids).toContain('S13-3r+3r');
  });
  it('fewer apartments with a balancing amount are considered; exact duplicates of S02 / S06 are not', () => {
    expect(ids).toContain('S13-5r');
    expect(ids).not.toContain('S13-4r+4r'); // = S02 exactly
  });
});

describe('renting the apartments received in a combination (S14, review §7)', () => {
  const d = analyzeProfile({ ...MODERATE, landAreaSqm: 334, availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }, TERMS, C);
  it('rental variants of whole-apartment combination routes exist; rent supports repayment, not value', () => {
    const base = d.results.find((x) => x.id === 'S13-3r+3r')!;
    const rent = d.results.find((x) => x.id === 'S13-3r+3r-rent')!;
    expect(rent.strategyType).toBe('S14');
    expect(rent.simulation.monthlyNetRent).toBeGreaterThan(0);
    expect(base.simulation.monthlyNetRent).toBe(0);
    expect(rent.comparisonValue).toBeCloseTo(base.comparisonValue, 0);
    expect(rent.plan.wholeApartmentsRetained).toBe(2);
  });
});
