/**
 * Iteration 8 (review §6): financing facilities kept apart — the project loan (construction → mortgage), the loan
 * on another property ("any purpose", amortising from the draw, its own rate and term) and the tax loan (bullet at
 * delivery). Mortgage limits: sole 75%, replacement 70%, additional / any purpose 50%; refinancing a tax loan on the
 * delivered apartment is not a purchase loan.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { simulateCashflow } from '../../src/domain/cashflow';
import type { CashEvent } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { mortgageLtvLimit } from '../../src/optimizer/feasibility';
import { WITH_TAX_LOAN } from '../fixtures/configs';
import { profile, TERMS } from '../fixtures/profiles';

const base = (events: CashEvent[]) => ({
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
  postCompletionCollateral: 2_500_000,
});
const tax: CashEvent = { month: 24, amount: -200_000, label: 'מס', category: 'capital_gains_tax', taxLoanEligible: true };

describe('facilities', () => {
  it('a loan on another property amortises from the draw — payments start before delivery', () => {
    const s = simulateCashflow({ ...base([tax]), taxesFinanceableBySecuredLoan: true, securedLoan: { annualRate: 0.06, years: 20 } });
    expect(s.taxesFinancedBySecuredLoan).toBeCloseTo(200_000, 6);
    expect(s.constructionPhaseMonthly).toBeGreaterThan(0);
    const f = s.facilities.find((x) => x.type === 'secured_other_property')!;
    expect(f.repayment).toBe('amortising_from_draw');
    expect(f.annualRate).toBeCloseTo(0.06, 12);
    // Its pre-delivery payment is an annuity on ₪200K over 20 years at 6% — not interest-only.
    expect(s.constructionPhaseMonthly).toBeCloseTo((200_000 * 0.005) / (1 - Math.pow(1.005, -240)), 2);
  });
  it('each facility is reported on its own, and their draws add up', () => {
    const s = simulateCashflow({ ...base([tax, { month: 30, amount: -300_000, label: 'בנייה', category: 'construction' }]), taxLoan: { annualRate: 0.08 } });
    const types = s.facilities.map((f) => f.type).sort();
    // Iteration 10: the tax loan refinanced into the mortgage at maturity is its own row — a transfer, not a draw.
    expect(types).toEqual(['project_loan', 'tax_loan', 'tax_loan_refinance']);
    expect(s.facilities.filter((f) => f.type !== 'tax_loan_refinance').reduce((x, f) => x + f.drawn, 0)).toBeCloseTo(s.totalDrawn, 4);
  });
});

describe('mortgage limits by purpose and status', () => {
  it('replacement home 70%', () => {
    expect(mortgageLtvLimit([1], true, C, true)).toBeCloseTo(0.7, 12);
    expect(mortgageLtvLimit([1], null, C, true)).toBeCloseTo(0.7, 12);
  });
  it('refinancing a tax loan is capped at the any-purpose limit; the rest is a maturity gap, not more mortgage (iteration 9 / F03)', () => {
    const tight = { ...WITH_TAX_LOAN, financing: { ...WITH_TAX_LOAN.financing, ltvLimits: { ...WITH_TAX_LOAN.financing.ltvLimits, additionalHome: 0.1 } } };
    const p = profile({ landAreaSqm: 222.67, availableCapital: 0, maxMonthlyRepayment: 9000, soleHome: true });
    const ok = analyzeProfile(p, TERMS, WITH_TAX_LOAN).results.find((x) => x.id === 'S02')!;
    const capped = analyzeProfile(p, TERMS, tight).results.find((x) => x.id === 'S02')!;
    expect(ok.simulation.taxLoanRefinanced).toBeGreaterThan(0.1 * 2_500_000);
    expect(ok.reasonCodes).not.toContain('LTV_EXCEEDED');
    expect(ok.simulation.taxLoanMaturityGap).toBe(0);
    // Was: the whole balance became a mortgage and then failed the LTV test. Now the facility stops at its limit.
    // The cap is 10% of the delivered apartment's value in nominal shekels at delivery (iteration 9 / F04).
    const indexAtDelivery = Math.pow(1 + C.analysis.inflation, capped.plan.completionMonth / 12);
    expect(capped.simulation.taxLoanRefinanced).toBeLessThanOrEqual(0.1 * capped.plan.postCompletionCollateral * indexAtDelivery + 1);
    expect(capped.simulation.taxLoanMaturityGap).toBeGreaterThan(0);
    expect(capped.reasonCodes).toContain('TAX_LOAN_EXTENSION_NEEDED');
  });
});
