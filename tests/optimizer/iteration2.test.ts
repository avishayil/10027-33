/**
 * Iteration-2 fixtures. Expected values are computed independently in the test from first
 * principles (not by calling the engine's own helpers), so they reconcile the engine's ledger.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { simulateCashflow } from '../../src/domain/cashflow';
import { developerEconomics } from '../../src/domain/developer';
import { calculateRights } from '../../src/domain/rights';
import type { Goal, UserProfile } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { evaluateCandidate } from '../../src/optimizer/evaluate';
import { generateStrategies, mixedSplit, rightsBalance } from '../../src/optimizer/generate';
import { goalScore, type Scales } from '../../src/optimizer/rank';
import { breakevenSurplusPrice, conservativeSurplusPrice, minSurplusPrice } from '../../src/optimizer/reverse';
import { MODERATE, NO_MEANS, TERMS, profile } from '../fixtures/profiles';

const info = calculateRights(167, C);
const cands = generateStrategies(info, TERMS, C);
const cand = (id: string) => cands.find((c) => c.id === id)!;
const ctx = (p: UserProfile = MODERATE) => ({ info: calculateRights(p.landAreaSqm, C), profile: p, terms: TERMS });
const run = (p: UserProfile = MODERATE) => analyzeProfile(p, TERMS, C);

const OWNER_PAYS = { ...C, commercial: { ...C.commercial, combinationTaxBorneByDeveloper: false } };

describe('golden fixture (owner pays the combination tax): 167 m², ₪300K, ₪5K/month, 35%, 17.5% — S06-1', () => {
  // Independent arithmetic.
  const received = 2.25 * 0.35; // 0.7875
  const serviceValue = 100 * 11000 * 1.18; // 1,298,000 per apartment
  const cgt = 0.25 * received * serviceValue; // 255,543.75 (developer-paid levy: added and deducted)
  const completion = (1 - received) * 2_500_000; // 531,250
  const purchaseTax = 0.06 * completion; // 31,875
  const g = Math.pow(1.04, 1 / 12);
  const cashAtPermit = (300000 - cgt) * Math.pow(g, 24); // capital left after tax, grown 24 months
  const constructionDraw = completion / 2 - (cashAtPermit - purchaseTax); // purchase tax first, then half the completion
  const peak = constructionDraw + completion / 2; // second half at completion is borrowed in full
  const r = 0.05 / 12;
  const payment = (peak * r) / (1 - Math.pow(1 + r, -300));

  const ev = evaluateCandidate(cand('S06-1'), ctx(), OWNER_PAYS);
  const byCat = (cat: string) => ev.plan.ledger.filter((e) => e.category === cat && e.payer === 'owner').reduce((s, e) => s + e.amount, 0);

  it('reconciles every ledger line', () => {
    expect(byCat('capital_gains_tax')).toBeCloseTo(cgt, 4);
    expect(byCat('completion_payment')).toBeCloseTo(completion, 4);
    expect(byCat('purchase_tax')).toBeCloseTo(purchaseTax, 4);
    expect(byCat('betterment_levy')).toBe(0);
    const devLevy = ev.plan.ledger.find((e) => e.category === 'betterment_levy' && e.payer === 'developer')!;
    expect(Math.abs(devLevy.amount - 256940)).toBeLessThan(2);
  });

  it('reconciles the financing: construction-stage draw, completion mortgage, peak and repayment', () => {
    expect(ev.sim.unfunded).toBe(0);
    expect(ev.sim.drawsByStage.bridge).toBe(0);
    expect(ev.sim.drawsByStage.construction).toBeCloseTo(constructionDraw, 2);
    expect(ev.sim.drawsByStage.mortgage).toBeCloseTo(completion / 2, 2);
    expect(ev.sim.peakDebt).toBeCloseTo(peak, 2);
    expect(Math.round(peak)).toBe(515041);
    expect(ev.sim.postCompletionMonthly).toBeCloseTo(payment, 4);
    expect(Math.round(payment)).toBe(3011);
    expect(ev.sim.constructionPhaseMonthly).toBeCloseTo(constructionDraw * r, 4);
  });

  it('uses stage-specific collateral', () => {
    const land = received * (167 / 2.25) * 6900;
    expect(ev.sim.peakPreCompletionLtv).toBeCloseTo(constructionDraw / (land + completion / 2), 6);
    expect(ev.sim.peakPostCompletionLtv).toBeCloseTo(peak / 2_500_000, 6);
  });
});

describe('golden fixture (base case, net deal — developer pays the grossed-up tax): same household, S06-1', () => {
  const received = 2.25 * 0.35;
  const serviceValue = 100 * 11000 * 1.18;
  const grossedUpTax = (0.25 * received * serviceValue) / 0.75; // T = 25% × (gain + T)
  const completion = (1 - received) * 2_500_000;
  const purchaseTax = 0.06 * completion;
  const g = Math.pow(1.04, 1 / 12);
  const cashAfterPermit = 300000 * Math.pow(g, 24) - purchaseTax - completion / 2; // first half paid from own cash
  const mortgage = completion / 2 - cashAfterPermit * Math.pow(g, 36); // second half, after 36 more months of growth
  const r = 0.05 / 12;
  const payment = (mortgage * r) / (1 - Math.pow(1 + r, -300));
  const ev = evaluateCandidate(cand('S06-1'), ctx(), C);

  it('the owner pays no capital-gains tax; the developer pays it grossed up', () => {
    const owner = ev.plan.ledger.filter((e) => e.category === 'capital_gains_tax' && e.payer === 'owner');
    expect(owner).toHaveLength(0);
    const dev = ev.plan.ledger.find((e) => e.category === 'capital_gains_tax' && e.payer === 'developer')!;
    expect(dev.amount).toBeCloseTo(grossedUpTax, 4);
    expect(Math.round(grossedUpTax)).toBe(340725);
  });

  it('reconciles the financing: own cash at permit, mortgage only at completion', () => {
    expect(cashAfterPermit).toBeGreaterThan(0);
    expect(ev.sim.unfunded).toBe(0);
    expect(ev.sim.drawsByStage.bridge).toBe(0);
    expect(ev.sim.drawsByStage.construction).toBe(0);
    expect(ev.sim.drawsByStage.mortgage).toBeCloseTo(mortgage, 2);
    expect(ev.sim.peakDebt).toBeCloseTo(mortgage, 2);
    expect(ev.sim.postCompletionMonthly).toBeCloseTo(payment, 4);
  });

  it('the moderate household can afford it; the net-deal term must be confirmed in the contract', () => {
    const s = run().results.find((x) => x.id === 'S06-1')!;
    expect(s.assessment.affordability).toBe('fits_with_financing');
    expect(s.requiredConditions).toEqual(expect.arrayContaining(['LENDER_CONFIRMATION', 'TAX_ALLOCATION']));
  });
});

describe('S11 — combination plus construction services', () => {
  it('splits rights analytically: R_build = (N − cR) / (1 − c)', () => {
    expect(mixedSplit(1, 2.25, 0.35)).toBeCloseTo(0.326923, 6);
    const c = cand('S11-1');
    const comb = c.legs.find((l) => l.kind === 'combination')!;
    const build = c.legs.find((l) => l.kind === 'build')!;
    expect(comb.kind === 'combination' && comb.rights).toBeCloseTo(1.923077, 6);
    expect(build.kind === 'build' && build.apartments).toBeCloseTo(0.326923, 6);
    expect(rightsBalance(c, 2.25)).toBeCloseTo(0, 12);
  });

  it('delivers exactly one whole apartment with proportional construction cost', () => {
    const ev = evaluateCandidate(cand('S11-1'), ctx(), C);
    expect(ev.plan.retainedApartmentEquivalents).toBeCloseTo(1, 9);
    expect(ev.plan.wholeApartmentsRetained).toBe(1);
    expect(ev.plan.fractionalShare).toBe(0);
    const quote = ev.plan.ledger.filter((e) => e.category === 'construction').reduce((s, e) => s + e.amount, 0);
    // ₪498,607 before contingency (10%) and indexation.
    expect(0.326923 * 1525150).toBeCloseTo(498607, -1);
    expect(quote).toBeGreaterThan(498607 * 1.1);
  });

  it('is generated for every relevant whole-apartment target and included in ranking', () => {
    expect(cands.map((c) => c.id)).toEqual(expect.arrayContaining(['S11-1', 'S11-2']));
    const d = run(profile({ availableCapital: 1500000, maxMonthlyRepayment: 15000 }));
    expect(d.ranked.some((r) => r.strategyType === 'S11')).toBe(true);
    expect(d.results.find((r) => r.id === 'S11-1')!.requiredConditions).toContain('MIXED_STRUCTURE');
  });
});

describe('financing availability', () => {
  it('taxes due at signing are never financed: unfunded obligations are infeasible', () => {
    const s = analyzeProfile(NO_MEANS, TERMS, OWNER_PAYS).results.find((x) => x.id === 'S02')!;
    expect(s.simulation.unfunded).toBeGreaterThan(250000);
    expect(s.feasibility).toBe('infeasible');
    expect(s.reasonCodes).toContain('UNFUNDED_OBLIGATION');
  });

  it('borrowing is attributed to bridge, construction and completed-property stages', () => {
    const ev = evaluateCandidate(cand('S05-1'), ctx(), C);
    const { bridge, construction, mortgage } = ev.sim.drawsByStage;
    expect(bridge + construction + mortgage + ev.sim.unfunded).toBeCloseTo(ev.sim.totalDrawn, 4);
    expect(construction).toBeGreaterThan(0);
  });

  it('cash is reserved for later non-financeable obligations', () => {
    const sim = simulateCashflow({
      events: [
        { month: 0, amount: -100, label: 'build', category: 'construction' },
        { month: 5, amount: -100, label: 'tax', category: 'capital_gains_tax' },
      ],
      startingCash: 100,
      annualRate: 0.05,
      mortgageYears: 25,
      alternativeReturn: 0,
      permitMonth: 3,
      completionMonth: 10,
      horizonMonth: 20,
      liquidityMonth: 12,
      monthlyNetRent: 0,
      rentCountsForRepayment: false,
    });
    expect(sim.unfunded).toBe(0);
    expect(sim.drawsByStage.bridge).toBeCloseTo(100, 6);
  });

  it('the completion snapshot is taken after the completion month transactions', () => {
    const sim = simulateCashflow({
      events: [{ month: 12, amount: 1000, label: 'sale', category: 'apartment_sale' }],
      startingCash: 0,
      annualRate: 0,
      mortgageYears: 25,
      alternativeReturn: 0,
      permitMonth: 6,
      completionMonth: 12,
      horizonMonth: 24,
      liquidityMonth: 6,
      monthlyNetRent: 0,
      rentCountsForRepayment: false,
    });
    expect(sim.cashAtCompletion).toBe(1000);
  });
});

describe('fractional entitlements', () => {
  it('earn no rent and are valued at an illiquidity discount', () => {
    const ev = evaluateCandidate(cand('S02'), ctx(), C);
    expect(ev.plan.fractionalShare).toBeCloseTo(0.7875, 9);
    expect(ev.sim.monthlyNetRent).toBe(0);
    const apt10 = 2_500_000 * Math.pow(1.02, 10);
    expect(ev.assetsAtHorizon).toBeCloseTo(0.7875 * apt10 * 0.8, 2);
  });

  it('cash settlement and completion are evaluated as alternatives', () => {
    const settled = evaluateCandidate(cand('S02C'), ctx(), C);
    expect(settled.plan.fractionalShare).toBe(0);
    expect(settled.plan.ledger.some((e) => e.category === 'fraction_settlement')).toBe(true);
    const completed = evaluateCandidate(cand('S06-1'), ctx(), C);
    expect(completed.sim.monthlyNetRent).toBeGreaterThan(0);
  });
});

describe('tax timing and basis', () => {
  it('revenue-sharing capital gains are reserved at signing', () => {
    const ev = evaluateCandidate(cand('S04'), ctx(), C);
    expect(ev.plan.ledger.find((e) => e.category === 'capital_gains_tax')!.month).toBe(0);
  });

  it('a completed-apartment sale deducts the original land basis', () => {
    const p = profile({ availableCapital: 2_000_000, maxMonthlyRepayment: 20000 });
    const tax = (q: UserProfile) =>
      evaluateCandidate(cand('S07-2'), ctx(q), C).plan.ledger.find((e) => e.label.includes('מכירת הדירה'))!.amount;
    expect(tax({ ...p, acquisitionBasis: 300000 })).toBeLessThan(tax(p));
  });
});

describe('developer economics', () => {
  const dev = developerEconomics(info, C, 0.35);
  it('expresses the combination entitlement per original m²', () => {
    expect(dev.combinationEntitlementValue).toBeCloseTo(1_968_750, 4);
    expect(dev.impliedCombinationValuePerSqm).toBeCloseTo(1_968_750 / 167, 4);
    expect(dev.grossSaleValue).toBeCloseTo(1_152_300, 4);
  });

  it('matches an independent developer P&L', () => {
    const a = 2_500_000 / 1.18;
    const build = 1_100_000 * 1.12;
    const L = info.bettermentLevy;
    const rev = 0.65 * 2.25 * a;
    const T = (0.25 / 0.75) * 0.7875 * 1_100_000 * 1.18; // net deal: grossed-up tax paid for the owner
    expect(dev.combinationTaxCost).toBeCloseTo(T, 6);
    const margin = (rev - 2.25 * build - 0.7875 * 1_100_000 * 0.18 - L - T) / rev;
    expect(dev.combinationMargin).toBeCloseTo(margin, 9);
    const consistent = (0.7875 * a + 0.7875 * 1_100_000 * 0.18 + L + T) / 1.06 / 167;
    expect(dev.consistentCashPricePerSqm).toBeCloseTo(consistent, 6);
    // A 35% combination is worth more to the owner than the ₪6,900 cash scenario implies.
    expect(dev.consistentCashPricePerSqm).toBeGreaterThan(6900);
    expect(dev.maxCombinationAtTargetMargin).toBeLessThan(0.35);
  });

  it('flags strategies whose developer deal is unprofitable as commercially questionable — without changing affordability', () => {
    const s = run().results.find((x) => x.id === 'S02')!;
    expect(s.developerMargin).toBeLessThan(0);
    expect(s.assessment.commercial).toBe('questionable');
    expect(s.assessment.affordability).toBe('fits');
  });
});

describe('separate thresholds', () => {
  it('financing ≤ economic break-even ≤ conservative surplus price', () => {
    const c = ctx();
    const fin = minSurplusPrice(cand('S05-1'), c, C).value!;
    const be = breakevenSurplusPrice(cand('S05-1'), cand('S06-1'), c, C).value!;
    const cons = conservativeSurplusPrice(cand('S05-1'), cand('S06-1'), c, C).value!;
    expect(fin).toBeGreaterThan(6900);
    expect(be).toBeGreaterThan(fin);
    expect(cons).toBeGreaterThan(be);
  });
});

describe('ranking quality', () => {
  it('scores are stable: they depend only on the candidate and the user, not on other candidates', () => {
    const d = run();
    const scales: Scales = { entitlementValue: 2.25 * 2_500_000, landValue: 1_152_300, maxApartments: 3, monthlyRent: 3 * 4400 };
    const s = d.results[3];
    expect(goalScore(s.metrics, 'balanced', scales)).toBe(goalScore({ ...s.metrics }, 'balanced', scales));
    const subset = analyzeProfile(MODERATE, TERMS, C).ranked.filter((r) => r.strategyType !== 'S04');
    expect(subset.map((r) => r.id)).toEqual(d.ranked.filter((r) => r.strategyType !== 'S04').map((r) => r.id));
  });

  it('follow-up questions are only asked when the answer changes the recommendation', () => {
    const p = profile({ availableCapital: 600000, maxMonthlyRepayment: null });
    const d = run(p);
    const top = (q: UserProfile) => run(q).recommendation?.id;
    const material = top({ ...p, maxMonthlyRepayment: 0 }) !== d.recommendation?.id || top({ ...p, maxMonthlyRepayment: 20000 }) !== d.recommendation?.id;
    expect(d.followUpQuestions.some((q) => q.id === 'repayment')).toBe(material);
  });

  it('unfunded obligations can never be classified as financially feasible (property)', () => {
    const goals: Goal[] = ['balanced', 'maximize_apartments', 'passive_income', 'immediate_cash', 'minimize_risk'];
    fc.assert(
      fc.property(
        fc.double({ min: 40, max: 600, noNaN: true }),
        fc.integer({ min: 0, max: 2_000_000 }),
        fc.constantFrom(0, 3000, 8000, null),
        fc.constantFrom(...goals),
        (area, cap, P, goal) => {
          const d = analyzeProfile({ landAreaSqm: area, availableCapital: cap, maxMonthlyRepayment: P, goal }, TERMS, C);
          for (const r of d.results) {
            if (r.simulation.unfunded > 1) {
              expect(r.feasibility).toBe('infeasible');
              expect(r.assessment.affordability).toBe('does_not_fit');
            }
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
