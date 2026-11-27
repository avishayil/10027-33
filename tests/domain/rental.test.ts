/** Iteration 9 / D2: rent starts after a delay, a lender recognises only part of it, fractions earn none. */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { simulateCashflow, type SimulationInput } from '../../src/domain/cashflow';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { dropRedundantRentals } from '../../src/optimizer/rank';
import { profile, TERMS } from '../fixtures/profiles';

const sim = (over: Partial<SimulationInput> = {}) =>
  simulateCashflow({
    events: [{ month: 60, amount: -1_000_000, label: 'השלמה', category: 'completion_payment' }],
    startingCash: 0,
    annualRate: 0.05,
    mortgageYears: 25,
    alternativeReturn: 0,
    permitMonth: 24,
    completionMonth: 60,
    horizonMonth: 120,
    liquidityMonth: 24,
    monthlyNetRent: 4000,
    rentCountsForRepayment: true,
    ...over,
  });

describe('rent in the cash flow', () => {
  it('no rent before the start month: 3 months later means 3 × ₪4,000 less cash', () => {
    const a = sim();
    const b = sim({ rentStartMonth: 63 });
    // Cash repays debt, so compare total wealth (cash − debt).
    // Wealth = cash − debt − the mortgage payments the household made from income (zero return, zero inflation).
    const w = (x: typeof a) => x.cashAtHorizon - x.debtAtHorizon - x.personalPaymentsFV;
    expect(w(a) - w(b)).toBeGreaterThan(3 * 4000 - 1);
  });
  it('a lender counting 80% of the rent leaves a higher personal monthly payment', () => {
    const full = sim();
    const part = sim({ rentRecognition: 0.8 });
    expect(part.peakPersonalMonthly - full.peakPersonalMonthly).toBeCloseTo(0.2 * 4000, 0);
  });
});

describe('rental variants', () => {
  it('a fraction of an apartment earns no rent', () => {
    const d = analyzeProfile(profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }), TERMS, C);
    const s02 = d.results.find((r) => r.id === 'S02')!;
    expect(s02.plan.wholeApartmentsRetained).toBe(0);
    expect(s02.simulation.monthlyNetRent).toBe(0);
  });
  it('the rental variant is kept when the goal is rental income', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 334, availableCapital: 3_000_000, maxMonthlyRepayment: 20000 }), TERMS, C);
    const s08 = d.results.filter((r) => r.strategyType === 'S08');
    expect(dropRedundantRentals(d.results, 'passive_income').length).toBe(d.results.length);
    expect(dropRedundantRentals(d.results, 'passive_income').filter((r) => r.strategyType === 'S08')).toHaveLength(s08.length);
  });
});
