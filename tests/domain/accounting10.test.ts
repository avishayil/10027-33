/**
 * Iteration 10 / I2 (review of c689d0b, §D and acceptance F1–F3, F6, F7): facility reporting, delivery debt and
 * interest, the refinance ceiling on one money basis, delivery display in today's prices, the equivalence diagnostic,
 * developer stresses, typed evidence and the interval solver. Expected values are stated independently.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { simulateCashflow, type SimulationInput } from '../../src/domain/cashflow';
import { developerStress } from '../../src/domain/lotDeveloper';
import { calculateRights } from '../../src/domain/rights';
import type { CashEvent, ProjectConfig } from '../../src/domain/types';
import { analyzeProfile, priceDependencyOf } from '../../src/optimizer/analyze';
import { equivalenceDetail } from '../../src/optimizer/arrangementEquivalence';
import { solveIntervals, solveMax, solveMin } from '../../src/optimizer/reverse';
import { MODERATE, profile, TERMS } from '../fixtures/profiles';

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
  postCompletionCollateral: 2_500_000,
  ...over,
});
const tax = (amount: number, month = 24): CashEvent => ({ month, amount: -amount, label: 'מס', category: 'capital_gains_tax', taxLoanEligible: true });
const build = (amount: number, month: number): CashEvent => ({ month, amount: -amount, label: 'בנייה', category: 'construction' });
const cashIn = (amount: number, month: number): CashEvent => ({ month, amount, label: 'תקבול', category: 'sale_proceeds' });

describe('F1: facility report keeps external project draws apart from tax-loan transfers', () => {
  it('₪300K project draws, ₪200K tax loan repaid in cash at maturity → project ₪300K', () => {
    const s = simulateCashflow(base([build(300_000, 30), tax(200_000), cashIn(1_000_000, 60)], { taxLoan: { annualRate: 0 } }));
    const p = s.facilities.find((f) => f.type === 'project_loan')!;
    expect(p.drawn).toBeCloseTo(300_000, 6);
    for (const f of s.facilities) expect(f.drawn).toBeGreaterThan(0);
    expect(s.facilities.find((f) => f.type === 'tax_loan')!.drawn).toBeCloseTo(200_000, 6);
  });
  it('no project draws and a refinanced tax loan → a refinance row, never a negative project row', () => {
    const s = simulateCashflow(base([tax(200_000)], { taxLoan: { annualRate: 0 }, taxLoanRefinanceLimit: 1_000_000 }));
    expect(s.facilities.find((f) => f.type === 'project_loan')).toBeUndefined();
    expect(s.facilities.find((f) => f.type === 'tax_loan_refinance')!.drawn).toBeCloseTo(200_000, 6);
  });
});

describe('F2: an overdue tax loan at delivery', () => {
  const s = simulateCashflow(base([tax(200_000)], { taxLoan: { annualRate: 0.06 }, taxLoanRefinanceLimit: 0 }));
  it('is included in the debt at delivery', () => {
    expect(s.taxLoanMaturityGap).toBeGreaterThan(200_000);
    expect(s.debtAtCompletion).toBeCloseTo(s.taxLoanAtMaturity, 0);
  });
  it('interest after delivery is excluded from the interest to delivery', () => {
    expect(s.taxLoanInterest).toBeGreaterThan(s.taxLoanInterestToDelivery + 1);
    expect(s.taxLoanInterestToDelivery).toBeCloseTo(200_000 * (Math.pow(1.005, 36) - 1), 0);
  });
});

describe('F3: the refinance ceiling on one money basis', () => {
  it('₪2.5M real collateral, 2% inflation, maturity in year 5, 50% → nominal ceiling ≈ ₪1,380,101', () => {
    const s = simulateCashflow(
      base([tax(1_300_000)], { taxLoan: { annualRate: 0 }, inflation: 0.02, realInputs: { rent: true, collateral: true }, taxLoanRefinanceLimit: 1_250_000 }),
    );
    expect(s.taxLoanRefinanceCap).toBeCloseTo(1_250_000 * Math.pow(1.02, 5), 0);
    expect(s.taxLoanRefinanced).toBeCloseTo(1_300_000, 0);
    expect(s.taxLoanMaturityGap).toBe(0);
  });
  it('the ceiling leaves room for the project mortgage already on the apartment', () => {
    const s = simulateCashflow(
      base([build(1_000_000, 50), tax(800_000)], { taxLoan: { annualRate: 0 }, taxLoanRefinanceLimit: 1_250_000, mortgageLimitShare: 0.75 }),
    );
    // 75% × 2.5M = 1.875M in total; ~1.0M is already the project mortgage → about 0.875M left for the refinance.
    expect(s.taxLoanRefinanced).toBeLessThanOrEqual(0.75 * 2_500_000 - 1_000_000 + 1);
  });
});

describe('D4: the delivery view is in today’s prices', () => {
  it('nominal (indexed) payments are deflated in the delivery position', () => {
    const r = analyzeProfile(profile({ landAreaSqm: 60, availableCapital: 1_500_000, maxMonthlyRepayment: 20000 }), TERMS, C).results.find((x) => x.plan.apartmentsBuilt > 0)!;
    const nominalOut = r.ledger.filter((e) => e.payer === 'owner' && e.direction === 'out' && e.priceBasis === 'nominal' && e.month <= r.plan.completionMonth);
    expect(nominalOut.length).toBeGreaterThan(0);
    const raw = nominalOut.reduce((x, e) => x + e.amount, 0);
    const real = nominalOut.reduce((x, e) => x + e.amount * Math.pow(1 + C.analysis.inflation, -e.month / 12), 0);
    expect(raw).toBeGreaterThan(real);
    expect(r.delivery.basis).toBe('today');
  });
});

describe('D5: the equivalence diagnostic', () => {
  const ctx = { info: calculateRights(167, C), profile: MODERATE, config: C, markup: 0.2 };
  it('uses the selected markup and reports a root status', () => {
    const d = equivalenceDetail(ctx, 'mixed', 0.35, 'net');
    expect(['unique', 'multiple', 'unbracketed']).toContain(d.status);
    const d15 = equivalenceDetail({ ...ctx, markup: 0.15 }, 'mixed', 0.35, 'net');
    expect(d.roots[0]).not.toBeCloseTo(d15.roots[0] ?? -1, 6);
  });
});

describe('F6: developer cost stress also stresses a direct-cost override', () => {
  it('+10% with an override per saleable m² lowers the margin', () => {
    const cfg: ProjectConfig = { ...C, developer: { ...C.developer, directCostPerSqm: 9000 } };
    const s = developerStress({ info: calculateRights(167, cfg), profile: MODERATE, config: cfg }, 'mixed', 0.35);
    const baseRow = s.rows.find((r) => r.label === 'בסיס')!;
    const cost = s.rows.find((r) => r.label === 'עלות בנייה +10%')!;
    expect(cost.margin).toBeLessThan(baseRow.margin - 0.005);
  });
  it('adds services-volume, presale, basis and loan-cap stresses; headroom labelled static', () => {
    const s = developerStress({ info: calculateRights(167, C), profile: MODERATE, config: C }, 'mixed', 0.35);
    const labels = s.rows.map((r) => r.label).join('|');
    for (const k of ['שירותי בנייה', 'מכירה מוקדמת', 'עלות רכישה', 'תקרת ליווי']) expect(labels).toContain(k);
    expect(s.headroom.kind).toBe('static');
  });
});

describe('D7: typed evidence', () => {
  it('a confirmed developer offer is evaluated, not treated as a hypothetical price', () => {
    const c = { id: 'S01', type: 'S01' as const, targetApartments: 0, legs: [{ kind: 'sell_rights' as const, rights: 2, market: 'developer' as const }] };
    expect(priceDependencyOf(c, { fractionSettled: null }, C)).toBe('developer_price');
    const confirmed: ProjectConfig = { ...C, evidence: { ...C.evidence, developer_price: { status: 'confirmed_offer', source: 'הצעה חתומה' } } };
    expect(priceDependencyOf(c, { fractionSettled: null }, confirmed)).toBeNull();
  });
});

describe('F7: the interval solver', () => {
  const pred = (x: number) => (x >= 2 && x <= 3) || (x >= 7 && x <= 8);
  it('disconnected [2,3] and [7,8] on [0,10]: max 8, min 2', () => {
    expect(solveMax(0, 10, pred)).toBeCloseTo(8, 3);
    expect(solveMin(0, 10, pred)).toBeCloseTo(2, 3);
  });
  it('reports the intervals found, the resolution and whether the search is complete', () => {
    const r = solveIntervals(0, 10, pred);
    expect(r.intervals).toHaveLength(2);
    expect(r.intervals[1][1]).toBeCloseTo(8, 3);
    expect(r.resolution).toBeGreaterThan(0);
    expect(r.complete).toBe(false); // a feasible set narrower than the grid step could still be missed
  });
});
