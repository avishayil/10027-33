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
