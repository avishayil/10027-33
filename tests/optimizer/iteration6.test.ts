/**
 * Iteration 6 (review of c482315): tax-loan cost and exposure, VAT reconciliation, fallback consistency, revenue
 * share tax payer, price-solver direction, collateral without unverified prices. Fixture values from the review.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { LAND_TRANSACTIONS } from '../../src/data/evidence';
import { simulateCashflow, type SimulationInput } from '../../src/domain/cashflow';
import { withArrangement } from '../../src/domain/arrangements';
import { candidatePnL } from '../../src/domain/developer';
import { calculateRights } from '../../src/domain/rights';
import { buildTransactionPlan } from '../../src/domain/transactions';
import type { Candidate, CashEvent, ProjectConfig } from '../../src/domain/types';
import { developerEquivalentPct } from '../../src/optimizer/arrangementEquivalence';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { WITH_TAX_LOAN } from '../fixtures/configs';
import { MODERATE, profile, TERMS } from '../fixtures/profiles';

const sim = (events: CashEvent[], rate: number, over: Partial<SimulationInput> = {}) =>
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
    taxLoan: { annualRate: rate },
    ...over,
  });
const tax = (amount: number): CashEvent => ({ month: 24, amount: -amount, label: 'מס', category: 'capital_gains_tax', taxLoanEligible: true });
const proceeds = (amount: number): CashEvent => ({ month: 60, amount, label: 'יחידת סל', category: 'fraction_settlement' });

describe('tax loan: maturity balance, exposure and cost (review §6)', () => {
  it('₪160,155 for 36 months: ₪195,992 at 6.75%, ₪203,223 at prime + 2% + VAT on interest (7.965%)', () => {
    expect(sim([tax(160_155)], 0.0675).taxLoanAtMaturity).toBeCloseTo(195_992, -1);
    expect(sim([tax(160_155)], 0.0675 * 1.18).taxLoanAtMaturity).toBeCloseTo(203_223, -1);
  });

  it('peak exposure is measured before a same-month repayment at delivery', () => {
    const s = sim([tax(160_155), proceeds(1_000_000)], 0.0675);
    expect(s.taxLoanAtMaturity).toBeCloseTo(195_992, -1);
    expect(s.peakDebt).toBeCloseTo(s.taxLoanAtMaturity, 0);
    expect(s.debtAtCompletion).toBe(0);
  });

  it('interest paid after delivery is reported (for the delivery-value metric)', () => {
    const s = sim([tax(160_155)], 0.0675);
    expect(s.interestAfterCompletion).toBeGreaterThan(0);
  });

  it('the delivery value deducts the capitalised tax-loan interest', () => {
    const r = analyzeProfile(MODERATE, TERMS, WITH_TAX_LOAN).results.find((x) => x.id === 'S02P')!;
    expect(r.simulation.taxLoanInterest).toBeGreaterThan(30_000);
    expect(r.delivery.interestToDelivery).toBeCloseTo(r.simulation.interestPaidToCompletion + r.simulation.taxLoanInterest, 4);
    const d = r.delivery;
    expect(d.netPosition).toBeCloseTo(d.apartmentsValue + d.fractionValue + d.ownerCashIn - d.ownerCashOut - d.interestToDelivery, 4);
  });
});

describe('developer VAT reconciles with the owner-side ledger (review §5)', () => {
  const info = calculateRights(167, C);
  const S02: Candidate = { id: 'S02', type: 'S02', targetApartments: 0, legs: [{ kind: 'combination', rights: info.apartmentEquivalents }] };
  it('in a net deal the developer’s barter VAT equals the services VAT in the ledger', () => {
    const cfg = withArrangement(C, 'net');
    const plan = buildTransactionPlan(S02, { info, profile: MODERATE, terms: TERMS, config: cfg });
    const ledgerVat = plan.ledger.filter((e) => e.category === 'services_vat' && e.payer === 'developer').reduce((s, e) => s + e.amount, 0);
    const line = candidatePnL(S02, plan, info, cfg, TERMS)!.lines.find((l) => l.label.startsWith('מע״מ על שירותי בנייה'))!;
    expect(ledgerVat).toBeCloseTo(183_212, -1);
    expect(-line.amount).toBeCloseTo(ledgerVat, 4);
  });
  it('the standalone net-equivalent of 35% mixed moves to ≈ 25.44%', () => {
    const v = developerEquivalentPct({ info, profile: MODERATE, config: C }, 'mixed', 0.35, 'net', 'standalone')!;
    expect(v).toBeCloseTo(0.2544, 3);
  });
});

describe('the gross fallback is the result computed under gross terms (review §12)', () => {
  it('carries the gross-run result, its arrangement and its %', () => {
    const d = analyzeProfile(profile({ availableCapital: 800_000, maxMonthlyRepayment: 5000 }), TERMS, C);
    expect(d.fallbackTerms).not.toBeNull();
    expect(d.fallbackTerms!.arrangement).toBe('gross');
    expect(d.fallbackTerms!.combinationPct).toBeGreaterThan(0.4);
    const ownerLevy = d.fallback!.ledger.filter((e) => e.payer === 'owner' && e.category === 'betterment_levy').reduce((s, e) => s + e.amount, 0);
    expect(ownerLevy).toBeGreaterThan(0);
  });
});

describe('revenue share follows the arrangement’s capital-gains payer (review §12)', () => {
  const info = calculateRights(167, C);
  const S04: Candidate = { id: 'S04', type: 'S04', targetApartments: 0, legs: [{ kind: 'revenue_share', rights: info.apartmentEquivalents }] };
  const cg = (arr: 'mixed' | 'net', payer: string) =>
    buildTransactionPlan(S04, { info, profile: MODERATE, terms: TERMS, config: withArrangement(C, arr) })
      .ledger.filter((e) => e.category === 'capital_gains_tax' && e.payer === payer)
      .reduce((s, e) => s + e.amount, 0);
  it('net: the developer pays the owner’s tax, grossed up; the owner pays none', () => {
    expect(cg('net', 'owner')).toBe(0);
    expect(cg('net', 'developer')).toBeCloseTo(cg('mixed', 'owner') / 0.75, 4);
  });
});

describe('price thresholds have a direction (review §13)', () => {
  it('buying complementary rights: the highest affordable price, not the lowest', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 60, availableCapital: 1_500_000, maxMonthlyRepayment: 10000 }), TERMS, C);
    const buys = d.priceConditional.filter((p) => p.result.candidate.legs.some((l) => l.kind === 'buy_rights'));
    expect(buys.length).toBeGreaterThan(0);
    for (const b of buys) {
      expect(b.threshold.knob).toBe('complementary_price');
      expect(b.threshold.direction).toBe('max');
      if (b.threshold.required !== null) expect(b.threshold.required).toBeGreaterThan(0);
    }
  });
  it('selling: still the lowest acceptable price', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    for (const p of d.priceConditional.filter((x) => x.threshold.knob === 'developer_price')) expect(p.threshold.direction).toBe('min');
  });
});

describe('no unverified price decides collateral or the ranking (review §8)', () => {
  const doubled: ProjectConfig = {
    ...C,
    market: { ...C.market, developerRightsSaleScenario: { ...C.market.developerRightsSaleScenario, pricePerOriginalSqm: C.market.developerRightsSaleScenario.pricePerOriginalSqm * 2 } },
  };
  it('pre-delivery collateral = retained rights × the appraisal allocation value per right', () => {
    const d = analyzeProfile(profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }), TERMS, C);
    const perRight = d.rights.table.allocationValue / d.rights.apartmentEquivalents;
    for (const r of d.results) expect(r.plan.preCompletionLandCollateral).toBeCloseTo(r.plan.retainedLandRights * perRight, 4);
  });
  it('changing the hypothetical developer price changes no evidence-based result', () => {
    for (const p of [MODERATE, profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }), profile({ landAreaSqm: 334, availableCapital: 1_500_000, maxMonthlyRepayment: 15000 })]) {
      const a = analyzeProfile(p, TERMS, C);
      const b = analyzeProfile(p, TERMS, doubled);
      expect(b.ranked.map((r) => r.id)).toEqual(a.ranked.map((r) => r.id));
      for (const r of a.results.filter((x) => x.priceDependency === null)) {
        const s = b.results.find((x) => x.id === r.id)!;
        expect(s.plan.preCompletionLandCollateral).toBeCloseTo(r.plan.preCompletionLandCollateral, 4);
        expect(s.assessment.affordability).toBe(r.assessment.affordability);
        expect(s.delivery.netPosition).toBeCloseTo(r.delivery.netPosition, 4);
      }
    }
  });
});

describe('evidence provenance (review §9)', () => {
  it('only the 2024 parcel-33 deals cite the appraisal p.63; later ones cite LandCheck alone', () => {
    for (const t of LAND_TRANSACTIONS.filter((x) => x.parcel === 33)) {
      if (t.date >= '2025') {
        expect(t.page).toBeUndefined();
        expect(t.source).toBe('LandCheck');
      } else expect(t.page).toBe(63);
    }
  });
});

describe('tax financing is conditional, not assumed (review §7)', () => {
  it('by default no ranked route relies on a tax loan', () => {
    for (const p of [MODERATE, profile({ availableCapital: 0, maxMonthlyRepayment: 5000 }), profile({ landAreaSqm: 222.67, availableCapital: 300_000 })]) {
      const d = analyzeProfile(p, TERMS, C);
      for (const r of d.ranked) expect(r.simulation.taxLoanDrawn).toBe(0);
    }
  });

  it('the tax loan appears as a funding alternative: prime + 2% + VAT on interest, with its cost', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    const loan = d.fundingAlternatives.find((f) => f.method === 'developer_loan')!;
    expect(loan).toBeDefined();
    expect(loan.annualRate).toBeCloseTo(0.0675 * 1.18, 9);
    expect(loan.top).not.toBeNull();
    expect(loan.loan).toBeGreaterThan(100_000);
    expect(loan.interest).toBeGreaterThan(0);
    expect(loan.atMaturity).toBeCloseTo(loan.loan + loan.interest, 0);
    // If the developer also pays the interest, the owner saves exactly that interest.
    expect(loan.savingIfDeveloperPaysInterest).toBeCloseTo(loan.interest, 0);
    expect(loan.maxRate).not.toBeNull();
  });

  it('with nothing fitting, the direction is the tax loan under the offer’s own terms — before asking for net terms', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    expect(d.recommendation).toBeNull();
    expect(d.conditionalRecommendation!.kind).toBe('funding');
    expect(d.conditionalRecommendation!.arrangement).toBe('mixed');
    expect(d.conditionalRecommendation!.combinationPct).toBe(0.35);
  });

  it('the loan is capped at a share of the entitlement value', () => {
    const tight: ProjectConfig = { ...WITH_TAX_LOAN, financing: { ...WITH_TAX_LOAN.financing, taxLoan: { ...WITH_TAX_LOAN.financing.taxLoan, maxShareOfEntitlement: 0.05 } } };
    const r = analyzeProfile(MODERATE, TERMS, tight).results.find((x) => x.id === 'S02P')!;
    const entitlement = 0.7875 * 2_500_000;
    expect(r.simulation.taxLoanDrawn).toBeLessThanOrEqual(0.05 * entitlement + 1);
    expect(r.simulation.unfunded).toBeGreaterThan(0);
  });

  it('refinancing at delivery and repayment from the pool sale are conditions', () => {
    const pool = analyzeProfile(MODERATE, TERMS, WITH_TAX_LOAN).results.find((x) => x.id === 'S02P')!;
    expect(pool.requiredConditions).toContain('REPAID_FROM_POOL_SALE');
    const three = analyzeProfile(profile({ landAreaSqm: 222.67, availableCapital: 0, maxMonthlyRepayment: 7000, soleHome: true }), TERMS, WITH_TAX_LOAN).results.find((x) => x.id === 'S02')!;
    expect(three.requiredConditions).toContain('TAX_LOAN_REFINANCE');
  });
});

describe('borrowing against another property needs a stated limit (review §12)', () => {
  const owns = { landAreaSqm: 167, availableCapital: 0, maxMonthlyRepayment: 5000, goal: 'balanced' as const, lotId: '150', soleHome: false };
  it('without a limit it is a conditional funding route, not assumed in the ranking', () => {
    const d = analyzeProfile(owns, { combinationPct: 0.325, developerMarkup: 0.175 }, C);
    for (const r of d.ranked) expect(r.simulation.taxesFinancedBySecuredLoan).toBe(0);
    expect(d.fundingAlternatives.some((f) => f.method === 'other_property' && f.top)).toBe(true);
  });
  it('with a limit it is available up to that limit', () => {
    const d = analyzeProfile({ ...owns, otherPropertyBorrowingLimit: 100_000 }, { combinationPct: 0.325, developerMarkup: 0.175 }, C);
    for (const r of d.results) expect(r.simulation.taxesFinancedBySecuredLoan).toBeLessThanOrEqual(100_000 + 1);
  });
});

describe('ranking on delivery economics (review §12)', () => {
  it('the ranking value is the position at delivery minus interest paid after delivery', () => {
    const d = analyzeProfile(profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }), TERMS, C);
    for (const r of d.results) {
      expect(r.metrics.valueCreated).toBeCloseTo(r.delivery.netPosition - r.simulation.interestAfterCompletion, 4);
      expect(r.deliveryValue).toBe(r.metrics.valueCreated);
    }
  });
  it('the scenario table reports the delivery value per scenario', () => {
    const r = analyzeProfile(MODERATE, TERMS, C).results[0];
    for (const s of r.scenarioResults) expect(typeof s.deliveryValue).toBe('number');
  });
});
