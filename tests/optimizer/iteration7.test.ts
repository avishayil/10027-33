/**
 * Iteration 7 (review of c32bb73): consistent valuation. The ranking compares a present value at signing (3% real,
 * today's prices): every owner cash flow and the apartments at delivery, discounted from their own dates, less the
 * interest paid. The position at delivery counts only what has happened by delivery; later receipts are receivables.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { completionMonth } from '../../src/domain/construction';
import { calculateRights } from '../../src/domain/rights';
import type { ProjectConfig } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { ownerBreakEvenPct } from '../../src/optimizer/arrangementEquivalence';
import { mortgageLtvLimit } from '../../src/optimizer/feasibility';
import { profile, TERMS } from '../fixtures/profiles';

const d = C.analysis.discountRate;
const disc = (m: number) => Math.pow(1 + d, -m / 12);

describe('present value for the comparison (review §7)', () => {
  it('discount rate is 3% real', () => {
    expect(d).toBe(0.03);
  });
  it('a debt-free route: PV = discounted ledger flows + apartments discounted from delivery', () => {
    const r = analyzeProfile(profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C).results.find((x) => x.id === 'S02')!;
    expect(r.simulation.peakDebt).toBe(0);
    const owner = r.ledger.filter((e) => e.payer === 'owner' && !e.deferred);
    const flows = owner.reduce((s, e) => s + (e.direction === 'in' ? 1 : -1) * e.amount * disc(e.month), 0);
    const assets = (r.delivery.apartmentsValue + r.delivery.fractionValue) * disc(completionMonth(C));
    expect(r.comparisonValue).toBeCloseTo(flows + assets, 2);
    expect(r.metrics.valueCreated).toBe(r.comparisonValue);
  });
  it('an apartment delivered later is worth less, even at 0% appreciation', () => {
    const late: ProjectConfig = { ...C, timeline: { ...C.timeline, constructionMonths: 84 } };
    const p = profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 });
    const a = analyzeProfile(p, TERMS, C).results.find((x) => x.id === 'S02')!;
    const b = analyzeProfile(p, TERMS, late).results.find((x) => x.id === 'S02')!;
    expect(b.comparisonValue).toBeLessThan(a.comparisonValue);
  });
});

describe('position at delivery (review §7)', () => {
  const delayed: ProjectConfig = { ...C, timeline: { ...C.timeline, settlementDelayMonths: 12 } };
  const p = profile({ availableCapital: 1_000_000, maxMonthlyRepayment: 10000 });
  it('a pool sale after delivery is a receivable, not cash at delivery', () => {
    const r = analyzeProfile(p, TERMS, delayed).results.find((x) => x.id === 'S02P')!;
    expect(r.delivery.receivablesAfterDelivery).toBeGreaterThan(0);
    const onTime = analyzeProfile(p, TERMS, C).results.find((x) => x.id === 'S02P')!;
    expect(onTime.delivery.receivablesAfterDelivery).toBe(0);
    expect(r.delivery.ownerCashIn).toBeLessThan(onTime.delivery.ownerCashIn);
  });
  it('and it is worth less in the comparison', () => {
    const r = analyzeProfile(p, TERMS, delayed).results.find((x) => x.id === 'S02P')!;
    const onTime = analyzeProfile(p, TERMS, C).results.find((x) => x.id === 'S02P')!;
    expect(r.comparisonValue).toBeLessThan(onTime.comparisonValue);
  });
});

describe('owner break-even uses the household’s own funding (review §12)', () => {
  it('with enough cash, carrying the taxes costs the discount rate — not the tax-loan rate', () => {
    const info = calculateRights(167, C);
    const rich = ownerBreakEvenPct({ info, profile: profile({ availableCapital: 2_000_000 }), config: C }, 'mixed', 0.35, 'net')!;
    const poor = ownerBreakEvenPct({ info, profile: profile({ availableCapital: 0 }), config: C }, 'mixed', 0.35, 'net')!;
    // Taxes are cheaper to carry for the household with cash, so a net deal must give it more to be worth it.
    expect(rich).toBeGreaterThan(poor);
  });
});

describe('mortgage limits by property status (Bank of Israel directive 329; review §8)', () => {
  it('sole home 75%; another home or unknown status 50%; a second delivered apartment is an additional home', () => {
    expect(mortgageLtvLimit([1], true, C)).toBeCloseTo(0.75, 12);
    expect(mortgageLtvLimit([1], false, C)).toBeCloseTo(0.5, 12);
    expect(mortgageLtvLimit([1], null, C)).toBeCloseTo(0.5, 12);
    // Two equal apartments, sole home: 75% on one, 50% on the other → 62.5% of the total.
    expect(mortgageLtvLimit([1, 1], true, C)).toBeCloseTo(0.625, 12);
  });
  it('a route financed above 50% fits a sole home but not an unknown status', () => {
    // 60 m², ₪600K: completion to a whole apartment with a mortgage of ≈ 54% of its value.
    const base = { landAreaSqm: 60, availableCapital: 600_000, maxMonthlyRepayment: 20000, goal: 'maximize_apartments' as const };
    const sole = analyzeProfile({ ...base, soleHome: true }, TERMS, C).results.find((x) => x.id === 'S06-1')!;
    const unknown = analyzeProfile({ ...base, soleHome: null }, TERMS, C).results.find((x) => x.id === 'S06-1')!;
    expect(sole.simulation.peakPostCompletionLtv).toBeGreaterThan(0.5);
    expect(sole.simulation.peakPostCompletionLtv).toBeLessThan(0.75);
    expect(sole.reasonCodes).not.toContain('LTV_EXCEEDED');
    expect(unknown.reasonCodes).toContain('LTV_EXCEEDED');
  });
});

describe('if the plan is never approved (review §10)', () => {
  const d = analyzeProfile(profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 15000 }), TERMS, C);
  it('a conditional combination loses nothing; the land stays with the owner', () => {
    const s02 = d.results.find((x) => x.id === 'S02')!;
    expect(s02.noApproval.loss).toBe(0);
    expect(s02.noApproval.apartments).toBe(0);
  });
  it('building with construction services: the signing advance and the interest to cancellation are at risk', () => {
    const built = d.results.find((x) => x.plan.apartmentsBuilt > 0)!;
    expect(built.noApproval.advances).toBeGreaterThan(0);
    expect(built.noApproval.loss).toBeCloseTo(built.noApproval.advances + built.noApproval.interest - built.noApproval.landCredit, 6);
  });
  it('bought complementary rights stay the owner’s land: credited at the appraisal’s incoming value', () => {
    const small = analyzeProfile(profile({ landAreaSqm: 60, availableCapital: 1_500_000, maxMonthlyRepayment: 10000 }), TERMS, C);
    const s10 = small.results.find((x) => x.strategyType === 'S10')!;
    expect(s10.noApproval.landCredit).toBeGreaterThan(0);
    expect(s10.noApproval.loss).toBeLessThan(s10.noApproval.advances + s10.noApproval.interest);
  });
});
