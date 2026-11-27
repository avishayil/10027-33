/**
 * Explicit milestone timeline (iteration 6): approval → permit → construction → delivery, each a dependency of the
 * next, so a permit can never precede the plan it depends on. Plus the stresses the review asked for: a higher
 * tax-loan rate and a delayed pool sale in the adverse scenario, and the money at risk if the plan is not approved.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { applyScenario, SCENARIO_IDS } from '../../src/data/scenarios';
import { completionMonth, constructionSchedule, permitMonth } from '../../src/domain/construction';
import { approvalMonthOf } from '../../src/domain/transactions';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { WITH_TAX_LOAN } from '../fixtures/configs';
import { MODERATE, profile, TERMS } from '../fixtures/profiles';

describe('milestone timeline', () => {
  it('base timing is unchanged: approval 24, permit 24, delivery 60; payments at 0/24/30/39/48/60', () => {
    expect(approvalMonthOf(C)).toBe(24);
    expect(permitMonth(C)).toBe(24);
    expect(completionMonth(C)).toBe(60);
    expect(constructionSchedule(C, 0.175, 1).installments.map((i) => i.month)).toEqual([0, 24, 30, 39, 48, 60]);
  });

  it('the permit never precedes approval, in any scenario', () => {
    for (const id of SCENARIO_IDS) {
      const cfg = applyScenario(C, id);
      expect(permitMonth(cfg), id).toBeGreaterThanOrEqual(approvalMonthOf(cfg));
      expect(completionMonth(cfg), id).toBeGreaterThan(permitMonth(cfg));
    }
  });

  it('favourable delivers at 48 months, adverse at 96 with the permit a year after a 3-year approval', () => {
    expect(completionMonth(applyScenario(C, 'favorable'))).toBe(48);
    const adv = applyScenario(C, 'adverse');
    expect(approvalMonthOf(adv)).toBe(36);
    expect(permitMonth(adv)).toBe(48);
    expect(completionMonth(adv)).toBe(96);
  });
});

describe('stresses on tax financing', () => {
  it('the adverse scenario raises the tax-loan rate with the mortgage rate', () => {
    const adv = applyScenario(C, 'adverse');
    expect(adv.financing.taxLoan.annualRate).toBeCloseTo(C.financing.taxLoan.annualRate + (C.financing.stressInterest - C.financing.nominalAnnualInterest), 12);
  });

  it('a delayed pool sale leaves a tax loan with nothing to refinance on — the route fails the adverse scenario', () => {
    const r = analyzeProfile(MODERATE, TERMS, WITH_TAX_LOAN).results.find((x) => x.id === 'S02P')!;
    expect(r.assessment.affordability).not.toBe('does_not_fit');
    expect(r.assessment.resilience).toBe('fragile');
  });
});

describe('if the plan is not approved', () => {
  it('money paid before approval is at risk; a conditional combination risks nothing', () => {
    const d = analyzeProfile(profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 10000 }), TERMS, C);
    const s02 = d.results.find((x) => x.id === 'S02')!;
    expect(s02.approvalRisk).toBe(0);
    const built = d.results.find((x) => x.plan.apartmentsBuilt > 0)!;
    expect(built.approvalRisk).toBeGreaterThan(0);
  });
});
