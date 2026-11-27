/**
 * Iteration 8 (review §5): two values, consistently defined.
 *  - transaction value: the deal before personal financing — ledger flows and the apartments, discounted;
 *  - value to you (the ranking): plus loan proceeds, debt service and the debt left at the horizon.
 * Prices are today's (real); nominal flows (indexed construction payments, loans) are deflated by inflation.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import type { ProjectConfig } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { profile, TERMS } from '../fixtures/profiles';

const zero: ProjectConfig = { ...C, analysis: { ...C.analysis, discountRate: 0, inflation: 0 } };

describe('value to you vs transaction value', () => {
  it('the ranking uses value to you', () => {
    const r = analyzeProfile(profile({ availableCapital: 300_000, maxMonthlyRepayment: 8000 }), TERMS, C).results[0];
    expect(r.metrics.valueCreated).toBe(r.comparisonValue);
    expect(typeof r.transactionValue).toBe('number');
  });
  it('at 0% discount and 0% inflation the difference is exactly the interest charged', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 60, availableCapital: 600_000, maxMonthlyRepayment: 20000, soleHome: true }), TERMS, zero);
    const r = d.results.find((x) => x.id === 'S06-1')!;
    expect(r.simulation.totalDrawn).toBeGreaterThan(0);
    const s = r.simulation;
    expect(r.comparisonValue - r.transactionValue).toBeCloseTo(-(s.interestPaidToCompletion + s.interestAfterCompletion + s.taxLoanInterest), 0);
  });
  it('a debt-free route has value to you = transaction value', () => {
    const r = analyzeProfile(profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C).results.find((x) => x.id === 'S02')!;
    expect(r.simulation.totalDrawn).toBe(0);
    expect(r.comparisonValue).toBeCloseTo(r.transactionValue, 6);
  });
  it('the old horizon-based present value is gone (one definition)', () => {
    const r = analyzeProfile(profile(), TERMS, C).results[0] as unknown as Record<string, unknown>;
    expect(r.netPresentValue).toBeUndefined();
  });
  it('inflation is 2% (Bank of Israel target range 1–3%)', () => {
    expect(C.analysis.inflation).toBe(0.02);
  });
});
