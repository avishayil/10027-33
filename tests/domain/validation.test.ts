/** Iteration 9 / D4: impossible inputs are rejected at the domain boundary. */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { maxAreaInLot, validateInputs } from '../../src/domain/validation';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { profile, TERMS } from '../fixtures/profiles';

describe('validateInputs', () => {
  it('a normal household is valid', () => {
    expect(validateInputs(profile(), TERMS, C)).toEqual([]);
  });
  it('rejects zero, negative, non-finite and larger-than-parcel areas', () => {
    for (const a of [0, -5, Number.NaN, Infinity, 21_259]) expect(validateInputs(profile({ landAreaSqm: a }), TERMS, C).length).toBeGreaterThan(0);
  });
  it('rejects a holding larger than one lot: lot 149 holds at most 167 / 2.353% ≈ 7,097 m²', () => {
    expect(maxAreaInLot(C, '149')).toBeCloseTo(167 / 0.02353, 6);
    expect(validateInputs(profile({ landAreaSqm: 7_098, lotId: '149' }), TERMS, C).length).toBe(1);
    expect(validateInputs(profile({ landAreaSqm: 7_097, lotId: '149' }), TERMS, C)).toEqual([]);
  });
  it('rejects an unknown lot, negative money and percentages outside 0–100%', () => {
    expect(validateInputs(profile({ lotId: '999' }), TERMS, C).length).toBeGreaterThan(0);
    expect(validateInputs(profile({ availableCapital: -1 }), TERMS, C).length).toBeGreaterThan(0);
    expect(validateInputs(profile({ maxMonthlyRepayment: Number.NaN }), TERMS, C).length).toBeGreaterThan(0);
    expect(validateInputs(profile(), { ...TERMS, combinationPct: 1.2 }, C).length).toBeGreaterThan(0);
  });
  it('unknown (null) is not zero: null capital and repayment are valid', () => {
    expect(validateInputs(profile({ availableCapital: null, maxMonthlyRepayment: null }), TERMS, C)).toEqual([]);
  });
  it('the engine refuses invalid inputs instead of returning a result', () => {
    expect(() => analyzeProfile(profile({ landAreaSqm: 30_000 }), TERMS, C)).toThrow();
  });
});

describe('iteration 10 / E2: every input and the configuration are validated at the entry points', () => {
  const bad = (over: Parameters<typeof profile>[0]) => validateInputs(profile(over), TERMS, C);
  it('borrowing limit on another property: finite and non-negative', () => {
    expect(bad({ otherPropertyBorrowingLimit: -1 }).length).toBeGreaterThan(0);
    expect(bad({ otherPropertyBorrowingLimit: Number.POSITIVE_INFINITY }).length).toBeGreaterThan(0);
    expect(bad({ otherPropertyBorrowingLimit: 500_000 })).toEqual([]);
  });
  it('liquidity deadline: finite, positive, within the horizon', () => {
    for (const y of [0, -1, Number.NaN, C.analysis.horizonYears + 1]) expect(bad({ liquidityDeadlineYears: y }).length).toBeGreaterThan(0);
    expect(bad({ liquidityDeadlineYears: 2 })).toEqual([]);
  });
  it('goal must be one of the known goals', () => {
    expect(bad({ goal: 'get_rich' as never }).length).toBeGreaterThan(0);
  });
  it('the levy cap of an actual offer: finite and non-negative', () => {
    const cfg = { ...C, commercial: { ...C.commercial, offer: { levyCap: -5, developerPaysTaxLoanInterest: false } } };
    expect(validateInputs(profile(), TERMS, cfg).length).toBeGreaterThan(0);
    const nan = { ...C, commercial: { ...C.commercial, offer: { levyCap: Number.NaN, developerPaysTaxLoanInterest: false } } };
    expect(validateInputs(profile(), TERMS, nan).length).toBeGreaterThan(0);
  });
  it('configuration rates must be finite (a broken scenario rate never yields a confident result)', () => {
    const cfg = { ...C, analysis: { ...C.analysis, discountRate: Number.NaN } };
    expect(validateInputs(profile(), TERMS, cfg).length).toBeGreaterThan(0);
  });
  it('huge but finite values are rejected before they can freeze the engine', () => {
    expect(bad({ availableCapital: 1e15 }).length).toBeGreaterThan(0);
    expect(bad({ maxMonthlyRepayment: 1e12 }).length).toBeGreaterThan(0);
  });
});
