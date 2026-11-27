/**
 * Paying a tax ≠ lending the money to pay it. A tax loan from the developer or the financing bank covers combination
 * taxes the household cannot pay in cash; interest is capitalised until delivery, then the balance is refinanced
 * as a mortgage on the delivered apartment (with the usual LTV and repayment checks).
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { simulateCashflow, type SimulationInput } from '../../src/domain/cashflow';
import type { CashEvent, ProjectConfig } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { profile, TERMS } from '../fixtures/profiles';

const base = (events: CashEvent[], over: Partial<SimulationInput> = {}): SimulationInput => ({
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
  preCompletionLandCollateral: 1_000_000,
  postCompletionCollateral: 2_500_000,
  ...over,
});
const tax = (amount: number, eligible = true): CashEvent => ({
  month: 24,
  amount: -amount,
  label: 'מס שבח',
  category: 'capital_gains_tax',
  ...(eligible ? { taxLoanEligible: true } : {}),
});

describe('tax loan in the cash-flow simulation', () => {
  const rate = 0.0675;
  it('covers an eligible tax shortfall; interest capitalised to delivery, no payments before it', () => {
    const sim = simulateCashflow(base([tax(100_000)], { taxLoan: { annualRate: rate } }));
    const grown = 100_000 * Math.pow(1 + rate / 12, 36);
    expect(sim.unfunded).toBe(0);
    expect(sim.taxLoanDrawn).toBeCloseTo(100_000, 6);
    expect(sim.taxLoanInterest).toBeCloseTo(grown - 100_000, 4);
    expect(sim.debtAtCompletion).toBeGreaterThan(grown - 1000);
    expect(sim.constructionPhaseMonthly).toBe(0);
    expect(sim.drawsByStage.mortgage).toBeCloseTo(grown, 4);
    expect(sim.postCompletionMonthly).toBeGreaterThan(0);
  });

  it('does not cover costs that are not combination taxes', () => {
    const sim = simulateCashflow(base([tax(100_000, false)], { taxLoan: { annualRate: rate } }));
    expect(sim.unfunded).toBeCloseTo(100_000, 6);
    expect(sim.taxLoanDrawn).toBe(0);
  });

  it('without a tax loan the shortfall stays unfunded (previous behaviour)', () => {
    const sim = simulateCashflow(base([tax(100_000)]));
    expect(sim.unfunded).toBeCloseTo(100_000, 6);
    expect(sim.taxLoanDrawn).toBe(0);
  });

  it('a loan secured on another property comes first (cheaper)', () => {
    const sim = simulateCashflow(base([tax(100_000)], { taxLoan: { annualRate: rate }, taxesFinanceableBySecuredLoan: true }));
    expect(sim.taxesFinancedBySecuredLoan).toBeCloseTo(100_000, 6);
    expect(sim.taxLoanDrawn).toBe(0);
  });

  it('is tested against the delivered apartment, not the pre-delivery land price', () => {
    const sim = simulateCashflow(base([tax(600_000)], { taxLoan: { annualRate: rate }, preCompletionLandCollateral: 500_000 }));
    expect(sim.peakPreCompletionLtv).toBe(0);
    expect(sim.peakPostCompletionLtv).toBeCloseTo((600_000 * Math.pow(1 + rate / 12, 36)) / 2_500_000, 3);
  });

  it('with no apartment to refinance on, the loan fails the LTV test instead of being free', () => {
    const sim = simulateCashflow(base([tax(100_000)], { taxLoan: { annualRate: rate }, postCompletionCollateral: 0 }));
    expect(sim.peakPostCompletionLtv).toBe(Infinity);
  });
});

describe('tax loan in the decision engine', () => {
  // 3 rights → a 35% combination yields 1.05 apartments: one whole apartment to refinance the loan on.
  const area = (3 * 167) / 2.25;
  const household = profile({ landAreaSqm: area, availableCapital: 0, maxMonthlyRepayment: 7000, soleHome: true });
  const s02 = (cfg: ProjectConfig) => analyzeProfile(household, TERMS, cfg).results.find((r) => r.id === 'S02')!;

  it('a household with no free cash can do a mixed combination with a tax loan — conditional, with its cost', () => {
    const r = s02(C);
    expect(r.simulation.unfunded).toBe(0);
    expect(r.simulation.taxLoanDrawn).toBeGreaterThan(0);
    expect(r.simulation.taxLoanInterest).toBeGreaterThan(0);
    expect(r.assessment.affordability).toBe('fits_with_financing');
    expect(r.requiredConditions).toContain('TAX_LOAN');
  });

  it('when no tax loan is available the taxes are unfunded, as before', () => {
    const off: ProjectConfig = { ...C, financing: { ...C.financing, taxLoan: { ...C.financing.taxLoan, available: false } } };
    const r = s02(off);
    expect(r.simulation.unfunded).toBeGreaterThan(0);
    expect(r.assessment.affordability).toBe('does_not_fit');
  });

  it('a household that ruled out borrowing gets no tax loan', () => {
    const r = analyzeProfile({ ...household, maxMonthlyRepayment: 0 }, TERMS, C).results.find((x) => x.id === 'S02')!;
    expect(r.simulation.taxLoanDrawn).toBe(0);
  });
});
