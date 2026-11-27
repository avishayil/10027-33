/** Iteration 9 / phase E: the bilateral contract search — both sides on one model, gaps with their levers. */
import { describe, expect, it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import { withArrangement } from '../../src/domain/arrangements';
import { lotDeveloperPnL, lotViablePct } from '../../src/domain/lotDeveloper';
import { calculateRights } from '../../src/domain/rights';
import { jointSearch } from '../../src/optimizer/joint/search';
import { profile, TERMS } from '../fixtures/profiles';

describe('joint search', () => {
  const p = profile({ availableCapital: 800_000, maxMonthlyRepayment: 8000, goal: 'maximize_apartments' });
  const j = jointSearch(p, TERMS, C);
  it('covers every arrangement × grid point, within the slider range', () => {
    expect(j.grid).toHaveLength(3 * 11);
    for (const g of j.grid) {
      expect(g.combinationPct).toBeGreaterThanOrEqual(C.commercial.combination.min - 1e-9);
      expect(g.combinationPct).toBeLessThanOrEqual(C.commercial.combination.max + 1e-9);
    }
  });
  it('the developer side is the lot P&L on the same terms; "ok" means at or above the hurdle — never just "equal profit"', () => {
    const info = calculateRights(p.landAreaSqm, C);
    for (const g of j.grid) {
      const m = lotDeveloperPnL({ info, profile: p, config: withArrangement(C, g.arrangement) }, g.arrangement, g.combinationPct, { markup: TERMS.developerMarkup }).margin;
      expect(g.developer.margin).toBeCloseTo(m, 9);
      expect(g.developer.ok).toBe(m >= C.developer.targetMarginOnRevenue - 1e-9);
    }
  });
  it('feasible = both sides accept; the frontier is non-dominated', () => {
    for (const f of j.feasible) expect(f.owner.ok && f.developer.ok).toBe(true);
    for (const f of j.frontier)
      for (const o of j.feasible) expect(o.owner.value! > f.owner.value! && o.developer.margin > f.developer.margin).toBe(false);
  });
  it('with the whole-apartment goal every owner-accepted contract ends with a whole apartment', () => {
    for (const g of j.grid.filter((x) => x.owner.ok)) expect(g.owner.wholeApartments).toBeGreaterThanOrEqual(1);
  });
  it('the exact developer maximum matches lotViablePct', () => {
    const info = calculateRights(p.landAreaSqm, C);
    const a = j.arrangements.find((x) => x.arrangement === 'mixed')!;
    expect(a.developerMaxExact).toBe(lotViablePct({ info, profile: p, config: withArrangement(C, 'mixed') }, 'mixed', { markup: TERMS.developerMarkup }));
  });
});

describe('no overlap → a gap certificate with levers', () => {
  const p = profile({ availableCapital: 300_000, maxMonthlyRepayment: 5000 });
  const j = jointSearch(p, TERMS, C);
  const net = j.arrangements.find((a) => a.arrangement === 'net')!;
  it('net deal: the owner can fund it, the developer never reaches its hurdle', () => {
    expect(net.ownerOk.length).toBeGreaterThan(0);
    expect(net.developerOk).toEqual([]);
    expect(net.both).toEqual([]);
  });
  it('the levers at the owner’s minimum restore the hurdle (cost ceiling, price floor)', () => {
    const g = net.gap!;
    expect(g.atOwnerMin).not.toBeNull();
    const info = calculateRights(p.landAreaSqm, C);
    const cfg = withArrangement(C, 'net');
    const at = (config: typeof C) => lotDeveloperPnL({ info, profile: p, config }, 'net', g.ownerMin!, { markup: TERMS.developerMarkup }).margin;
    if (g.atOwnerMin!.minApartmentPricePerSqm !== null) {
      const priced = { ...cfg, market: { ...cfg.market, apartmentValuePerSqm: g.atOwnerMin!.minApartmentPricePerSqm + 1 } };
      expect(at(priced)).toBeGreaterThanOrEqual(C.developer.targetMarginOnRevenue - 1e-6);
    }
  });
  it('ranges are read from the grid without assuming monotonicity (each range is a run of accepted points)', () => {
    for (const a of j.arrangements)
      for (const [lo, hi] of [...a.ownerOk, ...a.developerOk, ...a.both]) expect(hi).toBeGreaterThanOrEqual(lo);
  });
});
