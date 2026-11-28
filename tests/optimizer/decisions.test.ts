import { describe, expect, it } from 'vitest';
// Pinned to the simulation basis (2.25 rights per 167 m²): numbers reconciled on it (iteration 10).
import { C_SIM as C } from '../fixtures/configs';
import { calculateRights } from '../../src/domain/rights';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { generateStrategies } from '../../src/optimizer/generate';
import { NET } from '../fixtures/configs';
import { MODERATE, NO_MEANS, TERMS, WEALTHY, profile } from '../fixtures/profiles';

const run = (p = MODERATE, terms = TERMS) => analyzeProfile(p, terms, C);
const byId = (d: ReturnType<typeof run>, id: string) => d.results.find((r) => r.id === id)!;

describe('candidate generation', () => {
  it('2.25 rights generate sell-all, one- and two-apartment construction strategies', () => {
    const ids = generateStrategies(calculateRights(167, C), TERMS, C).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['S01', 'S02', 'S04', 'S09', 'S05-1', 'S03-2', 'S07-2', 'S08-1', 'S08-2', 'S06-1', 'S10-3']));
  });

  it('larger holdings enumerate every whole-apartment count', () => {
    const ids = generateStrategies(calculateRights(334, C), TERMS, C).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['S05-1', 'S05-2', 'S05-3', 'S03-4', 'S10-5']));
  });

  it('rights below one apartment offer completion, sale and complementary purchase', () => {
    const ids = generateStrategies(calculateRights(50, C), TERMS, C).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['S01', 'S06-1', 'S10-1']));
    expect(ids.some((id) => id.startsWith('S05') || id.startsWith('S03'))).toBe(false);
  });
});

describe('decision correctness', () => {
  it('no capital and no borrowing: rejects every strategy that needs unfunded payments', () => {
    const d = run(NO_MEANS);
    for (const r of d.results) {
      if (r.mortgageRequired > 1) expect(r.feasibility).toBe('infeasible');
    }
    // Evidence-first: no route that needs unfunded cash is recommended; if none fits, the answer is "none" plus
    // the decision under a net deal and the price sale routes would need.
    if (d.recommendation) expect(d.recommendation.mortgageRequired).toBeLessThanOrEqual(1);
    else {
      expect(d.arrangements.find((a) => a.arrangement === 'net')!.recommendationId).not.toBeNull();
      expect(d.priceConditional.length).toBeGreaterThan(0);
    }
  });

  it('moderate means: evaluates a one-apartment hybrid and explains what would make it feasible', () => {
    const d = run(MODERATE);
    expect(byId(d, 'S05-1')).toBeDefined();
    // Under the headline (mixed) deal the owner's tax at approval exceeds the cash; under a net deal it fits.
    expect(byId(d, 'S06-1').reasonCodes).toContain('UNFUNDED_OBLIGATION');
    expect(byId(analyzeProfile(MODERATE, TERMS, NET), 'S06-1').feasibility).not.toBe('infeasible');
    const t = d.negotiationTargets.find((n) => n.code === 'BREAKEVEN_SURPLUS_PRICE' && n.strategyId === 'S05-1');
    expect(t?.value).toBeGreaterThan(C.market.developerRightsSaleScenario.pricePerOriginalSqm);
  });

  it('high means: multiple-apartment strategies are not rejected', () => {
    const d = run(WEALTHY);
    expect(byId(d, 'S03-2').feasibility).not.toBe('infeasible');
    expect(byId(d, 'S08-2').feasibility).not.toBe('infeasible');
  });

  it('households with different means receive different recommendations', () => {
    const recs = new Set([NO_MEANS, WEALTHY].map((p) => run({ ...p, goal: 'maximize_apartments' }).recommendation?.id ?? 'none'));
    expect(recs.size).toBe(2);
  });

  it('maximise apartments: picks the most whole apartments that fit', () => {
    const d = run({ ...WEALTHY, goal: 'maximize_apartments' });
    const eligible = d.ranked.map((r) => r.metrics.wholeApartments);
    expect(d.recommendation!.metrics.wholeApartments).toBe(Math.max(...eligible));
    expect(d.recommendation!.metrics.wholeApartments).toBeGreaterThanOrEqual(1);
  });

  it('immediate cash: prioritises realisable near-term proceeds', () => {
    // Sale routes depend on an unknown price: they are reported with the price they need, never as the verdict.
    const d = run({ ...MODERATE, goal: 'immediate_cash' });
    if (d.recommendation) expect(d.recommendation.priceDependency).toBeNull();
    const sellNow = d.priceConditional.find((p) => p.result.strategyType === 'S01M');
    expect(sellNow?.threshold.knob).toBe('immediate_price');
  });

  it('passive income: compares net rent after mortgage and expenses', () => {
    const d = run({ ...WEALTHY, goal: 'passive_income' });
    const best = Math.max(...d.ranked.map((r) => r.metrics.sustainableMonthlyIncome));
    expect(d.recommendation!.metrics.sustainableMonthlyIncome).toBeGreaterThanOrEqual(best * 0.8);
    // No phantom rent: an owner-occupied apartment produces no cash.
    for (const r of d.results) if (!r.plan.rentCountsForRepayment) expect(r.simulation.monthlyNetRent).toBe(0);
  });

  it('minimum risk: never recommends a fragile or debt-dependent strategy when a debt-free one exists', () => {
    const d = run({ ...WEALTHY, goal: 'minimize_risk' });
    expect(d.recommendation!.feasibility).not.toBe('fragile');
    expect(d.recommendation!.mortgageRequired).toBeLessThanOrEqual(1);
  });

  it('unknown mortgage capacity gives a conditional verdict, not a silent zero', () => {
    const d = analyzeProfile(profile({ availableCapital: 300000, maxMonthlyRepayment: null }), TERMS, NET);
    const s = byId(d, 'S06-1');
    expect(s.mortgageRequired).toBeGreaterThan(0);
    expect(s.feasibility).toBe('conditional');
    expect(s.requiredConditions).toContain('MORTGAGE_CAPACITY_UNKNOWN');
  });

  it('unknown capital marks funding-dependent strategies as missing information', () => {
    const d = run(profile({ availableCapital: null }));
    expect(byId(d, 'S05-1').feasibility).toBe('unknown');
    expect(d.followUpQuestions.map((q) => q.id)).toContain('capital');
  });

  it('standard combination cannot deliver a whole apartment at 30–40%: requires 44.44%', () => {
    const d = run();
    const t = d.negotiationTargets.find((n) => n.code === 'MIN_COMBINATION_PCT')!;
    expect(t.value).toBeCloseTo(1 / 2.25, 6);
    expect(byId(d, 'S02').reasonCodes).toContain('COMBINATION_BELOW_WHOLE_UNIT');
  });

  it('selling today is never ranked on a historical price; the current price stays unknown', () => {
    const d = run(WEALTHY);
    const s = byId(d, 'S01M');
    expect(s.priceDependency).toBe('immediate_price');
    expect(d.ranked).not.toContain(s);
    expect(d.landReferences.find((l) => l.label.includes('בשוק החופשי היום'))!.amount).toBeNull();
    const t = d.priceConditional.find((p) => p.result.id === 'S01M')!.threshold;
    expect(t.required).toBeGreaterThan(C.market.immediateSaleReferencePerSqm);
  });

  it('reports which scenario assumptions change the recommendation', () => {
    const d = run(MODERATE);
    expect(d.sensitivity.byScenario.base).toBe(d.recommendation?.id ?? null);
    expect(Array.isArray(d.sensitivity.drivers)).toBe(true);
  });
});
