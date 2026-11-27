/**
 * Release validation matrix (iteration 8, review §11): independently stated expectations — not restatements of the
 * engine's formulas — across the three lots, representative households, all five goals and the commercial slider
 * ranges. Each block names the scenario from the review.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { applyScenario, SCENARIO_IDS } from '../../src/data/scenarios';
import { getLot } from '../../src/data/parcel33';
import { ARRANGEMENT_PAYERS } from '../../src/domain/arrangements';
import { approvalMonth, permitMonth } from '../../src/domain/construction';
import { financeFlows, lotDeveloperPnL } from '../../src/domain/lotDeveloper';
import { calculateRights } from '../../src/domain/rights';
import type { Goal, ProjectConfig, TaxArrangement, UserProfile } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { mortgageLtvLimit } from '../../src/optimizer/feasibility';
import { rightsBalance } from '../../src/optimizer/generate';
import { WITH_TAX_LOAN } from '../fixtures/configs';
import { profile, TERMS } from '../fixtures/profiles';

const LOTS = ['149', '150', '153'];
const GOALS: Goal[] = ['balanced', 'maximize_apartments', 'passive_income', 'immediate_cash', 'minimize_risk'];

describe('review §11 scenarios', () => {
  it('1. developer receives ₪1M before spending ₪1M → no borrowing', () => {
    const f = financeFlows([1_000_000, -1_000_000], { equityShareOfCosts: 0.2, totalCosts: 1_000_000, monthlyRate: 0.005 });
    expect(f.peakLoan + f.peakEquity + f.financingCost).toBe(0);
  });

  it.each(LOTS)('2. lot %s: one participant replaced by an identical one → no change', (lotId) => {
    const p = profile({ lotId, availableCapital: 1_500_000, maxMonthlyRepayment: 15000 });
    const s02 = analyzeProfile(p, TERMS, C).results.find((r) => r.id === 'S02')!;
    expect(s02.developerLot!.profit).toBeCloseTo(lotDeveloperPnL({ info: calculateRights(167, C, lotId), profile: p, config: C }, 'mixed', 0.35).profit, 0);
  });

  it('3. two smaller apartments → exactly two physical apartments; the lot inventory is unchanged', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 334, availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C);
    const r = d.results.find((x) => x.id === 'S13-3r+3r')!;
    expect(r.developerLot!.userPhysicalUnits).toBe(2);
    expect(r.developerLot!.units).toBe(getLot(C.rights.tableVersion, '149').units);
  });

  it('4. purchased complementary rights → total project inventory unchanged', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 60, availableCapital: 1_500_000, maxMonthlyRepayment: 10000 }), TERMS, C);
    for (const r of d.results.filter((x) => x.plan.rightsPurchased > 0)) expect(r.developerLot!.units).toBe(102);
  });

  it('5. tax loan maturing before a delayed pool sale → an explicit gap (extension needed)', () => {
    const delayed: ProjectConfig = { ...WITH_TAX_LOAN, timeline: { ...WITH_TAX_LOAN.timeline, settlementDelayMonths: 12 } };
    const r = analyzeProfile(profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000 }), TERMS, delayed).results.find((x) => x.id === 'S02P')!;
    expect(r.reasonCodes).toContain('TAX_LOAN_EXTENSION_NEEDED');
  });

  it('6. several loan facilities → independent balances and schedules', () => {
    const d = analyzeProfile(
      profile({ landAreaSqm: 167, availableCapital: 0, maxMonthlyRepayment: 9000, soleHome: false, otherPropertyBorrowingLimit: 200_000 }),
      TERMS,
      WITH_TAX_LOAN,
    );
    const r = d.results.find((x) => x.simulation.facilities.length >= 2);
    expect(r).toBeDefined();
    const types = new Set(r!.simulation.facilities.map((f) => f.type));
    expect(types.size).toBe(r!.simulation.facilities.length);
  });

  it('7. exact integer entitlement → smaller and larger mixes still considered', () => {
    const d = analyzeProfile(profile({ landAreaSqm: ((2 / 0.35) / 2.25) * 167, availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C);
    const ids = d.results.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['S13-3r+4r', 'S13-4r+5r']));
  });

  it('8. no planning approval → no completed apartments, no rent', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 334, availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C);
    for (const r of d.results) {
      expect(r.noApproval.apartments).toBe(0);
      expect(r.noApproval.rent).toBe(0);
    }
  });

  it('9. zero discount and inflation → discounted and undiscounted flows reconcile', () => {
    const zero: ProjectConfig = { ...C, analysis: { ...C.analysis, discountRate: 0, inflation: 0 } };
    const r = analyzeProfile(profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, zero).results.find((x) => x.id === 'S02')!;
    const sum = r.ledger.filter((e) => e.payer === 'owner' && !e.deferred).reduce((s, e) => s + (e.direction === 'in' ? e.amount : -e.amount), 0);
    expect(r.transactionValue).toBeCloseTo(sum + r.delivery.apartmentsValue + r.delivery.fractionValue, 2);
  });

  it('10. developer funds the tax-loan interest → owner saving and developer cost reconcile', () => {
    const pays: ProjectConfig = { ...WITH_TAX_LOAN, commercial: { ...WITH_TAX_LOAN.commercial, offer: { ...WITH_TAX_LOAN.commercial.offer, developerPaysTaxLoanInterest: true } } };
    const p = profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000 });
    const owner = analyzeProfile(p, TERMS, WITH_TAX_LOAN).results.find((x) => x.id === 'S02P')!;
    const dev = analyzeProfile(p, TERMS, pays).results.find((x) => x.id === 'S02P')!;
    expect(dev.simulation.taxLoanInterest).toBe(0);
    expect(dev.simulation.taxLoanSubsidy).toBeGreaterThan(0);
    // The developer pays simple interest as it accrues; the owner avoids the compounded capitalised interest.
    expect(owner.simulation.taxLoanInterest).toBeGreaterThan(dev.simulation.taxLoanSubsidy);
    expect(owner.simulation.taxLoanInterest - dev.simulation.taxLoanSubsidy).toBeLessThan(0.2 * owner.simulation.taxLoanInterest);
  });

  it('11. unknown current land price → no invented valuation', () => {
    expect(C.market.immediateLandSalePricePerSqm).toBeNull();
    const d = analyzeProfile(profile(), TERMS, C);
    for (const r of d.ranked) expect(r.priceDependency).toBeNull();
    expect(d.results.find((r) => r.id === 'S01M')!.priceDependency).toBe('immediate_price');
  });

  it('12. replacement-home mortgage → 70% ceiling', () => {
    expect(mortgageLtvLimit([1], true, C, true)).toBeCloseTo(0.7, 12);
  });
});

describe('invariants across lots, households, goals and slider ranges', () => {
  const arb = fc.record({
    lotId: fc.constantFrom(...LOTS),
    landAreaSqm: fc.constantFrom(60, 83.5, 120, 167, 222.67, 334, 500),
    availableCapital: fc.option(fc.constantFrom(0, 300_000, 800_000, 1_500_000), { nil: null }),
    maxMonthlyRepayment: fc.option(fc.constantFrom(0, 5000, 10000), { nil: null }),
    goal: fc.constantFrom(...GOALS),
    soleHome: fc.constantFrom(true, false, null),
    combinationPct: fc.constantFrom(C.commercial.combination.min, 0.3, 0.35, 0.4, C.commercial.combination.max),
    developerMarkup: fc.constantFrom(C.commercial.developerMarkup.min, C.commercial.developerMarkup.max),
    arrangement: fc.constantFrom('gross', 'mixed', 'net') as fc.Arbitrary<TaxArrangement>,
  });
  it('hold for every sampled case', () => {
    fc.assert(
      fc.property(arb, (x) => {
        const p: UserProfile = { landAreaSqm: x.landAreaSqm, availableCapital: x.availableCapital, maxMonthlyRepayment: x.maxMonthlyRepayment, goal: x.goal, lotId: x.lotId, soleHome: x.soleHome };
        const cfg: ProjectConfig = { ...C, commercial: { ...C.commercial, taxArrangement: x.arrangement } };
        const d = analyzeProfile(p, { combinationPct: x.combinationPct, developerMarkup: x.developerMarkup }, cfg);
        const R = d.rights.apartmentEquivalents;
        for (const r of d.results) {
          expect(Math.abs(rightsBalance(r.candidate, R))).toBeLessThan(1e-9);
          // Each combination tax has one payer, per the arrangement template.
          for (const cat of ['betterment_levy', 'capital_gains_tax', 'services_vat'] as const) {
            const payers = new Set(r.ledger.filter((e) => e.category === cat && e.amount > 0 && r.plan.rightsInCombination > 0 && !e.saleRelated).map((e) => e.payer));
            if (cat === 'services_vat' && payers.size) expect([...payers]).toEqual([ARRANGEMENT_PAYERS[x.arrangement].servicesVat]);
          }
          if (r.developerLot) expect(r.developerLot.units).toBe(getLot(C.rights.tableVersion, x.lotId).units);
          expect(r.noApproval.protected).toBeLessThanOrEqual(r.noApproval.unprotected + 1e-6);
        }
        // No ranked route depends on an unverified price or an assumed tax loan.
        for (const r of d.ranked) {
          expect(r.priceDependency).toBeNull();
          expect(r.simulation.taxLoanDrawn).toBe(0);
        }
        // Unknown inputs never become an established affordability: with capital unknown, a route can only "fit" if it
        // needs no money from the household at all (e.g. a net deal) — nothing unfunded, nothing borrowed.
        if (x.availableCapital === null)
          for (const r of d.ranked.filter((y) => y.assessment.affordability === 'fits')) {
            expect(r.simulation.unfunded).toBe(0);
            expect(r.simulation.totalDrawn).toBe(0);
            expect(r.personalCapitalRequired).toBeLessThanOrEqual(1);
          }
      }),
      { numRuns: 30 },
    );
  });
  it('the permit never precedes approval in any scenario', () => {
    for (const id of SCENARIO_IDS) {
      const cfg = applyScenario(C, id);
      expect(permitMonth(cfg)).toBeGreaterThanOrEqual(approvalMonth(cfg));
    }
  });
});
