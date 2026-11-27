import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ASSUMPTION_GROUPS, PROJECT_CONFIG as C } from '../../src/data/config';
import { withArrangement } from '../../src/domain/arrangements';
import { simulateCashflow } from '../../src/domain/cashflow';
import { constructionServiceTaxValuePerApartment } from '../../src/domain/construction';
import type { Goal, TaxArrangement, UserProfile } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { rightsBalance } from '../../src/optimizer/generate';

const goals: Goal[] = ['balanced', 'maximize_apartments', 'passive_income', 'immediate_cash', 'minimize_risk'];

const profileArb = fc.record({
  landAreaSqm: fc.double({ min: 20, max: 700, noNaN: true }),
  availableCapital: fc.option(fc.integer({ min: 0, max: 3_000_000 }), { nil: null }),
  maxMonthlyRepayment: fc.option(fc.constantFrom(0, 2500, 5000, 10000, 20000), { nil: null }),
  goal: fc.constantFrom(...goals),
}) as fc.Arbitrary<UserProfile>;

const termsArb = fc.record({
  combinationPct: fc.double({ min: 0.25, max: 0.45, noNaN: true }),
  developerMarkup: fc.double({ min: 0.15, max: 0.2, noNaN: true }),
});

describe('mathematical invariants', () => {
  it('rights are neither created nor destroyed; levy is assigned exactly once per right', () => {
    fc.assert(
      fc.property(profileArb, termsArb, (p, t) => {
        const d = analyzeProfile(p, t, C);
        const R = d.rights.apartmentEquivalents;
        for (const r of d.results) {
          expect(Math.abs(rightsBalance(r.candidate, R))).toBeLessThan(1e-9);
          const portions = r.ledger
            .filter((e) => e.category === 'betterment_levy' && e.payer !== 'seller')
            .reduce((s, e) => s + (e.rightsPortion ?? 0), 0);
          expect(portions).toBeCloseTo(R, 9);
          // Sold rights cannot remain owned.
          expect(r.plan.rightsSold + r.plan.rightsBuilt + r.plan.rightsHeld + r.plan.rightsInCombination + r.plan.rightsInRevenueShare)
            .toBeCloseTo(R + r.plan.rightsPurchased, 9);
        }
      }),
      { numRuns: 40 },
    );
  });

  it('combination services VAT is charged exactly once; a tax loan never covers more than the owner’s taxes', () => {
    fc.assert(
      fc.property(profileArb, termsArb, fc.constantFrom('gross', 'mixed', 'net') as fc.Arbitrary<TaxArrangement>, (p, t, arr) => {
        const cfg = withArrangement(C, arr);
        const d = analyzeProfile(p, t, cfg);
        const perEq = constructionServiceTaxValuePerApartment(cfg) * (cfg.taxation.vatRate / (1 + cfg.taxation.vatRate));
        for (const r of d.results) {
          const vat = r.ledger.filter((e) => e.category === 'services_vat');
          const expected = r.plan.rightsInCombination * t.combinationPct * perEq;
          expect(vat.reduce((s, e) => s + e.amount, 0)).toBeCloseTo(expected, 4);
          expect(new Set(vat.map((e) => e.payer)).size).toBeLessThanOrEqual(1);
          const eligible = r.ledger
            .filter((e) => e.payer === 'owner' && e.taxLoanEligible)
            .reduce((s, e) => s + e.amount, 0);
          expect(r.simulation.taxLoanDrawn).toBeLessThanOrEqual(eligible + 1);
        }
      }),
      { numRuns: 25 },
    );
  });

  it('infeasible or unknown strategies are never recommended; identical inputs give identical results', () => {
    fc.assert(
      fc.property(profileArb, termsArb, (p, t) => {
        const a = analyzeProfile(p, t, C);
        const b = analyzeProfile(p, t, C);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        if (a.recommendation) expect(['infeasible', 'unknown']).not.toContain(a.recommendation.feasibility);
        for (const r of a.ranked) expect(['infeasible', 'unknown']).not.toContain(r.feasibility);
        if (p.availableCapital === null) {
          for (const r of a.results) if (r.mortgageRequired > 1) expect(r.feasibility).not.toBe('estimated_feasible');
        }
      }),
      { numRuns: 25 },
    );
  });

  it('cash sources and uses reconcile (zero rates)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ month: fc.integer({ min: 0, max: 59 }), amount: fc.integer({ min: -900000, max: 900000 }) }), { maxLength: 12 }),
        fc.integer({ min: 0, max: 500000 }),
        (raw, start) => {
          const events = raw.map((e) => ({ ...e, label: 'x', category: 'construction' as const }));
          const s = simulateCashflow({
            events,
            startingCash: start,
            annualRate: 0,
            mortgageYears: 25,
            alternativeReturn: 0,
            permitMonth: 12,
            completionMonth: 30,
            horizonMonth: 60,
            liquidityMonth: 24,
            monthlyNetRent: 0,
            rentCountsForRepayment: false,
          });
          const net = start + events.reduce((acc, e) => acc + e.amount, 0);
          expect(s.cashAtHorizon - s.debtAtHorizon - s.personalPaymentsFV).toBeCloseTo(net, 4);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('provenance', () => {
  it('every external assumption carries source type, verification and retrieval date', () => {
    for (const g of ASSUMPTION_GROUPS) {
      for (const dp of g.items) {
        expect(dp.label).toBeTruthy();
        expect(dp.sourceType).toBeTruthy();
        expect(dp.verification).toBeTruthy();
        expect(dp.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        if (dp.verification === 'verified' || dp.sourceType === 'statutory') expect(dp.sourceUrl).toBeTruthy();
      }
    }
  });

  it('the immediate sale price is intentionally unknown and the developer price is unconfirmed', () => {
    expect(C.market.immediateLandSalePricePerSqm).toBeNull();
    expect(C.market.developerRightsSaleScenario.confirmedOffer).toBe(false);
  });
});
