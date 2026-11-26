import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { calculateRights } from '../../src/domain/rights';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { generateStrategies } from '../../src/optimizer/generate';
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
    expect(d.recommendation).not.toBeNull();
    expect(d.recommendation!.mortgageRequired).toBeLessThanOrEqual(1);
  });

  it('moderate means: evaluates a one-apartment hybrid and explains what would make it feasible', () => {
    const d = run(MODERATE);
    expect(byId(d, 'S05-1')).toBeDefined();
    expect(byId(d, 'S06-1').feasibility).not.toBe('infeasible');
    const t = d.negotiationTargets.find((n) => n.code === 'MIN_SURPLUS_PRICE' && n.strategyId === 'S05-1');
    expect(t?.value).toBeGreaterThan(C.market.developerRightsSaleScenario.pricePerOriginalSqm);
  });

  it('high means: multiple-apartment strategies are not rejected', () => {
    const d = run(WEALTHY);
    expect(byId(d, 'S03-2').feasibility).not.toBe('infeasible');
    expect(byId(d, 'S08-2').feasibility).not.toBe('infeasible');
  });

  it('households with different means receive different recommendations', () => {
    const recs = new Set([NO_MEANS, MODERATE].map((p) => run({ ...p, goal: 'maximize_apartments' }).recommendation?.id));
    expect(recs.size).toBe(2);
  });

  it('maximise apartments: picks the most whole apartments that fit', () => {
    const d = run({ ...WEALTHY, goal: 'maximize_apartments' });
    const eligible = d.ranked.map((r) => r.metrics.wholeApartments);
    expect(d.recommendation!.metrics.wholeApartments).toBe(Math.max(...eligible));
    expect(d.recommendation!.metrics.wholeApartments).toBeGreaterThanOrEqual(1);
  });

  it('immediate cash: prioritises realisable near-term proceeds', () => {
    const d = run({ ...MODERATE, goal: 'immediate_cash' });
    expect(d.recommendation!.metrics.liquidity).toBeGreaterThan(0);
  });

  it('passive income: compares net rent after mortgage and expenses', () => {
    const d = run({ ...WEALTHY, goal: 'passive_income' });
    const best = Math.max(...d.ranked.map((r) => r.metrics.sustainableMonthlyIncome));
    expect(d.recommendation!.metrics.sustainableMonthlyIncome).toBeGreaterThan(best * 0.8);
  });

  it('minimum risk: never recommends a fragile or debt-dependent strategy when a debt-free one exists', () => {
    const d = run({ ...WEALTHY, goal: 'minimize_risk' });
    expect(d.recommendation!.feasibility).not.toBe('fragile');
    expect(d.recommendation!.mortgageRequired).toBeLessThanOrEqual(1);
  });

  it('unknown mortgage capacity gives a conditional verdict, not a silent zero', () => {
    const d = run(profile({ availableCapital: 200000, maxMonthlyRepayment: null }));
    const s = byId(d, 'S06-1');
    expect(s.mortgageRequired).toBeGreaterThan(0);
    expect(s.feasibility).toBe('conditional');
    expect(s.requiredConditions).toContain('MORTGAGE_CAPACITY_UNKNOWN');
    expect(d.followUpQuestions.map((q) => q.id)).toContain('repayment');
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

  it('an immediate open-market sale is reported as missing information', () => {
    expect(byId(run(), 'S01M').feasibility).toBe('unknown');
  });

  it('reports which scenario assumptions change the recommendation', () => {
    const d = run(MODERATE);
    expect(d.sensitivity.byScenario.base).toBe(d.recommendation!.id);
    expect(Array.isArray(d.sensitivity.drivers)).toBe(true);
  });
});
