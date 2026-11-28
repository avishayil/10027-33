/**
 * Iteration-4 fixtures (review of de1e4d7). Expected values computed independently in the test.
 * Levy = allocation-table proxy, not an assessment.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
// Pinned to the simulation basis (2.25 rights per 167 m²): numbers reconciled on it (iteration 10).
import { C_SIM as C } from '../fixtures/configs';
import { LAND_TRANSACTIONS } from '../../src/data/evidence';
import { calculateRights } from '../../src/domain/rights';
import type { Goal } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { GROSS, ITERATION4_TAX_TERMS, NET, NO_TAX_LOAN } from '../fixtures/configs';
import { MODERATE, TERMS, profile } from '../fixtures/profiles';

const incoming = (A: number) => (25_521_300 * A) / 21_258;
const outgoing = { '149': 30_360_000 * 0.02353, '150': 30_360_000 * 0.02353, '153': 30_210_000 * 0.02365 };

describe('betterment levy proxy — exact per lot and holding', () => {
  it('167 m²: incoming 200,491.91, outgoing 714,370.80 / 714,466.50, levy 256,939.44 / 256,987.29', () => {
    expect(incoming(167)).toBeCloseTo(200_491.9136, 3);
    for (const lot of ['149', '150', '153'] as const) {
      const r = calculateRights(167, C, lot);
      expect(r.table.incomingValue).toBeCloseTo(incoming(167), 3);
      expect(r.table.allocationValue).toBeCloseTo(outgoing[lot], 3);
      expect(r.bettermentLevy).toBeCloseTo((outgoing[lot] - incoming(167)) / 2, 3);
    }
    expect(calculateRights(167, C, '149').bettermentLevy).toBeCloseTo(256_939.4432, 3);
    expect(calculateRights(167, C, '153').bettermentLevy).toBeCloseTo(256_987.2932, 3);
    expect(calculateRights(167, C, '149').table.units).toBeCloseTo(2.40006, 5);
    expect(calculateRights(167, C, '150').table.units).toBeCloseTo(2.25888, 5);
  });

  it('scales linearly: 83.5 m² is half, 334 m² double', () => {
    const base = calculateRights(167, C, '149').bettermentLevy;
    expect(calculateRights(83.5, C, '149').bettermentLevy).toBeCloseTo(base / 2, 6);
    expect(calculateRights(334, C, '149').bettermentLevy).toBeCloseTo(base * 2, 6);
  });

  it('unknown lot → lot 149 assumed and flagged, levy shown as a range; an invalid lot is an error', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    expect(d.lotAssumed).toBe(true);
    expect(d.levyRangeAcrossLots.min).toBeCloseTo(256_939.4432, 3);
    expect(d.levyRangeAcrossLots.max).toBeCloseTo(256_987.2932, 3);
    expect(analyzeProfile(profile({ lotId: '153' }), TERMS, C).lotAssumed).toBe(false);
    expect(() => calculateRights(167, C, '44')).toThrow();
  });
});

describe('who pays the levy — allocations reconcile to the proxy', () => {
  const L = 256_939.4432;
  const rich = profile({ availableCapital: 3_000_000, maxMonthlyRepayment: 30000 });
  const byId = (cfg: typeof C, id: string) => analyzeProfile(rich, TERMS, cfg).results.find((r) => r.id === id)!;

  it('combination: gross → owner pays all; mixed / net → the developer (contractually)', () => {
    const g = byId(GROSS, 'S02').levy;
    expect(g.total).toBeCloseTo(L, 3);
    expect(g.owner).toBeCloseTo(L, 3);
    expect(g.developer).toBe(0);
    for (const cfg of [C, NET]) {
      const m = byId(cfg, 'S02').levy;
      expect(m.owner).toBe(0);
      expect(m.developer).toBeCloseTo(L, 3);
    }
  });

  it('S11 (35%, one apartment): owner ≈ ₪37,333 on the built share, developer ≈ ₪219,606', () => {
    const s = byId(C, 'S11-1').levy;
    const built = (1 - 2.25 * 0.35) / 0.65;
    expect(s.owner).toBeCloseTo((L * built) / 2.25, 3);
    expect(Math.round(s.owner)).toBe(37_333);
    expect(Math.round(s.developer)).toBe(219_606);
    expect(s.owner + s.developer).toBeCloseTo(L, 3);
  });

  it('partial sale + build one: the owner pays it all — ≈ ₪142,744 on the sold rights, ≈ ₪114,195 on the built one', () => {
    const r = byId(C, 'S05-1');
    const levyEntries = r.ledger.filter((e) => e.category === 'betterment_levy' && e.payer === 'owner');
    const sold = levyEntries.find((e) => e.saleRelated)!.amount;
    const built = levyEntries.find((e) => !e.saleRelated)!.amount;
    expect(Math.round(sold)).toBe(142_744);
    expect(Math.round(built)).toBe(114_195);
    expect(r.levy.owner).toBeCloseTo(L, 3);
  });

  it('a pre-approval sale transfers the future exposure to the buyer — not "zero levy"', () => {
    const s = byId(C, 'S01M').levy;
    expect(s.owner).toBe(0);
    expect(s.buyer).toBeCloseTo(L, 3);
  });
});

describe('evidence first', () => {
  it('the transaction registry keeps the parcel-33 sample and dates; the latest is 16.04.2026, before the update', () => {
    const p33 = LAND_TRANSACTIONS.filter((t) => t.parcel === 33);
    expect(p33).toHaveLength(11);
    expect([...p33].sort((a, b) => b.date.localeCompare(a.date))[0]).toMatchObject({ date: '2026-04-16', price: 300000 });
  });

  it('land references: dated history and appraisal anchors; current market price and developer offer unknown', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    const ref = (s: string) => d.landReferences.find((l) => l.label.includes(s))!;
    expect(ref('האחרונה').amount).toBeCloseTo(300_000, 6);
    expect(ref('שווי הזכויות בטבלת').amount).toBeCloseTo(714_370.8, 3);
    expect(ref('פחות אומדן היטל').amount).toBeCloseTo(457_431.3568, 3);
    expect(ref('בשוק החופשי היום').amount).toBeNull();
    expect(ref('שיזם מציע').amount).toBeNull();
  });

  it('no route that depends on an unverified price is ever ranked or recommended (property)', () => {
    const goals: Goal[] = ['balanced', 'maximize_apartments', 'passive_income', 'immediate_cash', 'minimize_risk'];
    fc.assert(
      fc.property(
        fc.double({ min: 30, max: 700, noNaN: true }),
        fc.integer({ min: 0, max: 3_000_000 }),
        fc.constantFrom(0, 5000, 15000, null),
        fc.constantFrom(...goals),
        (area, cap, P, goal) => {
          const d = analyzeProfile({ landAreaSqm: area, availableCapital: cap, maxMonthlyRepayment: P, goal }, TERMS, C);
          for (const r of d.ranked) expect(r.priceDependency).toBeNull();
          for (const p of d.priceConditional) expect(p.result.priceDependency).not.toBeNull();
        },
      ),
      { numRuns: 15 },
    );
  });

  it('when no evidence-based route fits, the closest routes come with the extra capital they need', () => {
    // Iteration-4 tax terms (no tax loan, VAT on the developer): ₪300K is below the owner tax at approval.
    const d = analyzeProfile(MODERATE, TERMS, ITERATION4_TAX_TERMS);
    expect(d.recommendation).toBeNull();
    expect(d.nearMiss.length).toBeGreaterThan(0);
    // With 0% return on cash, the extra capital needed equals the unfunded obligation exactly.
    for (const n of d.nearMiss) {
      expect(n.additionalCapital).not.toBeNull();
      expect(n.additionalCapital!).toBeCloseTo(n.result.simulation.unfunded, -1);
    }
    expect(d.nearMiss[0].result.id).toBe('S11-1');
    // Iteration 9 / F04: taxes due at approval are now in nominal shekels (2% a year), so the gap grew from ≈₪10.6K
    // to ≈₪25.8K — the cash still has to be there in the shekels of that date.
    expect(d.nearMiss[0].additionalCapital!).toBeLessThan(30_000);
  });

  it('developer P&L includes the lot’s public-building obligation (325 m² × ₪8,000 × lot share)', () => {
    const r = analyzeProfile(profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C).results.find((x) => x.id === 'S02')!;
    const line = r.developerPnL!.lines.find((l) => l.label.includes('מבני הציבור'))!;
    expect(line.amount).toBeCloseTo(-0.02353 * 325 * 8000, 6);
  });
});

describe('regression: no cash, ₪5K/month, owns another property (reported scenario)', () => {
  // 167 m², lot 150, ₪0 free cash, ₪5,000/month, balanced, 32.5% / 17.5%, basis ₪200,000.
  const base = { landAreaSqm: 167, availableCapital: 0, maxMonthlyRepayment: 5000, goal: 'balanced' as Goal, lotId: '150', acquisitionBasis: 200000 };
  const terms = { combinationPct: 0.325, developerMarkup: 0.175 };

  it('owning another property: the tax can be financed by a loan secured on it → a real (conditional) recommendation', () => {
    // With a stated borrowing limit (iteration 6: without one the loan is a conditional funding route).
    const d = analyzeProfile({ ...base, soleHome: false, otherPropertyBorrowingLimit: 1_000_000 }, terms, C);
    const r = d.recommendation!;
    expect(r).not.toBeNull();
    expect(r.simulation.unfunded).toBe(0);
    expect(r.simulation.taxesFinancedBySecuredLoan).toBeGreaterThan(200000);
    expect(r.requiredConditions).toContain('SECURED_LOAN_OTHER_PROPERTY');
    expect(r.monthlyRepayment).toBeLessThanOrEqual(5000);
  });

  it('no other property and no tax loan: the verdict still gives a direction — conditional on other tax terms', () => {
    for (const soleHome of [true, null]) {
      const d = analyzeProfile({ ...base, soleHome }, terms, NO_TAX_LOAN);
      expect(d.recommendation).toBeNull();
      expect(d.conditionalRecommendation).not.toBeNull();
      expect(d.conditionalRecommendation!.arrangement).toBe('net');
      expect(d.conditionalRecommendation!.result.simulation.unfunded).toBe(0);
    }
  });

  it('no other property: a developer/bank tax loan is the direction — conditional, not assumed (iteration 6)', () => {
    for (const soleHome of [true, null]) {
      const d = analyzeProfile({ ...base, soleHome }, terms, C);
      expect(d.recommendation).toBeNull();
      const c = d.conditionalRecommendation!;
      expect(c.kind).toBe('funding');
      expect(c.method).toBe('developer_loan');
      expect(c.result.simulation.unfunded).toBe(0);
      expect(c.result.simulation.taxLoanDrawn).toBeGreaterThan(200000);
      expect(c.result.requiredConditions).toContain('TAX_LOAN');
      expect(c.result.monthlyRepayment).toBeLessThanOrEqual(5000);
    }
  });

  it('the tax loan is secured on the other property, so it does not count against the project’s LTV', () => {
    const d = analyzeProfile({ ...base, soleHome: false, otherPropertyBorrowingLimit: 1_000_000 }, terms, C);
    const s13 = d.results.find((r) => r.id === 'S13-3r')!;
    expect(s13.reasonCodes).not.toContain('LTV_EXCEEDED');
    expect(s13.simulation.taxesFinancedBySecuredLoan).toBeGreaterThan(200000);
    expect(s13.simulation.peakPostCompletionLtv).toBeLessThan(0.75);
  });

  it('with the goal "as many apartments as possible" the household gets a whole apartment within its ₪5K/month', () => {
    const d = analyzeProfile({ ...base, soleHome: false, otherPropertyBorrowingLimit: 1_000_000, goal: 'maximize_apartments' }, terms, C);
    const r = d.recommendation!;
    expect(r.metrics.wholeApartments).toBeGreaterThanOrEqual(1);
    expect(r.monthlyRepayment).toBeLessThanOrEqual(5000);
  });

  it('without the secured loan the project LTV is unchanged (no other property)', () => {
    const r = analyzeProfile({ ...base, availableCapital: 300000, soleHome: true }, terms, C).results.find((x) => x.id === 'S06-1')!;
    expect(r.simulation.taxesFinancedBySecuredLoan).toBe(0);
  });

  it('never finances taxes with a loan when the household ruled out borrowing', () => {
    const d = analyzeProfile({ ...base, soleHome: false, maxMonthlyRepayment: 0 }, terms, C);
    for (const r of d.results) expect(r.simulation.taxesFinancedBySecuredLoan).toBe(0);
  });
});

describe('selling the fractional share is a disposal of retained property', () => {
  it('pool / buy-back tax is on the gain over the services value already taxed — not on the gross amount', () => {
    const d = analyzeProfile(profile({ availableCapital: 1_000_000, maxMonthlyRepayment: 10000 }), TERMS, C);
    const r = d.results.find((x) => x.id === 'S02P')!;
    const e = 2.25 * 0.35;
    const basis = e * 100 * 11000 * 1.175 * 1.18; // taxable services value received
    const amount = e * 2_500_000 * 0.98; // pool sale net of 2% costs (today's prices)
    const tax = r.ledger.find((x) => x.label.includes('הפיצוי'))!.amount;
    expect(tax).toBeCloseTo(0.25 * (amount - basis), 2);
    expect(tax).toBeLessThan(0.25 * amount);
  });
});

describe('purchase tax on completion when the plan has two apartments', () => {
  it('a sole-home answer does not exempt the completed second apartment', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 334, availableCapital: 1_000_000, maxMonthlyRepayment: 8000, soleHome: true }), TERMS, C);
    for (const id of ['S13-3r', 'S06-2']) {
      const r = d.results.find((x) => x.id === id)!;
      expect(r.metrics.wholeApartments).toBe(2);
      // Completion price × 8% (additional home), not 0%.
      expect(r.purchaseTax).toBeCloseTo(r.delivery.constructionAndCompletionPaid * 0.08, 0);
    }
  });
  it('a single completed apartment that will be the only home stays at 0%', () => {
    const d = analyzeProfile(profile({ landAreaSqm: 167, availableCapital: 600000, maxMonthlyRepayment: 8000, soleHome: true }), TERMS, C);
    expect(d.results.find((x) => x.id === 'S13-3r')!.purchaseTax).toBe(0);
  });
});
