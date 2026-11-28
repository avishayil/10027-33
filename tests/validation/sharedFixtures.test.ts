/**
 * V1 Milestone B3: the cross-product fixtures that were only partly covered (docs/ECONOMIC-CONTRACT.md §3). Expected
 * numbers are typed from the formulas, not read from the engine.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { simulateCashflow } from '../../src/domain/cashflow';
import { approvalMonthOf } from '../../src/domain/transactions';
import type { CashEvent } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { snapshotsFor } from '../../src/optimizer/contract';
import { C_SIM } from '../fixtures/configs';
import { profile, TERMS } from '../fixtures/profiles';

describe('F-b: hybrid one unit — services ₪498,607 before indexation', () => {
  it('11,000 × 1.175 × 1.18 × 100 m² = ₪1,525,150 per unit; × 0.326923 = ₪498,607 paid for construction', () => {
    const quote = 11_000 * 1.175 * 1.18 * 100;
    expect(quote).toBeCloseTo(1_525_150, 6);
    const x = (1 - 2.25 * 0.35) / (1 - 0.35);
    expect(x).toBeCloseTo(0.326923, 6);
    const cfg = { ...C_SIM, construction: { ...C_SIM.construction, annualIndexation: 0 } };
    const r = analyzeProfile(profile({ availableCapital: 2_000_000, maxMonthlyRepayment: 15_000 }), TERMS, cfg).results.find((y) => y.id === 'S11-1')!;
    const paid = r.ledger.filter((e) => e.category === 'construction' && e.payer === 'owner').reduce((s, e) => s + e.amount, 0);
    expect(r.plan.rightsBuilt).toBeCloseTo(x, 6);
    expect(paid).toBeCloseTo(x * quote, 0); // ₪498,607 (VAT on the combination barter is a separate line)
  });
});

describe('F-e: 0.75 right bought before approval — buyer levy ≈ ₪85,646, once, dated', () => {
  const r = analyzeProfile(profile({ availableCapital: 2_000_000, maxMonthlyRepayment: 15_000 }), TERMS, C_SIM).results.find((y) => y.id === 'S10-3')!;
  it('the purchase is dated before approval', () => {
    expect(r.plan.rightsPurchased).toBeCloseTo(0.75, 9);
    for (const e of r.ledger.filter((x) => x.category === 'rights_purchase')) expect(e.month).toBeLessThan(approvalMonthOf(C_SIM));
  });
  it('one levy line for the bought rights, on the buyer (the owner): 0.75 × ₪256,939 / 2.25 ≈ ₪85,646', () => {
    const lines = r.ledger.filter((e) => e.category === 'betterment_levy' && Math.abs((e.rightsPortion ?? 0) - 0.75) < 1e-9);
    expect(lines).toHaveLength(1);
    expect(lines[0].payer).toBe('owner');
    expect(lines[0].amount).toBeCloseTo((0.75 * 256_939.44) / 2.25, 0);
  });
});

const base = (events: CashEvent[], over: object = {}) =>
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
    postCompletionCollateral: 2_500_000,
    ...over,
  });

describe('F-h: project draws ₪300K, tax maturity ₪200K paid in cash', () => {
  it('project draws stay ₪300K; the tax loan is repaid from cash at maturity, nothing refinanced, nothing left', () => {
    const s = base(
      [
        { month: 30, amount: -300_000, label: 'בנייה', category: 'construction' },
        { month: 24, amount: -200_000, label: 'מס', category: 'capital_gains_tax', taxLoanEligible: true },
        { month: 60, amount: 1_000_000, label: 'תקבול', category: 'sale_proceeds' },
      ],
      { taxLoan: { annualRate: 0 } },
    );
    expect(s.facilities.find((f) => f.type === 'project_loan')!.drawn).toBeCloseTo(300_000, 6);
    expect(s.taxLoanRefinanced).toBe(0);
    expect(s.facilityAccounts.tax_loan.repayment).toBeCloseTo(200_000, 6);
    expect(s.facilityAccounts.tax_loan.terminal).toBeCloseTo(0, 6);
    expect(s.taxLoanMaturityGap).toBe(0);
  });
});

describe('F-i: the refinance ceiling derived by the engine', () => {
  it('= 50% (any purpose) × the delivered apartments’ collateral, indexed to the maturity month', () => {
    const p = profile({ availableCapital: 0, maxMonthlyRepayment: 5000 });
    const k = { arrangement: 'gross' as const, combinationPct: 0.35, markup: TERMS.developerMarkup, offer: { levyCap: null, developerPaysTaxLoanInterest: false }, funding: 'developer_loan' as const };
    const s = snapshotsFor(p, k, C).find((x) => x.result.simulation.taxLoanDrawn > 1 && x.result.simulation.debtAtCompletion - x.result.simulation.taxLoanAtMaturity < 1)!;
    expect(s).toBeDefined();
    const sim = s.result.simulation;
    const years = s.result.plan.completionMonth / 12;
    const expected = C.financing.ltvLimits.additionalHome * s.result.plan.postCompletionCollateral * Math.pow(1 + C.analysis.inflation, years);
    expect(sim.taxLoanRefinanceCap).toBeCloseTo(expected, 0);
  });
});
