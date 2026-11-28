/**
 * V1 Milestone C3 / C2 (spec §3, RELEASE-CRITERIA gate C): each of the five goals gives meaningful guidance — one
 * direction and up to two materially different alternatives, the goal's own measure, and when nothing fits the
 * binding constraints rather than a forced winner. A cash-oriented owner gets a sale-price threshold.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import type { Goal } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { goalGuidance } from '../../src/optimizer/guidance';
import { profile, TERMS } from '../fixtures/profiles';

const GOALS: Goal[] = ['balanced', 'maximize_apartments', 'passive_income', 'immediate_cash', 'minimize_risk'];
const PROFILES = [
  profile({ availableCapital: 0, maxMonthlyRepayment: 0 }),
  profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000 }),
  profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 }),
  profile({ landAreaSqm: 83.5, availableCapital: 300_000, maxMonthlyRepayment: 5000 }),
  profile({ availableCapital: null, maxMonthlyRepayment: null }),
];

describe('goal guidance', () => {
  for (const goal of GOALS)
    for (const base of PROFILES) {
      const p = { ...base, goal };
      it(`${goal} · ${p.landAreaSqm} m² · ${p.availableCapital ?? '?'} / ${p.maxMonthlyRepayment ?? '?'}: a direction or an explicit no-fit reason, and the goal's measure`, () => {
        const d = analyzeProfile(p, TERMS, C);
        const g = goalGuidance(d, goal);
        expect(g.goal).toBe(goal);
        if (g.kind === 'no_fit') {
          expect(g.direction).toBeNull();
          expect(g.reasons.length).toBeGreaterThan(0);
        } else expect(g.direction).not.toBeNull();
        expect(g.alternatives.length).toBeLessThanOrEqual(2);
        // Materially different: no alternative of the same deal family as the direction or as each other.
        const families = [g.directionFamily, ...g.alternativeFamilies].filter(Boolean);
        expect(new Set(families).size).toBe(families.length);
        expect(g.measure.label.length).toBeGreaterThan(0);
      });
    }
  it('the cash goal gets a sale-price threshold even though today’s sale value is unknown', () => {
    const d = analyzeProfile(profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000, goal: 'immediate_cash' }), TERMS, C);
    const g = goalGuidance(d, 'immediate_cash');
    expect(g.saleThreshold).not.toBeNull();
    expect(g.saleThreshold!).toBeGreaterThan(0);
  });
  it('passive income is measured as net monthly income after debt service', () => {
    const d = analyzeProfile(profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000, goal: 'passive_income' }), TERMS, C);
    const g = goalGuidance(d, 'passive_income');
    expect(g.measure.label).toContain('הכנסה');
    if (g.direction) expect(g.measure.value).toBe(g.direction.metrics.sustainableMonthlyIncome);
  });
  it('the goal is the one asked for — never silently another', () => {
    for (const goal of GOALS) expect(goalGuidance(analyzeProfile({ ...PROFILES[1], goal }, TERMS, C), goal).goal).toBe(goal);
  });
});
