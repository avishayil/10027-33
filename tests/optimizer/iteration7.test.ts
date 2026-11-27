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
