/**
 * Iteration-3 fixtures and regressions (review of 1a0d80e). Expected values are computed independently in the
 * test. They are illustrative arithmetic under stated assumptions — not a tax assessment.
 */
import { describe, expect, it } from 'vitest';
// Pinned to the simulation basis (2.25 rights per 167 m²): numbers reconciled on it (iteration 10).
import { C_SIM as C } from '../fixtures/configs';
import { datedReserve, simulateCashflow } from '../../src/domain/cashflow';
import { calculateRights } from '../../src/domain/rights';
import { buildTransactionPlan } from '../../src/domain/transactions';
import type { CashEvent, ProjectConfig, UserProfile } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { evaluateCandidate } from '../../src/optimizer/evaluate';
import { generateStrategies } from '../../src/optimizer/generate';
import { GOLDEN_TAX, GROSS, NET, VAT_ON_DEVELOPER, withArrangement } from '../fixtures/configs';
import { MODERATE, NO_MEANS, TERMS, profile } from '../fixtures/profiles';

const info = calculateRights(167, C);
const cands = generateStrategies(info, TERMS, C);
const cand = (id: string) => cands.find((c) => c.id === id)!;
const plan = (id: string, cfg: ProjectConfig = C, p: UserProfile = MODERATE) =>
  buildTransactionPlan(cand(id), { info: calculateRights(p.landAreaSqm, cfg), profile: p, terms: TERMS, config: cfg });
const sumBy = (p: ReturnType<typeof plan>, payer: string, cat: string) =>
  p.ledger.filter((e) => e.payer === payer && e.category === cat).reduce((s, e) => s + e.amount, 0);

describe('P0 tax valuation — reviewer golden fixture (17.5% contractor profit, levy simplified, zero basis, flat 25%)', () => {
  const services = 0.7875 * 100 * 11000 * 1.175 * 1.18;
  it('services value 1,201,055.625; owner-paid tax 300,263.90625; full gross-up 400,351.875', () => {
    expect(services).toBeCloseTo(1_201_055.625, 6);
    for (const arr of ['gross', 'mixed'] as const) {
      expect(sumBy(plan('S02', withArrangement(GOLDEN_TAX, arr)), 'owner', 'capital_gains_tax')).toBeCloseTo(300_263.90625, 4);
    }
    const net = plan('S02', withArrangement(GOLDEN_TAX, 'net'));
    expect(sumBy(net, 'owner', 'capital_gains_tax')).toBe(0);
    expect(sumBy(net, 'developer', 'capital_gains_tax')).toBeCloseTo(400_351.875, 4);
  });

  it('the developer’s purchase tax is charged on the full consideration, including the grossed-up tax', () => {
    const net = plan('S02', withArrangement(GOLDEN_TAX, 'net'));
    expect(sumBy(net, 'developer', 'purchase_tax')).toBeCloseTo(0.06 * (services + 400_351.875), 4);
    const gross = plan('S02', withArrangement(GOLDEN_TAX, 'gross'));
    expect(sumBy(gross, 'developer', 'purchase_tax')).toBeCloseTo(0.06 * services, 4);
  });

  it('only the levy share of the land sold is deducted (proportional allocation)', () => {
    const L = info.bettermentLevy;
    // Services VAT kept on the developer here (its effect is covered in tests/domain/arrangements.test.ts).
    // Mixed: developer pays the levy → it is consideration; deduct L × (1 − c).
    const mixed = sumBy(plan('S02', withArrangement(VAT_ON_DEVELOPER, 'mixed')), 'owner', 'capital_gains_tax');
    expect(mixed).toBeCloseTo(0.25 * (services + L - L * 0.65), 4);
    // Gross: the owner pays the levy (at permit) → not consideration; still deduct L × (1 − c).
    const g = plan('S02', withArrangement(VAT_ON_DEVELOPER, 'gross'));
    expect(sumBy(g, 'owner', 'capital_gains_tax')).toBeCloseTo(0.25 * (services - L * 0.65), 4);
    expect(sumBy(g, 'owner', 'betterment_levy')).toBeCloseTo(L, 6);
  });

  it('every arrangement reconciles: the tax is paid exactly once, by the owner or the developer', () => {
    for (const arr of ['gross', 'mixed', 'net'] as const) {
      const p = plan('S02', withArrangement(C, arr));
      const owner = sumBy(p, 'owner', 'capital_gains_tax');
      const dev = sumBy(p, 'developer', 'capital_gains_tax');
      expect(owner > 0 !== dev > 0).toBe(true);
      const levyPortions = p.ledger.filter((e) => e.category === 'betterment_levy').reduce((s, e) => s + (e.rightsPortion ?? 0), 0);
      expect(levyPortions).toBeCloseTo(2.25, 9);
    }
  });
});

describe('P0 tax timing', () => {
  it('§19(3א): a pre-approval combination is taxed at plan approval; without it, at signing', () => {
    const atApproval = plan('S02').ledger.find((e) => e.category === 'capital_gains_tax')!;
    expect(atApproval.month).toBe(24);
    const signing = { ...C, commercial: { ...C.commercial, combinationSaleDate: 'signing' as const } };
    expect(plan('S02', signing).ledger.find((e) => e.category === 'capital_gains_tax')!.month).toBe(0);
    expect(analyzeProfile(MODERATE, TERMS, C).results.find((r) => r.id === 'S02')!.requiredConditions).toContain('SALE_DATE_DEFERRAL');
  });

  it('a sale to a developer is conditional on approval: payment, levy and tax are never before approval', () => {
    for (const e of plan('S05-1').ledger.filter((x) => x.saleRelated || x.category === 'sale_proceeds')) expect(e.month).toBeGreaterThanOrEqual(24);
  });

  it('completion purchase tax follows property status (0% sole home, 8% additional) with a range when unknown', () => {
    const unknown = plan('S06-1').ledger.find((e) => e.category === 'purchase_tax' && e.payer === 'owner')!;
    expect(unknown.amount).toBeCloseTo(0.08 * 531_250, 4);
    expect(unknown.range).toEqual({ low: 0, high: 0.08 * 531_250 });
    const sole = plan('S06-1', C, profile({ soleHome: true }));
    expect(sumBy(sole, 'owner', 'purchase_tax')).toBe(0);
  });
});

describe('P0 cash flow', () => {
  const ev = (month: number, amount: number, category: CashEvent['category']): CashEvent => ({ month, amount, label: 'x', category });

  it('a receipt that arrives after a tax is due can never fund it (dated reserve)', () => {
    const events = [ev(0, -100, 'construction'), ev(2, -100, 'capital_gains_tax'), ev(3, 100, 'sale_proceeds')];
    const byMonth = new Map<number, CashEvent[]>();
    for (const e of events) byMonth.set(e.month, [...(byMonth.get(e.month) ?? []), e]);
    expect(datedReserve(byMonth, 10)[0]).toBe(100); // the old netting gave 0
    const sim = simulateCashflow({
      events, startingCash: 100, annualRate: 0.05, mortgageYears: 25, alternativeReturn: 0,
      permitMonth: 6, completionMonth: 8, horizonMonth: 10, liquidityMonth: 5, monthlyNetRent: 0, rentCountsForRepayment: false,
    });
    // Hold 100 for the month-2 tax, borrow 100 for the month-0 build (bridge), repay from the month-3 receipt.
    expect(sim.unfunded).toBe(0);
    expect(sim.drawsByStage.bridge).toBeCloseTo(100, 9);
    expect(sim.debtAtHorizon).toBeCloseTo(0, 9);
  });

  it('a same-month receipt can fund that month’s tax', () => {
    const sim = simulateCashflow({
      events: [ev(2, 100, 'sale_proceeds'), ev(2, -100, 'capital_gains_tax')], startingCash: 0, annualRate: 0.05, mortgageYears: 25,
      alternativeReturn: 0, permitMonth: 6, completionMonth: 8, horizonMonth: 10, liquidityMonth: 5, monthlyNetRent: 0, rentCountsForRepayment: false,
    });
    expect(sim.unfunded).toBe(0);
  });

  it('an unfunded tax is reported with its date and type, and is never a loan (no debt, no interest)', () => {
    const r = analyzeProfile(NO_MEANS, TERMS, GROSS).results.find((x) => x.id === 'S02')!;
    expect(r.simulation.unfunded).toBeGreaterThan(0);
    expect(r.simulation.unfundedItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ month: 24, category: 'capital_gains_tax' }), expect.objectContaining({ month: 24, category: 'betterment_levy' })]),
    );
    expect(r.simulation.peakDebt).toBe(0);
    expect(r.simulation.personalPaymentsFV).toBe(0);
    expect(r.feasibility).toBe('infeasible');
  });

  it('a sale exactly at the liquidity deadline counts (inclusive month)', () => {
    const sim = simulateCashflow({
      events: [ev(24, 1000, 'sale_proceeds')], startingCash: 0, annualRate: 0, mortgageYears: 25, alternativeReturn: 0,
      permitMonth: 30, completionMonth: 60, horizonMonth: 120, liquidityMonth: 24, monthlyNetRent: 0, rentCountsForRepayment: false,
    });
    expect(sim.cashAtLiquidityDeadline).toBe(1000);
  });

  it('events after the horizon extend it instead of being clamped into the final month', () => {
    const sim = simulateCashflow({
      events: [ev(150, -1000, 'construction')], startingCash: 5000, annualRate: 0, mortgageYears: 25, alternativeReturn: 0,
      permitMonth: 30, completionMonth: 60, horizonMonth: 120, liquidityMonth: 24, monthlyNetRent: 0, rentCountsForRepayment: false,
    });
    expect(sim.cashAtHorizon).toBeCloseTo(4000, 9);
    expect(sim.yearly.length).toBeGreaterThanOrEqual(12);
  });

  it('zero borrowing capacity rejects any strategy that needs a loan', () => {
    for (const r of analyzeProfile(profile({ availableCapital: 200000, maxMonthlyRepayment: 0 }), TERMS, C).results) {
      const financed = r.simulation.drawsByStage.bridge + r.simulation.drawsByStage.construction + r.simulation.drawsByStage.mortgage;
      if (financed > 1) expect(r.feasibility).toBe('infeasible');
    }
  });

  it('no rental tax on the housing benefit of an apartment the owner lives in; rental tax only when rented', () => {
    const own = evaluateCandidate(cand('S05-1'), { info, profile: MODERATE, terms: TERMS }, C);
    const rented = evaluateCandidate(cand('S08-1'), { info, profile: MODERATE, terms: TERMS }, C);
    expect(own.sim.monthlyNetRent).toBe(0); // not cash
    expect(own.plan.housingBenefitMonthly).toBeCloseTo(5500 * 0.9, 6); // non-cash benefit, no rental tax
    expect(rented.sim.monthlyNetRent).toBeCloseTo(5500 * 0.8, 6);
  });
});

describe('P0 commercial realism', () => {
  it('evaluates gross, mixed and net arrangements and reports the decision under each', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    expect(d.arrangements.map((a) => a.arrangement)).toEqual(['gross', 'mixed', 'net']);
    const net = d.arrangements.find((a) => a.arrangement === 'net')!;
    expect(net.wholeApartments).toBeGreaterThanOrEqual(d.arrangements.find((a) => a.arrangement === 'gross')!.wholeApartments);
  });

  it('a questionable (negative modelled margin) winner is never the only answer — a fallback is given', () => {
    for (const cfg of [C, NET]) {
      const d = analyzeProfile(profile({ availableCapital: 800000 }), TERMS, cfg);
      if (d.recommendation?.assessment.commercial === 'questionable') {
        expect(d.fallback).not.toBeNull();
        expect(d.fallback!.id).not.toBe(d.recommendation.id);
      }
    }
  });

  it('out-of-policy routes are "negotiable", listed separately, never ranked', () => {
    const d = analyzeProfile(profile({ landAreaSqm: (4 / 2.25) * 167, availableCapital: 3_000_000, maxMonthlyRepayment: 20000 }), TERMS, C);
    expect(d.negotiationOnly.length).toBeGreaterThan(0);
    for (const r of d.negotiationOnly) expect(d.ranked).not.toContain(r);
  });

  it('reports whether the owner’s break-even price for surplus rights overlaps the developer’s plausible price', () => {
    const d = analyzeProfile(MODERATE, TERMS, C);
    const range = d.negotiationTargets.find((t) => t.code === 'NEGOTIATION_RANGE')!;
    expect(range.upper).toBeCloseTo(d.developer.residualLandValuePerSqm, 6);
    expect(range.overlap).toBe(range.value !== null && range.value <= range.upper!);
  });
});

describe('P1 apartment types priced from appraisal comparables (not by area)', () => {
  // Independent: relative value of a 3-room vs a 4-room apartment in each comparable project, averaged.
  const r3 = (2024309 / 2331841 + 2360282 / 2683259) / 2;
  const r5 = (2593285 / 2331841 + 2984968 / 2683259) / 2;

  it('a 3-room apartment is worth ~87.4% of a 4-room one — more per m² than a linear 81% would say', () => {
    expect(r3).toBeCloseTo(0.87388, 4);
    expect(C.market.apartmentTypes.find((t) => t.rooms === 3)!.relativeValue).toBeCloseTo(r3, 12);
    expect(C.market.apartmentTypes.find((t) => t.rooms === 5)!.relativeValue).toBeCloseTo(r5, 12);
  });

  it('at 35% the gap to a 3-room apartment is ~₪216K (not the ₪31,250 of the linear 80 m² tier)', () => {
    const p = plan('S13-3r');
    expect(sumBy(p, 'owner', 'completion_payment')).toBeCloseTo((r3 - 0.7875) * 2_500_000, 4);
    expect(p.apartmentRooms).toEqual([3]);
    expect(p.wholeApartmentValueEq).toBeCloseTo(r3, 12);
  });

  it('at 40% the 0.9 entitlement exceeds a 3-room apartment: the owner receives the excess (and that depends on an unverified buy-back price)', () => {
    const terms40 = { ...TERMS, combinationPct: 0.4 };
    const c = generateStrategies(info, terms40, C).find((x) => x.id === 'S13-3r')!;
    const p = buildTransactionPlan(c, { info, profile: MODERATE, terms: terms40, config: C });
    expect(sumBy(p, 'owner', 'completion_payment')).toBe(0);
    const excess = p.ledger.find((e) => e.category === 'fraction_settlement')!;
    expect(excess.amount).toBeCloseTo((0.9 - r3) * 2_500_000 * 0.8, 2);
    const d = analyzeProfile(MODERATE, terms40, C);
    expect(d.results.find((x) => x.id === 'S13-3r')!.priceDependency).toBe('buyback_factor');
  });
});

describe('P0 projection and figures shown', () => {
  it('2.5M × 1.02^10 = 3,047,486.05 (price only)', () => {
    expect(2_500_000 * Math.pow(1.02, 10)).toBeCloseTo(3_047_486.05, 1);
  });

  it('the long-term projection is itemised and reconciles exactly to its total', () => {
    const d = analyzeProfile(profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C);
    const p = d.projection!;
    expect(p.assets + p.cash - p.debt - p.mortgagePaymentsFV - p.deferredLiabilities - p.unfunded - p.startingCapitalGrown).toBeCloseTo(p.total, 4);
    expect(p.apartmentGrowth).toBe(0.02);
  });

  it('the delivery snapshot reconciles to the ledger', () => {
    const d = analyzeProfile(profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C);
    const r = d.recommendation!;
    const out = r.ledger.filter((e) => e.payer === 'owner' && e.direction === 'out' && !e.deferred && e.category !== 'contingency_reserve').reduce((s, e) => s + e.amount, 0);
    const reserveNet = r.ledger.filter((e) => e.category === 'contingency_reserve').reduce((s, e) => s + e.amount, 0) - r.ledger.filter((e) => e.category === 'contingency_release').reduce((s, e) => s + e.amount, 0);
    expect(r.delivery.ownerCashOut).toBeCloseTo(out + reserveNet, 6);
    expect(r.delivery.netPosition).toBeCloseTo(r.delivery.apartmentsValue + r.delivery.fractionValue + r.delivery.ownerCashIn - r.delivery.ownerCashOut - r.delivery.interestToDelivery, 6);
    expect(r.delivery.apartmentsValue).toBeCloseTo(r.plan.wholeApartmentValueEq * 2_500_000, 6);
  });

  it('gross sale proceeds never include a released construction reserve', () => {
    const r = analyzeProfile(profile({ availableCapital: 2_000_000, maxMonthlyRepayment: 20000 }), TERMS, C).results.find((x) => x.id === 'S11-1')!;
    expect(r.ledger.some((e) => e.category === 'contingency_release')).toBe(true);
    expect(r.grossSaleProceeds).toBe(0);
  });
});

describe('reverse solvers', () => {
  it('bracket the first feasible interval of a non-monotone predicate', async () => {
    const { solveMin, solveMax } = await import('../../src/optimizer/reverse');
    const pred = (x: number) => (x >= 30 && x <= 40) || x >= 80; // disjoint feasible set
    expect(solveMin(0, 100, pred)).toBeCloseTo(30, 3);
    expect(solveMax(30, 100, pred)).toBeCloseTo(40, 3);
    expect(solveMin(0, 100, () => false)).toBeNull();
  });
});
