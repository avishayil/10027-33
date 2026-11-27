/**
 * Lot-level developer policy for construction services (שירותי בנייה), using the owner's own examples:
 * ~100 units per lot, 20–30% released for construction services, one apartment per owner, and full
 * combination for owners whose combination already yields a whole apartment (~3 rights).
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { policyBlock, serviceApartments } from '../../src/domain/policy';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { TERMS, profile } from '../fixtures/profiles';

const areaFor = (R: number) => (R / 2.25) * 167;
const run = (R: number, over = {}) => analyzeProfile(profile({ landAreaSqm: areaFor(R), ...over }), TERMS, C);
const buildIds = (d: ReturnType<typeof run>, offered: boolean) =>
  d.results.filter((r) => serviceApartments(r.candidate) > 0 && (r.assessment.commercial !== 'negotiable') === offered).map((r) => r.id);

describe('developer policy for construction services', () => {
  it('4 rights: no construction services at all — you will not build 4 apartments', () => {
    const d = run(4, { availableCapital: 3_000_000, maxMonthlyRepayment: 30000, goal: 'maximize_apartments' });
    expect(buildIds(d, true)).toEqual([]);
    expect(buildIds(d, false)).toEqual(expect.arrayContaining(['S03-4', 'S05-1', 'S11-2']));
    expect(d.results.find((r) => r.id === 'S03-4')!.reasonCodes).toContain('DEVELOPER_POLICY_WHOLE_FROM_COMBINATION');
    expect(d.lotPolicy.servicesOffered).toBe(false);
    // Even with ample means, the best route to more apartments is combination (with paid completion).
    expect(['S02', 'S02C', 'S02P', 'S06', 'S13']).toContain(d.recommendation!.strategyType);
    expect(serviceApartments(d.recommendation!.candidate)).toBe(0);
  });

  it('3 rights: full combination already yields a whole apartment, so it is the expected route', () => {
    const d = run(3, { availableCapital: 600000, maxMonthlyRepayment: 8000, goal: 'balanced' });
    expect(buildIds(d, true)).toEqual([]);
    expect(d.recommendation!.strategyType).toBe('S02');
    expect(d.recommendation!.metrics.wholeApartments).toBe(1);
  });

  it('between 1 and 3 rights: one apartment in construction services is offered, more is not', () => {
    for (const R of [1.125, 1.5, 2.25]) {
      const d = run(R);
      expect(d.lotPolicy.servicesOffered).toBe(true);
      for (const id of buildIds(d, true)) {
        expect(serviceApartments(d.results.find((r) => r.id === id)!.candidate)).toBeLessThanOrEqual(1);
      }
      expect(buildIds(d, true).length).toBeGreaterThan(0);
    }
    const d = run(2.25);
    expect(buildIds(d, true)).toEqual(expect.arrayContaining(['S05-1', 'S08-1', 'S11-1']));
    expect(buildIds(d, false)).toEqual(expect.arrayContaining(['S03-2', 'S08-2', 'S07-2', 'S11-2', 'S10-3']));
    expect(d.results.find((r) => r.id === 'S03-2')!.reasonCodes).toContain('DEVELOPER_POLICY_PER_OWNER_CAP');
  });

  it('within 1–3 rights the choice depends on finances and goals', () => {
    const wealthy = run(1.5, { availableCapital: 2_000_000, maxMonthlyRepayment: 15000, goal: 'maximize_apartments' });
    const none = run(1.5, { availableCapital: 0, maxMonthlyRepayment: 0, goal: 'balanced' });
    expect(wealthy.recommendation!.metrics.wholeApartments).toBe(1);
    expect(none.recommendation?.metrics.wholeApartments ?? 0).toBe(0);
  });

  it('construction-services strategies carry the lot-capacity condition', () => {
    const r = run(2.25).results.find((x) => x.id === 'S05-1')!;
    expect(r.requiredConditions).toContain('SERVICES_CAPACITY');
  });

  it('a strategy the developer will not offer is never recommended or ranked', () => {
    for (const R of [1.125, 2.25, 3, 4, 6]) {
      const d = run(R, { availableCapital: 5_000_000, maxMonthlyRepayment: 40000, goal: 'maximize_apartments' });
      for (const r of d.ranked) expect(r.assessment.commercial).not.toBe('negotiable');
    }
  });

  it('lot capacity: 25 of 102 units (20–30 across policy scenarios) against a hypothetical ~42 typical owners', () => {
    const lp = run(2.25).lotPolicy;
    expect(lp.lotUnits).toBe(102);
    expect(lp.capUnits).toBe(25); // integer slots, rounded down
    expect(lp.capUnitsRange).toEqual({ restrictive: 20, flexible: 30 });
    expect(lp.estimatedDemand).toBeGreaterThan(40);
    expect(lp.wholeFromCombinationThreshold).toBeCloseTo(1 / 0.35, 9);
  });

  it('the threshold follows the project reference rate, not the slider', () => {
    const c30 = { ...TERMS, combinationPct: 0.3 };
    const R = 3;
    const cand = { id: 'x', type: 'S05' as const, targetApartments: 1, legs: [{ kind: 'build' as const, apartments: 1, ownRightsUsed: 1, purchasedRightsUsed: 0 }] };
    expect(policyBlock(cand, R, C)).toBe('DEVELOPER_POLICY_WHOLE_FROM_COMBINATION');
    // The test uses the project reference rate, not the slider: lowering the slider does not unlock a slot.
    const ref30 = { ...C, developerPolicy: { ...C.developerPolicy, referenceCombinationPct: c30.combinationPct } };
    expect(policyBlock(cand, R, ref30)).toBeNull(); // 3 × 30% = 0.9 < 1
  });
});
