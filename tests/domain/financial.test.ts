import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { constructionQuotePerApartment, constructionSchedule } from '../../src/domain/construction';
import { simulateCashflow } from '../../src/domain/cashflow';
import { mortgageCapacity, monthlyPayment, remainingBalance } from '../../src/domain/mortgage';
import { apartmentEquivalents, calculateRights } from '../../src/domain/rights';
import { buildTransactionPlan } from '../../src/domain/transactions';
import { generateStrategies } from '../../src/optimizer/generate';
import { evaluateCandidate } from '../../src/optimizer/evaluate';
import type { ProjectConfig } from '../../src/domain/types';
import { MODERATE, TERMS, profile } from '../fixtures/profiles';

const info = calculateRights(167, C);
const cands = generateStrategies(info, TERMS, C);
const cand = (id: string) => cands.find((c) => c.id === id)!;
const plan = (id: string, p = MODERATE, cfg: ProjectConfig = C, terms = TERMS) =>
  buildTransactionPlan(cand(id), { info: calculateRights(p.landAreaSqm, cfg), profile: p, terms, config: cfg });

describe('rights', () => {
  it.each([
    [167, 2.25],
    [83.5, 1.125],
    [334, 4.5],
    [0, 0],
  ])('%s m² → %s apartment-equivalents', (area, r) => {
    expect(apartmentEquivalents(area, C)).toBeCloseTo(r, 12);
  });

  it('keeps the official table quantities separate from the simulation unit', () => {
    expect(info.apartmentEquivalents).toBe(2.25);
    expect(info.table.units).toBeCloseTo(2.4, 2);
    expect(Math.abs(info.table.allocationValue - 714371)).toBeLessThan(2);
  });

  it('estimates the betterment levy proxy for 167 m² in lot 149 at ₪256,940', () => {
    expect(Math.abs(info.bettermentLevy - 256940)).toBeLessThan(2);
  });
});

describe('construction services', () => {
  it.each([
    [0.15, 1492700],
    [0.175, 1525150],
    [0.2, 1557600],
  ])('100 m² at %s markup = ₪%s incl. VAT', (markup, expected) => {
    expect(constructionQuotePerApartment(C, markup)).toBeCloseTo(expected, 6);
  });

  it('schedule shares sum to 100%; the contingency is a released reserve, never stacked on an overrun', () => {
    expect(C.construction.schedule.reduce((s, m) => s + m.share, 0)).toBeCloseTo(1, 12);
    const flat = { ...C, construction: { ...C.construction, annualIndexation: 0 } };
    const base = constructionSchedule(flat, 0.175, 1);
    const paid = (x: typeof base) => x.installments.reduce((s, i) => s + i.amount, 0);
    expect(paid(base)).toBeCloseTo(1525150, 4); // base case: actual spend = quote
    expect(base.reserveHeld).toBeCloseTo(152515, 4);
    expect(base.reserveReleased).toBeCloseTo(152515, 4);
    const over = constructionSchedule({ ...flat, construction: { ...flat.construction, costOverrun: 0.15 } }, 0.175, 1);
    // 15% overrun: the 10% reserve is consumed, 5% more is paid in cash, nothing released → total 115%.
    expect(over.actualSpend).toBeCloseTo(1525150 * 1.15, 4);
    expect(over.reserveReleased).toBeCloseTo(0, 6);
    expect(paid(over) + over.reserveHeld - over.reserveReleased).toBeCloseTo(1525150 * 1.15, 4);
  });
});

describe('mortgage', () => {
  it.each([
    [2500, 428000],
    [5000, 855000],
    [7500, 1283000],
    [10000, 1711000],
    [15000, 2566000],
  ])('₪%s/month over 25y at 5% ≈ ₪%s', (p, expected) => {
    expect(Math.abs(mortgageCapacity(p, 0.05, 25) - expected)).toBeLessThan(1000);
  });

  it('payment and capacity are inverse; the balance amortises to zero', () => {
    expect(monthlyPayment(mortgageCapacity(5000, 0.05, 25), 0.05, 25)).toBeCloseTo(5000, 6);
    expect(remainingBalance(1_000_000, 0.05, 25, 300)).toBeCloseTo(0, 3);
  });

  it('simulated balances reconcile with the amortisation formula', () => {
    const sim = simulateCashflow({
      events: [{ month: 0, amount: -1_000_000, label: 'x', category: 'construction' }],
      startingCash: 0,
      annualRate: 0.05,
      mortgageYears: 25,
      alternativeReturn: 0,
      permitMonth: 0,
      completionMonth: 0,
      horizonMonth: 120,
      liquidityMonth: 24,
      monthlyNetRent: 0,
      rentCountsForRepayment: false,
    });
    expect(sim.debtAtHorizon).toBeCloseTo(remainingBalance(1_000_000, 0.05, 25, 120), 0);
  });
});

describe('transactions', () => {
  it('combination at 35% / 40% yields 0.7875 / 0.9 finished-unit equivalents', () => {
    expect(plan('S02').retainedApartmentEquivalents).toBeCloseTo(0.7875, 12);
    expect(plan('S02', MODERATE, C, { ...TERMS, combinationPct: 0.4 }).retainedApartmentEquivalents).toBeCloseTo(0.9, 12);
  });

  it('partial sale: rights and proceeds reconcile', () => {
    const p = plan('S05-1');
    expect(p.rightsSold + p.rightsBuilt).toBeCloseTo(2.25, 12);
    const proceeds = p.ledger.filter((e) => e.category === 'sale_proceeds').reduce((s, e) => s + e.amount, 0);
    expect(proceeds).toBeCloseTo(167 * 6900 * (1.25 / 2.25), 6);
  });

  it('developer-paid levy (mixed/net deals) is never an owner expense', () => {
    const p = plan('S02');
    const owner = p.ledger.filter((e) => e.category === 'betterment_levy' && e.payer === 'owner');
    expect(owner).toHaveLength(0);
    expect(p.events.some((e) => e.category === 'betterment_levy')).toBe(false);
  });

  it('unknown acquisition basis keeps a tax range; a known basis collapses it', () => {
    const unknown = plan('S01').capitalGainsRange;
    expect(unknown.high).toBeGreaterThan(unknown.low);
    const known = plan('S01', profile({ acquisitionBasis: 100000 })).capitalGainsRange;
    expect(known.high).toBeCloseTo(known.low, 6);
  });

  it('capital gains are estimated on the gain, not on gross proceeds', () => {
    const p = plan('S01');
    const gross = 167 * 6900;
    const tax = p.ledger.find((e) => e.category === 'capital_gains_tax')!.amount;
    const levy = p.ledger.find((e) => e.category === 'betterment_levy')!.amount;
    expect(tax).toBeCloseTo((gross - gross * 0.02 - levy) * 0.25, 4);
    expect(tax).toBeLessThan(gross * 0.25);
  });

  it('a sale before planning approval leaves the levy with the buyer', () => {
    const p = plan('S01M');
    const levy = p.ledger.filter((e) => e.category === 'betterment_levy');
    expect(levy).toHaveLength(1);
    expect(levy[0].payer).toBe('buyer');
    expect(levy[0].amount).toBe(0);
  });

  it('a late developer payment creates an interim funding gap', () => {
    const ctx = { info, profile: profile({ availableCapital: 600000 }), terms: TERMS };
    const early = evaluateCandidate(cand('S05-1'), ctx, { ...C, commercial: { ...C.commercial, developerPaymentYear: 2 } });
    const late = evaluateCandidate(cand('S05-1'), ctx, { ...C, commercial: { ...C.commercial, developerPaymentYear: 4 } });
    // The surplus-rights money arrives two years later, so construction is borrowed for longer.
    expect(late.sim.interestPaidToCompletion).toBeGreaterThan(early.sim.interestPaidToCompletion + 10000);
  });

  it('sold rights are never collateral; retained land is collateral, not cash', () => {
    const hybrid = plan('S05-1');
    const landPerRight = (167 / 2.25) * 6900;
    expect(hybrid.preCompletionLandCollateral).toBeCloseTo(1 * landPerRight, 4);
    const comb = plan('S02');
    expect(comb.preCompletionLandCollateral).toBeCloseTo(2.25 * 0.35 * landPerRight, 4);
    // The land retained in a combination never shows up as cash.
    expect(comb.events.some((e) => e.amount > 0)).toBe(false);
  });

  it('rent never funds construction-stage payments', () => {
    const ev = evaluateCandidate(cand('S08-1'), { info, profile: MODERATE, terms: TERMS }, C);
    const before = ev.sim.yearly.filter((y) => y.year * 12 <= ev.plan.completionMonth);
    const noRent = evaluateCandidate(cand('S05-1'), { info, profile: MODERATE, terms: TERMS }, C);
    expect(ev.sim.constructionPhaseMonthly).toBeCloseTo(noRent.sim.constructionPhaseMonthly, 6);
    expect(before.length).toBeGreaterThan(0);
  });
});
