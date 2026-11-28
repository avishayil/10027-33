/**
 * Iteration 10 / E5: timings of the on-demand engines at their limits (group of 8, extreme valid holdings, the joint
 * grid with refinement). Logged for VALIDATION-REPORT; the bounds are loose sanity limits, not a performance guarantee.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { maxAreaInLot } from '../../src/domain/validation';
import { analyzeProfile } from '../../src/optimizer/analyze';
import { concessionFrontier } from '../../src/optimizer/concessions';
import { contingentPlan } from '../../src/optimizer/contingent';
import { planGroup, type GroupMember } from '../../src/optimizer/group/collective';
import { jointSearch } from '../../src/optimizer/joint/search';
import { profile, TERMS } from '../fixtures/profiles';

const OFFER = { levyCap: null, developerPaysTaxLoanInterest: false };
const time = <T>(label: string, f: () => T): T => {
  const t = performance.now();
  const r = f();
  console.log(`[bench] ${label}: ${Math.round(performance.now() - t)} ms`);
  return r;
};

describe('benchmarks', () => {
  it('group of 8 with mixed means, every arrangement', () => {
    const caps = [[0, 0], [300_000, 5000], [800_000, 6000], [2_000_000, 15000], [0, 5000], [300_000, 0], [1_500_000, 10000], [500_000, 8000]];
    const members: GroupMember[] = caps.map(([a, b], i) => ({ label: `${i}`, landAreaSqm: 120 + 20 * i, availableCapital: a, maxMonthlyRepayment: b, goal: 'balanced' }));
    for (const arrangement of ['gross', 'mixed', 'net'] as const) {
      const g = time(`group of 8 (${arrangement})`, () => planGroup({ lotId: '149', members, slotsAvailable: 3, terms: TERMS, offer: OFFER, arrangement }, (r) => r.id, C));
      expect(g.search.truncated).toBe(false);
    }
  });
  it('extreme valid holding (the whole lot)', () => {
    const p = profile({ landAreaSqm: Math.floor(maxAreaInLot(C, '149')), availableCapital: 5_000_000, maxMonthlyRepayment: 30_000 });
    time('analysis, whole-lot holding', () => analyzeProfile(p, TERMS, C));
    const j = time('joint search, whole-lot holding', () => jointSearch(p, TERMS, OFFER, C));
    console.log(`[bench] contracts evaluated: ${j.contractsEvaluated}`);
  });
  it('joint search with refinement, typical holdings', () => {
    for (const p of [profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000 }), profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000, soleHome: false })]) {
      const j = time(`joint search (${p.availableCapital}, fundings ${p.soleHome === false ? 3 : 2})`, () => jointSearch(p, TERMS, OFFER, C));
      console.log(`[bench] contracts evaluated: ${j.contractsEvaluated}, resolution ${j.resolution}`);
      expect(j.contractsEvaluated).toBeGreaterThanOrEqual(33);
    }
  });
  it('contingent plan and concessions', () => {
    const p = profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 });
    const d = analyzeProfile(p, TERMS, C);
    time('contingent plan', () => contingentPlan(d, p, TERMS, C));
    time('concession frontier', () =>
      concessionFrontier(p, { arrangement: 'mixed', combinationPct: TERMS.combinationPct, markup: TERMS.developerMarkup, offer: OFFER, funding: 'none' }, C, (d.recommendation ?? d.ranked[0]).id),
    );
  });
});
