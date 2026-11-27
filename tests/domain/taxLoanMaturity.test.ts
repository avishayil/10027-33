/**
 * Iteration 9 / F03: a tax loan at maturity is repaid from cash first, then by an explicit conditional refinance facility
 * up to its limit; anything left is a maturity gap — never silently converted into a mortgage.
 */
import { describe, expect, it } from 'vitest';
import { simulateCashflow, type SimulationInput } from '../../src/domain/cashflow';
import type { CashEvent } from '../../src/domain/types';

const sim = (events: CashEvent[], over: Partial<SimulationInput> = {}) =>
  simulateCashflow({
    events,
    startingCash: 0,
    annualRate: 0.05,
    mortgageYears: 25,
    alternativeReturn: 0,
    permitMonth: 24,
    completionMonth: 60,
    horizonMonth: 120,
    liquidityMonth: 24,
    monthlyNetRent: 0,
    rentCountsForRepayment: false,
    taxLoan: { annualRate: 0 },
    ...over,
  });
const tax = (amount: number, month = 24): CashEvent => ({ month, amount: -amount, label: 'מס', category: 'capital_gains_tax', taxLoanEligible: true });
const receipt = (amount: number, month: number): CashEvent => ({ month, amount, label: 'תקבול', category: 'fraction_settlement' });

describe('tax-loan maturity', () => {
  it('zero rate: draw ₪100K, repay ₪100K from cash at maturity — no debt, no gap', () => {
    const s = sim([tax(100_000), receipt(100_000, 60)], { taxLoanRefinanceLimit: 0 });
    expect(s.taxLoanDrawn).toBeCloseTo(100_000, 6);
    expect(s.taxLoanAtMaturity).toBeCloseTo(100_000, 6);
    expect(s.taxLoanRefinanced).toBe(0);
    expect(s.taxLoanMaturityGap).toBe(0);
    expect(s.debtAtCompletion).toBe(0);
  });
  it('a later pool sale does not matter when cash covers the maturity (no extension needed)', () => {
    const s = sim([tax(100_000), receipt(150_000, 59), receipt(400_000, 72)], { taxLoanRefinanceLimit: 0 });
    expect(s.taxLoanMaturityGap).toBe(0);
  });
  it('no cash and no refinance facility: the whole balance is a gap, repaid when the later receipt arrives', () => {
    const s = sim([tax(100_000), receipt(400_000, 72)], { taxLoanRefinanceLimit: 0 });
    expect(s.taxLoanMaturityGap).toBeCloseTo(100_000, 6);
    expect(s.taxLoanRefinanced).toBe(0);
    expect(s.debtAtHorizon).toBe(0);
  });
  it('refinance covers only up to its limit; the rest is a gap', () => {
    const s = sim([tax(100_000)], { taxLoanRefinanceLimit: 30_000 });
    expect(s.taxLoanRefinanced).toBeCloseTo(30_000, 6);
    expect(s.taxLoanMaturityGap).toBeCloseTo(70_000, 6);
  });
  it('partial cash: cash first, then the facility, nothing left', () => {
    const s = sim([tax(100_000), receipt(40_000, 60)], { taxLoanRefinanceLimit: 1_000_000 });
    expect(s.taxLoanRefinanced).toBeCloseTo(60_000, 6);
    expect(s.taxLoanMaturityGap).toBe(0);
  });
  it('a tax drawn after delivery is due at once and goes through the same steps', () => {
    const s = sim([tax(50_000, 66)], { taxLoanRefinanceLimit: 20_000 });
    expect(s.taxLoanRefinanced).toBeCloseTo(20_000, 6);
    expect(s.taxLoanMaturityGap).toBeCloseTo(30_000, 6);
  });
});
