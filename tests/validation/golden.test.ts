/**
 * Iteration 9 — golden cases computed by hand (plain arithmetic in this file), written before any formula change.
 * Each expected number comes from the formula in the comment, not from an engine call. Sources: reviews of 0bf74d7.
 */
import { describe, expect, it } from 'vitest';
// Pinned to the simulation basis (2.25 rights per 167 m²): numbers reconciled on it (iteration 10).
import { C_SIM as C } from '../fixtures/configs';
import { constructionQuotePerApartment } from '../../src/domain/construction';
import { developerBudget } from '../../src/domain/lotDeveloper';
import { calculateRights } from '../../src/domain/rights';
import { mixedSplit } from '../../src/optimizer/generate';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { profile, TERMS } from '../fixtures/profiles';

describe('167 m² / 2.25 rights / 35% — owner arithmetic', () => {
  it('rights and the whole-apartment threshold', () => {
    expect(calculateRights(167, C).apartmentEquivalents).toBeCloseTo(2.25, 12); // 167/167 × 2.25
    expect(2.25 * 0.35).toBeCloseTo(0.7875, 12);
    expect(1 / 2.25).toBeCloseTo(0.444444, 6); // 44.44% for a whole standard apartment without a payment
  });
  it('completion of the missing 0.2125 apartment at the ₪2.5M reference = ₪531,250', () => {
    const d = analyzeProfile(profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }), TERMS, C);
    const s06 = d.results.find((r) => r.strategyType === 'S06' && r.candidate.targetApartments === 1)!;
    const paid = s06.ledger.filter((e) => e.category === 'completion_payment').reduce((s, e) => s + e.amount, 0);
    expect(paid).toBeCloseTo(0.2125 * 2_500_000, 0);
  });
  it('S11 split x = (N − cR)/(1 − c) = 0.326923; services quote 100 × 11,000 × 1.175 × 1.18 = ₪1,525,150', () => {
    const x = mixedSplit(1, 2.25, 0.35);
    expect(x).toBeCloseTo((1 - 0.35 * 2.25) / 0.65, 9);
    expect(x).toBeCloseTo(0.326923, 6);
    expect(2.25 - x).toBeCloseTo(1.923077, 6);
    expect(constructionQuotePerApartment(C, 0.175)).toBeCloseTo(100 * 11000 * 1.175 * 1.18, 6);
    expect(x * 1_525_150).toBeCloseTo(498_607, 0);
  });
});

describe('lot 149 — developer direct budget', () => {
  it('14,269 × 6,600 + 4,770 × 3,400 + 1,530 × 2,640 = ₪114,432,600; +10% = ₪11,443,260', () => {
    const b = developerBudget(C, '149');
    expect(b.direct).toBeCloseTo(114_432_600, 0);
    expect(b.direct * 0.1).toBeCloseTo(11_443_260, 0);
    expect(b.direct / 11209).toBeCloseTo(10208.99, 1);
  });
});

describe('bilateral consideration at 35% (lot 149) — what the reviews measured', () => {
  it('owner basis 2.25 × 35% × ₪2.5M = ₪1,968,750; official-share area basis 11,209 × 2.353% × 35% × ₪25,000 = ₪2,307,793', () => {
    expect(2.25 * 0.35 * 2_500_000).toBeCloseTo(1_968_750, 0);
    expect(11209 * 0.02353 * 0.35 * 25000).toBeCloseTo(2_307_793, 0);
    // Official saleable area per simulation right: 11,209 × 2.353% / 2.25 ≈ 117.22 m² (vs the 100 m² standard).
    expect((11209 * 0.02353) / 2.25).toBeCloseTo(117.22, 2);
  });
});

describe('money basis', () => {
  it('₪1M in today’s prices at year 5 is ₪1,104,081 nominal at 2% inflation; a fixed nominal ₪1M is ₪905,731 real', () => {
    expect(1_000_000 * 1.02 ** 5).toBeCloseTo(1_104_081, 0);
    expect(1_000_000 / 1.02 ** 5).toBeCloseTo(905_731, 0);
    // At a 3% real discount rate the two present values differ by ≈ ₪81,320.
    expect(1_000_000 / 1.03 ** 5 - 905_731 / 1.03 ** 5).toBeCloseTo(81_320, -1);
  });
});
