/**
 * Iteration 10 / I3 (review of c689d0b, §A and acceptance J1–J5): the bilateral search evaluates one executable
 * contract per (terms, funding, route) and reads both sides from it. Expected values are stated independently.
 */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import type { ProjectConfig, StrategyResult } from '../../src/domain/types';
import { evaluateRoutes, goalReason, needsInventory, snapshotsFor, type ContractTerms } from '../../src/optimizer/contract';
import { adaptiveGrid, bothAccept, frontierOf, gridPoints, jointSearch, type JointPair } from '../../src/optimizer/joint/search';
import { profile, TERMS } from '../fixtures/profiles';

const OFFER = { levyCap: null, developerPaysTaxLoanInterest: false };
const K = (over: Partial<ContractTerms> = {}): ContractTerms => ({ arrangement: 'mixed', combinationPct: 0.35, markup: TERMS.developerMarkup, offer: OFFER, funding: 'none', ...over });
const pair = (over: Partial<JointPair>): JointPair => ({
  arrangement: 'mixed',
  combinationPct: 0.35,
  funding: 'none',
  contractId: 'x',
  routeId: 'A',
  ownerValue: 0,
  ownerAccepts: true,
  ownerReason: null,
  wholeApartments: 1,
  developerMargin: 0.2,
  developerOk: true,
  status: 'modeled_conditional',
  conditions: [],
  ...over,
});

describe('J1: the developer side is the selected route’s own lot margin, not a baseline', () => {
  it('synthetic: A 1.5M / 14%, B 1.4M / 15.5%, baseline 16%, hurdle 15% → only B', () => {
    const pairs = [pair({ routeId: 'A', ownerValue: 1_500_000, developerMargin: 0.14 }), pair({ routeId: 'B', ownerValue: 1_400_000, developerMargin: 0.155 })];
    // The baseline (16%) is not an input at all: each pair carries its own margin.
    const ok = pairs.filter((p) => bothAccept(p, 0.15));
    expect(ok.map((p) => p.routeId)).toEqual(['B']);
  });
  it('integration: each pair’s margin equals that route’s developerLot.margin on the same contract', () => {
    const p = profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 });
    const snaps = snapshotsFor(p, K(), C);
    const results = evaluateRoutes(p, K(), C);
    for (const s of snaps) {
      const r = results.find((x) => x.id === s.routeId)!;
      expect(s.developer.margin).toBe(r.developerLot?.margin ?? r.developerMargin ?? null);
    }
    // Routes differ (a services or tier route changes the lot), so a single baseline cannot stand in for them.
    const margins = new Set(snaps.map((s) => s.developer.margin?.toFixed(5)));
    expect(margins.size).toBeGreaterThan(1);
  });
  it('the same contract id on both sides and stable across calls', () => {
    const p = profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000 });
    const a = snapshotsFor(p, K(), C).map((s) => s.id);
    const b = snapshotsFor(p, K(), C).map((s) => s.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    expect(snapshotsFor(p, K({ combinationPct: 0.355 }), C)[0].id).not.toBe(a[0]);
  });
});

describe('J2: the grid includes the endpoints and the slider step; never claims completeness', () => {
  const band = (c: number) => (c >= 0.302 && c <= 0.308 ? 'ok' : 'no');
  it('a 2-point step misses a 30.2–30.8% band and says so (not "none exists")', () => {
    const g = adaptiveGrid(0.25, 0.45, 0.02, 1, band);
    expect(g.points.some((c) => band(c) === 'ok')).toBe(false);
    expect(g.complete).toBe(false);
    expect(g.points[0]).toBe(0.25);
    expect(g.points[g.points.length - 1]).toBe(0.45);
  });
  it('the slider step (0.5 point) finds it', () => {
    const g = adaptiveGrid(0.25, 0.45, C.commercial.combination.step, 1, band);
    expect(g.points.filter((c) => band(c) === 'ok')).toEqual([0.305]);
    expect(g.complete).toBe(false);
  });
  it('a coarse pass refines to the slider step wherever the signature changes', () => {
    const steps = (c: number) => (c >= 0.335 ? 'ok' : 'no');
    const g = adaptiveGrid(0.25, 0.45, 0.005, 4, steps);
    expect(g.points).toContain(0.335);
    expect(g.points).toContain(0.33);
    expect(g.points.length).toBeLessThan(41);
    expect(g.resolution).toBeCloseTo(0.02, 9);
  });
  it('endpoints are included even when the range is not a multiple of the step', () => {
    expect(gridPoints(0.25, 0.26, 0.004)).toEqual([0.25, 0.254, 0.258, 0.26]);
  });
  it('the slider step itself is 0.5 point', () => {
    expect(C.commercial.combination.step).toBe(0.005);
  });
});

describe('J3: an invalid step is rejected', () => {
  for (const s of [0, Number.NaN, -0.01, Infinity]) it(`step ${s} throws`, () => expect(() => gridPoints(0.25, 0.45, s)).toThrow());
  it('min above max throws', () => expect(() => gridPoints(0.45, 0.25, 0.005)).toThrow());
  it('jointSearch validates its step too', () => {
    expect(() => jointSearch(profile({}), TERMS, OFFER, C, { step: 0 })).toThrow();
  });
});

describe('J4: goal-specific acceptance and inventory routes excluded by capability', () => {
  const p = profile({ availableCapital: 1_500_000, maxMonthlyRepayment: 20_000 });
  const results = evaluateRoutes(p, K(), C);
  const fits = (r: StrategyResult) => r.assessment.affordability === 'fits' || r.assessment.affordability === 'fits_with_financing';
  it('whole apartments: only the routes with the most whole apartments reachable on these terms', () => {
    const best = Math.max(...results.filter(fits).map((r) => r.metrics.wholeApartments));
    expect(best).toBeGreaterThanOrEqual(1);
    for (const r of results) expect(goalReason('maximize_apartments', r, results) === null).toBe(r.metrics.wholeApartments >= best);
  });
  it('no risk: any borrowing is rejected', () => {
    for (const r of results) expect(goalReason('minimize_risk', r, results) === null).toBe(r.simulation.totalDrawn <= 1);
  });
  it('cash soon and income follow their own metric; balanced adds nothing', () => {
    for (const r of results) {
      expect(goalReason('immediate_cash', r, results) === null).toBe(r.metrics.liquidity > 0);
      expect(goalReason('passive_income', r, results) === null).toBe(r.metrics.sustainableMonthlyIncome > 0);
      expect(goalReason('balanced', r, results)).toBeNull();
    }
  });
  it('routes that need apartment inventory (tiers / mixes, and the rentals derived from them) never count for the owner', () => {
    const snaps = snapshotsFor(p, K(), C);
    const inv = snaps.filter((s) => needsInventory(s.route));
    expect(inv.length).toBeGreaterThan(0);
    expect(inv.some((s) => s.routeId.includes('-rent'))).toBe(true);
    for (const s of inv) expect(s.owner.accepts).toBe(false);
  });
});

describe('J5: levers are re-evaluated on both sides', () => {
  const p = profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000 });
  const j = jointSearch(p, TERMS, OFFER, C);
  it('a price lever reports whether the owner still accepts at that price', () => {
    const gaps = j.arrangements.map((a) => a.gap).filter((g) => g?.priceLever);
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      const L = g!.priceLever!;
      const cfg: ProjectConfig = { ...C, market: { ...C.market, apartmentValuePerSqm: L.pricePerSqm + 1 } };
      const s = snapshotsFor(p, K({ arrangement: L.arrangement, combinationPct: L.combinationPct, funding: L.funding }), cfg).find((x) => x.routeId === L.routeId)!;
      expect(s.developer.margin!).toBeGreaterThanOrEqual(C.developer.targetMarginOnRevenue - 1e-6);
      expect(s.owner.accepts).toBe(L.ownerAccepts);
    }
  });
});

describe('the search result', () => {
  const p = profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000, goal: 'maximize_apartments' });
  const j = jointSearch(p, TERMS, OFFER, C);
  it('feasible pairs pass both sides; the frontier is non-dominated', () => {
    for (const f of j.feasible) expect(bothAccept(f, j.targetMargin)).toBe(true);
    for (const f of j.frontier) for (const o of j.feasible) expect(o.ownerValue > f.ownerValue && o.developerMargin! > f.developerMargin!).toBe(false);
    expect(frontierOf(j.feasible)).toEqual(j.frontier);
  });
  it('reports its resolution and never claims completeness', () => {
    expect(j.complete).toBe(false);
    expect(j.resolution).toBeGreaterThan(0);
    expect(j.step).toBe(0.005);
  });
  it('every point is in the slider range, endpoints included', () => {
    const pts = [...new Set(j.cells.map((c) => c.combinationPct))];
    expect(Math.min(...pts)).toBe(C.commercial.combination.min);
    expect(Math.max(...pts)).toBe(C.commercial.combination.max);
  });
  it('no feasible pair is ever "terms_confirmed" while the outside options are unknown', () => {
    for (const f of j.feasible) expect(f.status).toBe('modeled_conditional');
  });
  it('the funding-only candidates are all considered for the capital lever', () => {
    for (const a of j.arrangements) if (a.gap?.capitalLever) expect(a.gap.capitalLever.candidates).toBeGreaterThanOrEqual(1);
  });
});
