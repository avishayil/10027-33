/**
 * Iteration-3 fixtures and regressions (review of 1a0d80e). Expected values are computed independently in the
 * test. They are illustrative arithmetic under stated assumptions — not a tax assessment.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { datedReserve, simulateCashflow } from '../../src/domain/cashflow';
import { calculateRights } from '../../src/domain/rights';
import { buildTransactionPlan } from '../../src/domain/transactions';
import type { CashEvent, ProjectConfig, UserProfile } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { evaluateCandidate } from '../../src/optimizer/evaluate';
import { generateStrategies } from '../../src/optimizer/generate';
import { GOLDEN_TAX, GROSS, NET, withArrangement } from '../fixtures/configs';
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
    // Mixed: developer pays the levy → it is consideration; deduct L × (1 − c).
    const mixed = sumBy(plan('S02', withArrangement(C, 'mixed')), 'owner', 'capital_gains_tax');
    expect(mixed).toBeCloseTo(0.25 * (services + L - L * 0.65), 4);
    // Gross: the owner pays the levy (at permit) → not consideration; still deduct L × (1 − c).
    const g = plan('S02', GROSS);
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
    expect(own.sim.monthlyNetRent).toBeCloseTo(5500 * 0.9, 6);
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
      const d = analyzeProfile(MODERATE, TERMS, cfg);
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

describe('P1 apartment value tiers (illustrative sizes, not confirmed inventory)', () => {
  it('at 35% the 0.7875 entitlement nearly covers a compact 80 m² apartment: gap ₪31,250 vs ₪531,250', () => {
    const p80 = plan('S13-80');
    const paid = sumBy(p80, 'owner', 'completion_payment');
    expect(paid).toBeCloseTo(31_250, 4);
    expect(sumBy(plan('S06-1'), 'owner', 'completion_payment')).toBeCloseTo(531_250, 4);
    expect(p80.wholeApartmentsRetained).toBe(1);
    expect(p80.apartmentSizes).toEqual([80]);
    expect(p80.wholeApartmentValueEq).toBeCloseTo(0.8, 12);
  });

  it('at 40% a 90 m² apartment is fully covered by value (zero gap)', () => {
    const terms40 = { ...TERMS, combinationPct: 0.4 };
    const c = generateStrategies(info, terms40, C).find((x) => x.id === 'S13-90')!;
    const p = buildTransactionPlan(c, { info, profile: MODERATE, terms: terms40, config: C });
    expect(sumBy(p, 'owner', 'completion_payment')).toBeCloseTo(0, 6);
    expect(p.wholeApartmentsRetained).toBe(1);
  });

  it('a smaller apartment than the entitlement pays the owner the excess', () => {
    const terms40 = { ...TERMS, combinationPct: 0.4 };
    const c = generateStrategies(info, terms40, C).find((x) => x.id === 'S13-80')!;
    const p = buildTransactionPlan(c, { info, profile: MODERATE, terms: terms40, config: C });
    const excess = p.ledger.find((e) => e.category === 'fraction_settlement')!;
    expect(excess.amount).toBeCloseTo(0.1 * 2_500_000 * Math.pow(1.02, 5) * 0.8, 2);
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
