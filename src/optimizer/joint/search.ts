/**
 * Iteration 10 / I3 — the bilateral contract search on one executable contract (review of c689d0b, §A).
 *
 * A contract is (tax arrangement, combination %, the owner's markup and offer terms, and the funding the household
 * relies on). For each contract tested, every route is evaluated once (`snapshotsFor`) and both sides are read from the
 * same snapshot: the owner accepts a route when it is fundable, needs no unverified price or apartment inventory and
 * meets the household's goal; the developer accepts it when the lot margin *with that route* reaches the hurdle. A
 * (contract, route) pair is feasible only when both accept it — never the household's best route against a generic
 * developer baseline. Feasible pairs are still conditional: neither side's outside option is known.
 *
 * The % grid includes both endpoints and is refined to the slider step wherever the result changes between coarse
 * points. A feasible set narrower than the coarse spacing could still be missed, so the search never claims to be
 * complete ("not found in the tested scenarios", not "none exists").
 * When nothing is feasible, the gap is the minimum distance between the two sides on the same route, with levers each
 * re-evaluated on both sides (a price that saves the developer's margin also changes the owner's numbers).
 */
import { directCostPerSaleableSqm } from '../../domain/lotDeveloper';
import { calculateRights } from '../../domain/rights';
import { validateInputs } from '../../domain/validation';
import type { CommercialTerms, ProjectConfig, TaxArrangement, UserProfile } from '../../domain/types';
import { contractConfig, snapshotsFor, type ContractFunding, type ContractSnapshot, type ContractStatus, type ContractTerms, type OwnerReason } from '../contract';
import type { EngineContext } from '../evaluate';
import { generateStrategies } from '../generate';
import { requiredAdditionalCapital } from '../reverse';

export const ARRANGEMENTS: TaxArrangement[] = ['gross', 'mixed', 'net'];
const EPS = 1e-9;
const round = (x: number) => Math.round(x * 1e6) / 1e6;

/** One (contract, route) pair, read from its snapshot. */
export interface JointPair {
  arrangement: TaxArrangement;
  combinationPct: number;
  funding: ContractFunding;
  contractId: string;
  routeId: string;
  ownerValue: number;
  ownerAccepts: boolean;
  ownerReason: OwnerReason | null;
  wholeApartments: number;
  developerMargin: number | null;
  developerOk: boolean;
  status: ContractStatus;
  conditions: string[];
}

/** Summary of one tested contract: the owner's best accepted route and its own developer margin. */
export interface JointCell {
  arrangement: TaxArrangement;
  combinationPct: number;
  funding: ContractFunding;
  owner: { ok: boolean; routeId: string | null; value: number | null; wholeApartments: number };
  /** ok = the developer reaches the hurdle on at least one route; margin = on the owner's best route (else the best). */
  developer: { ok: boolean; margin: number | null };
  feasibleRoutes: string[];
}

export interface PriceLever {
  arrangement: TaxArrangement;
  combinationPct: number;
  funding: ContractFunding;
  routeId: string;
  /** Lowest apartment price per m² at which this route leaves the developer the hurdle. */
  pricePerSqm: number;
  /** At that price, does the owner still accept the route (re-evaluated, not assumed)? */
  ownerAccepts: boolean;
}

export interface CostLever {
  arrangement: TaxArrangement;
  combinationPct: number;
  funding: ContractFunding;
  routeId: string;
  /** Highest developer direct cost per saleable m² that leaves the hurdle on this route (now: current). */
  directCostPerSqm: number;
  current: number;
  ownerAccepts: boolean;
}

export interface CapitalLever {
  arrangement: TaxArrangement;
  combinationPct: number;
  funding: ContractFunding;
  routeId: string;
  extraCapital: number;
  /** Funding-only candidates examined (all of them — none dropped). */
  candidates: number;
  /** With the extra capital, re-evaluated: does the owner accept and does the developer still reach the hurdle? */
  ownerAccepts: boolean;
  developerOk: boolean;
}

export interface ArrangementSummary {
  arrangement: TaxArrangement;
  /** % ranges (tested points, inclusive) where the owner accepts some route / the developer accepts some route / both the same route. */
  ownerOk: [number, number][];
  developerOk: [number, number][];
  both: [number, number][];
  gap: null | {
    /** Lowest % the owner accepts (any route) and highest % the developer accepts (any route), in the tested range. */
    ownerMin: number | null;
    developerMax: number | null;
    /** Minimum distance between the two sides on the same route and funding; null = no route has both sides in range. */
    nearest: null | { routeId: string; funding: ContractFunding; ownerAt: number; developerAt: number; points: number };
    /** At the owner's closest accepted pair: the developer's margin there (the hurdle it would have to accept). */
    marginLever: null | { combinationPct: number; routeId: string; funding: ContractFunding; margin: number };
    priceLever: PriceLever | null;
    costLever: CostLever | null;
    capitalLever: CapitalLever | null;
  };
}

export interface JointResult {
  cells: JointCell[];
  feasible: JointPair[];
  frontier: JointPair[];
  arrangements: ArrangementSummary[];
  fundings: ContractFunding[];
  targetMargin: number;
  step: number;
  /** Widest spacing between tested points (where nothing changed between coarse points). */
  resolution: number;
  /** Always false: a feasible set narrower than the resolution can be missed. */
  complete: false;
  contractsEvaluated: number;
}

/** Points from min to max at `step`, both endpoints included. Throws on a non-positive or non-finite step. */
export function gridPoints(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(step) || step <= 0) throw new Error(`צעד חיפוש לא תקין: ${step}`);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error(`טווח חיפוש לא תקין: ${min}–${max}`);
  const out: number[] = [];
  const n = Math.floor((max - min) / step + EPS);
  for (let i = 0; i <= n; i += 1) out.push(round(min + i * step));
  if (out[out.length - 1] < round(max) - EPS) out.push(round(max));
  return out;
}

/**
 * Evaluate every `every`-th point (and the last), then every point between two coarse points whose signature differs.
 * Returns the evaluated points in order with their values.
 */
export function adaptiveGrid<T>(
  min: number,
  max: number,
  step: number,
  every: number,
  evalAt: (c: number) => T,
  signature: (t: T) => string = (t) => String(t),
): { points: number[]; values: Map<number, T>; resolution: number; complete: false } {
  if (!Number.isInteger(every) || every < 1) throw new Error(`צעד גס לא תקין: ${every}`);
  const all = gridPoints(min, max, step);
  const values = new Map<number, T>();
  const at = (i: number) => {
    const c = all[i];
    if (!values.has(c)) values.set(c, evalAt(c));
    return values.get(c)!;
  };
  const coarse: number[] = [];
  for (let i = 0; i < all.length; i += every) coarse.push(i);
  if (coarse[coarse.length - 1] !== all.length - 1) coarse.push(all.length - 1);
  coarse.forEach(at);
  let widest = 0;
  for (let k = 0; k + 1 < coarse.length; k += 1) {
    const [a, b] = [coarse[k], coarse[k + 1]];
    if (signature(at(a)) !== signature(at(b))) for (let i = a + 1; i < b; i += 1) at(i);
    else widest = Math.max(widest, all[b] - all[a]);
  }
  const points = all.filter((c) => values.has(c));
  return { points, values, resolution: round(Math.max(widest, step)), complete: false };
}

export const bothAccept = (p: JointPair, hurdle: number) => p.ownerAccepts && p.developerMargin !== null && p.developerMargin >= hurdle - EPS;

/**
 * Non-dominated pairs on (owner value ↑, developer margin ↑). Pairs with the same values (e.g. the same route with an
 * unused tax loan) appear once — the first, i.e. the simplest funding.
 */
export function frontierOf(pairs: JointPair[]): JointPair[] {
  const m = (p: JointPair) => p.developerMargin ?? -Infinity;
  const seen = new Set<string>();
  return pairs
    .filter((g) => !pairs.some((o) => o !== g && o.ownerValue >= g.ownerValue && m(o) >= m(g) && (o.ownerValue > g.ownerValue || m(o) > m(g))))
    .filter((g) => {
      const key = `${g.arrangement}|${g.combinationPct}|${Math.round(g.ownerValue)}|${m(g).toFixed(6)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Inclusive ranges of consecutive tested points where pred holds (no monotonicity assumed). */
function ranges(points: number[], pred: (c: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  points.forEach((p, i) => {
    if (!pred(p)) return;
    if (start === null) start = p;
    if (i === points.length - 1 || !pred(points[i + 1])) {
      out.push([start, p]);
      start = null;
    }
  });
  return out;
}

const toPair = (s: ContractSnapshot): JointPair => ({
  arrangement: s.contract.arrangement,
  combinationPct: s.contract.combinationPct,
  funding: s.contract.funding,
  contractId: s.id,
  routeId: s.routeId,
  ownerValue: s.owner.value,
  ownerAccepts: s.owner.accepts,
  ownerReason: s.owner.reasonCode,
  wholeApartments: s.owner.wholeApartments,
  developerMargin: s.developer.margin,
  developerOk: s.developer.ok,
  status: s.status,
  conditions: s.conditions,
});

/** Funding the household could rely on: none; a developer tax loan (if they can repay at all); another property's loan. */
export function fundingsFor(profile: UserProfile): ContractFunding[] {
  const out: ContractFunding[] = ['none'];
  if (profile.maxMonthlyRepayment !== 0) out.push('developer_loan');
  if (profile.soleHome === false && profile.maxMonthlyRepayment !== 0 && typeof profile.otherPropertyBorrowingLimit !== 'number') out.push('other_property');
  return out;
}

/** Bisect the boundary of a monotone predicate on [lo, hi]; `rising` = false below, true above. */
function boundary(lo: number, hi: number, ok: (x: number) => boolean, rising: boolean, iters = 22): number | null {
  if (rising ? !ok(hi) : !ok(lo)) return null;
  if (rising ? ok(lo) : ok(hi)) return rising ? lo : hi;
  for (let i = 0; i < iters; i += 1) {
    const mid = (lo + hi) / 2;
    if (ok(mid) === rising) hi = mid;
    else lo = mid;
  }
  return rising ? hi : lo;
}

export interface JointOptions {
  /** Finest % step (default: the slider step). */
  step?: number;
  /** Coarse pass every n fine steps (default 2), refined where anything changes. */
  coarseEvery?: number;
}

export function jointSearch(
  profile: UserProfile,
  terms: CommercialTerms,
  offer: ContractTerms['offer'],
  config: ProjectConfig,
  opts: JointOptions = {},
): JointResult {
  const step = opts.step ?? config.commercial.combination.step;
  const every = opts.coarseEvery ?? 2;
  const { min, max } = config.commercial.combination;
  gridPoints(min, max, step); // validates before any work
  const invalid = validateInputs(profile, terms, config);
  if (invalid.length) throw new Error(invalid.join(' '));
  const hurdle = config.developer.targetMarginOnRevenue;
  const fundings = fundingsFor(profile);
  const K = (arrangement: TaxArrangement, combinationPct: number, funding: ContractFunding): ContractTerms => ({
    arrangement,
    combinationPct,
    markup: terms.developerMarkup,
    offer,
    funding,
  });

  let contractsEvaluated = 0;
  let resolution = step;
  const cells: JointCell[] = [];
  const pairsBy = new Map<TaxArrangement, JointPair[]>();
  const pointsBy = new Map<TaxArrangement, Set<number>>();
  for (const arrangement of ARRANGEMENTS) {
    const list: JointPair[] = [];
    const pts = new Set<number>();
    for (const funding of fundings) {
      const g = adaptiveGrid(
        min,
        max,
        step,
        every,
        (c) => {
          contractsEvaluated += 1;
          return snapshotsFor(profile, K(arrangement, c, funding), config).map(toPair);
        },
        (ps) => ps.map((p) => `${p.routeId}:${p.ownerAccepts ? 1 : 0}${p.developerOk ? 1 : 0}`).join('|'),
      );
      resolution = Math.max(resolution, g.resolution);
      for (const c of g.points) {
        pts.add(c);
        const ps = g.values.get(c)!;
        list.push(...ps);
        const accepted = ps.filter((p) => p.ownerAccepts).sort((a, b) => b.ownerValue - a.ownerValue);
        const best = accepted[0] ?? null;
        const margins = ps.map((p) => p.developerMargin).filter((m): m is number => m !== null);
        cells.push({
          arrangement,
          combinationPct: c,
          funding,
          owner: { ok: !!best, routeId: best?.routeId ?? null, value: best?.ownerValue ?? null, wholeApartments: best?.wholeApartments ?? 0 },
          developer: { ok: ps.some((p) => p.developerOk), margin: best ? best.developerMargin : margins.length ? Math.max(...margins) : null },
          feasibleRoutes: ps.filter((p) => bothAccept(p, hurdle)).map((p) => p.routeId),
        });
      }
    }
    pairsBy.set(arrangement, list);
    pointsBy.set(arrangement, pts);
  }

  const feasible = [...pairsBy.values()].flat().filter((p) => bothAccept(p, hurdle));
  const frontier = frontierOf(feasible);

  const snapshotOf = (p: { arrangement: TaxArrangement; combinationPct: number; funding: ContractFunding; routeId: string }, cfg = config, prof = profile) =>
    snapshotsFor(prof, K(p.arrangement, p.combinationPct, p.funding), cfg).find((s) => s.routeId === p.routeId) ?? null;

  const arrangements: ArrangementSummary[] = ARRANGEMENTS.map((arrangement) => {
    const list = pairsBy.get(arrangement)!;
    const points = [...pointsBy.get(arrangement)!].sort((a, b) => a - b);
    const at = (c: number) => list.filter((p) => p.combinationPct === c);
    const ownerOk = ranges(points, (c) => at(c).some((p) => p.ownerAccepts));
    const developerOk = ranges(points, (c) => at(c).some((p) => p.developerOk));
    const both = ranges(points, (c) => at(c).some((p) => bothAccept(p, hurdle)));
    if (both.length) return { arrangement, ownerOk, developerOk, both, gap: null };

    const ownerMin = ownerOk[0]?.[0] ?? null;
    const developerMax = developerOk.length ? developerOk[developerOk.length - 1][1] : null;
    // Minimum distance on the same route and funding.
    let nearest: NonNullable<ArrangementSummary['gap']>['nearest'] = null;
    const keys = [...new Set(list.map((p) => `${p.funding}|${p.routeId}`))];
    for (const key of keys) {
      const same = list.filter((p) => `${p.funding}|${p.routeId}` === key);
      const O = same.filter((p) => p.ownerAccepts).map((p) => p.combinationPct);
      const D = same.filter((p) => p.developerOk).map((p) => p.combinationPct);
      for (const o of O)
        for (const d of D) {
          const dist = round(Math.abs(o - d));
          if (!nearest || dist < nearest.points - EPS) nearest = { routeId: same[0].routeId, funding: same[0].funding, ownerAt: o, developerAt: d, points: dist };
        }
    }
    // The owner's closest accepted pair: on the nearest route, else the accepted pair with the highest developer margin.
    const accepted = list.filter((p) => p.ownerAccepts && p.developerMargin !== null);
    const anchor =
      (nearest && accepted.find((p) => p.routeId === nearest!.routeId && p.funding === nearest!.funding && p.combinationPct === nearest!.ownerAt)) ||
      [...accepted].sort((a, b) => b.developerMargin! - a.developerMargin!)[0] ||
      null;
    const marginLever = anchor ? { combinationPct: anchor.combinationPct, routeId: anchor.routeId, funding: anchor.funding, margin: anchor.developerMargin! } : null;

    let priceLever: PriceLever | null = null;
    let costLever: CostLever | null = null;
    if (anchor) {
      const priced = (p: number): ProjectConfig => ({ ...config, market: { ...config.market, apartmentValuePerSqm: p } });
      const price0 = config.market.apartmentValuePerSqm;
      const devOkAt = (cfg: ProjectConfig) => {
        const s = snapshotOf(anchor, cfg);
        return !!s && s.developer.margin !== null && s.developer.margin >= hurdle - EPS;
      };
      const p = boundary(price0, price0 * 3, (x) => devOkAt(priced(x)), true);
      if (p !== null) {
        const pr = Math.ceil(p);
        priceLever = { ...pick(anchor), pricePerSqm: pr, ownerAccepts: !!snapshotOf(anchor, priced(pr + 1))?.owner.accepts };
      }
      const lotId = profile.lotId || config.rights.defaultLotId;
      const cost0 = directCostPerSaleableSqm(config, lotId);
      const costed = (d: number): ProjectConfig => ({ ...config, developer: { ...config.developer, directCostPerSqm: d } });
      const d = boundary(0, cost0, (x) => devOkAt(costed(x)), false);
      if (d !== null) {
        const dc = Math.floor(d);
        costLever = { ...pick(anchor), directCostPerSqm: dc, current: Math.round(cost0), ownerAccepts: !!snapshotOf(anchor, costed(dc - 1))?.owner.accepts };
      }
    }

    // Extra own capital where the developer reaches the hurdle: every funding-only candidate, none dropped.
    let capitalLever: CapitalLever | null = null;
    const devAt = nearest?.developerAt ?? developerMax;
    if (devAt !== null && profile.availableCapital !== null) {
      const cands = list.filter((p) => p.combinationPct === devAt && p.developerOk && p.ownerReason === 'unfunded');
      let best: { extra: number; pair: JointPair } | null = null;
      for (const c of cands) {
        const k = K(arrangement, devAt, c.funding);
        const cfg = contractConfig(config, k);
        const info = calculateRights(profile.landAreaSqm, cfg, profile.lotId);
        const t: CommercialTerms = { combinationPct: devAt, developerMarkup: terms.developerMarkup };
        const ctx: EngineContext = { info, profile, terms: t };
        const cand = generateStrategies(info, t, cfg).find((x) => x.id === c.routeId);
        if (!cand) continue;
        const v = requiredAdditionalCapital(cand, ctx, cfg).value;
        if (v !== null && (!best || v < best.extra)) best = { extra: v, pair: c };
      }
      if (best) {
        const extra = Math.ceil(best.extra / 1000) * 1000;
        const s = snapshotOf(best.pair, config, { ...profile, availableCapital: profile.availableCapital + extra });
        capitalLever = { ...pick(best.pair), extraCapital: extra, candidates: cands.length, ownerAccepts: !!s?.owner.accepts, developerOk: !!s?.developer.ok };
      }
    }
    return { arrangement, ownerOk, developerOk, both, gap: { ownerMin, developerMax, nearest, marginLever, priceLever, costLever, capitalLever } };
  });

  return { cells, feasible, frontier, arrangements, fundings, targetMargin: hurdle, step, resolution, complete: false, contractsEvaluated };
}

const pick = (p: JointPair) => ({ arrangement: p.arrangement, combinationPct: p.combinationPct, funding: p.funding, routeId: p.routeId });
