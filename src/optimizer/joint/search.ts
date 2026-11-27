/**
 * Iteration 9 / phase E — the bilateral contract search (first version).
 *
 * A contract here is (combination %, tax arrangement); the owner's markup and offer terms stay as entered. For each
 * contract on a grid it asks two questions on the same model:
 *  - the owner: is there an evidence-based route this household can fund (and, for the whole-apartment goal, that
 *    ends with a whole apartment)? Its value is the route's equity NPV.
 *  - the developer: does the lot leave at least the target margin (the hurdle — an assumption, not a statutory rule)?
 * Contracts that pass both are feasible; the non-dominated ones (owner value ↑, developer margin ↑) form the frontier.
 * When none pass, a gap certificate says how far apart the two sides are on each arrangement and which single lever
 * would close it. Thresholds are read from the grid as intervals (no monotonicity is assumed).
 * Equal developer profit is never presented as viability: a contract passes only above the hurdle.
 */
import { calculateRights } from '../../domain/rights';
import { developerBreakEvens, lotDeveloperPnL, lotViablePct } from '../../domain/lotDeveloper';
import { policyBlock } from '../../domain/policy';
import type { CommercialTerms, ProjectConfig, TaxArrangement, UserProfile } from '../../domain/types';
import { withArrangement } from '../../domain/arrangements';
import { evaluateCandidate, type EngineContext } from '../evaluate';
import { assessEvaluation } from '../feasibility';
import { generateStrategies } from '../generate';
import { requiredAdditionalCapital } from '../reverse';

export const ARRANGEMENTS: TaxArrangement[] = ['gross', 'mixed', 'net'];

export interface JointCell {
  arrangement: TaxArrangement;
  combinationPct: number;
  owner: { ok: boolean; routeId: string | null; value: number | null; wholeApartments: number };
  developer: { ok: boolean; margin: number };
}

export interface ArrangementSummary {
  arrangement: TaxArrangement;
  /** Combination % ranges (grid points, inclusive) where each side / both sides accept. */
  ownerOk: [number, number][];
  /** The developer's highest viable % found exactly (it can lie below the slider's range); null = not even at 0%. */
  developerMaxExact: number | null;
  developerOk: [number, number][];
  both: [number, number][];
  /** When there is no overlap: lowest % the owner accepts, highest % the developer accepts, and the gap between. */
  gap: null | {
    ownerMin: number | null;
    developerMax: number | null;
    points: number | null;
    /** At the owner's minimum %: the developer's margin, and the cost / price that would restore its hurdle. */
    atOwnerMin: null | { margin: number; maxDirectCostPerSqm: number | null; minApartmentPricePerSqm: number | null };
    /** At the developer's maximum % (exact): the extra own capital that would let the owner fund a route. */
    atDeveloperMax: null | { combinationPct: number; extraCapital: number | null; routeId: string | null };
  };
}

export interface JointResult {
  grid: JointCell[];
  feasible: JointCell[];
  frontier: JointCell[];
  arrangements: ArrangementSummary[];
  targetMargin: number;
  step: number;
}

const EPS = 1e-9;
/** Routes whose outcome hinges on an unverified price never count as the owner's evidence (as in the main ranking). */
const PRICE_LEGS = new Set(['sell_rights', 'revenue_share', 'buy_rights', 'settle_fraction_cash']);

function ownerSide(profile: UserProfile, terms: CommercialTerms, config: ProjectConfig): JointCell['owner'] & { blockedOnlyByFunding: string[] } {
  const info = calculateRights(profile.landAreaSqm, config, profile.lotId);
  const ctx: EngineContext = { info, profile, terms };
  const R = info.apartmentEquivalents;
  const wantsWhole = profile.goal === 'maximize_apartments';
  let best: { id: string; value: number; whole: number } | null = null;
  const fundingOnly: string[] = [];
  for (const c of generateStrategies(info, terms, config)) {
    if (c.type === 'S13') continue; // no assumed apartment sizes in the summary-level decision
    if (c.legs.some((l) => PRICE_LEGS.has(l.kind))) continue;
    if (policyBlock(c, R, config)) continue;
    const ev = evaluateCandidate(c, ctx, config);
    const whole = ev.plan.wholeApartmentsRetained;
    if (wantsWhole && whole < 1) continue;
    const a = assessEvaluation(c, ev, profile, config, R);
    if (a.fails.length || a.missing.length) {
      if (a.fails.every((f) => f === 'UNFUNDED_OBLIGATION' || f === 'REPAYMENT_EXCEEDED' || f === 'LTV_EXCEEDED')) fundingOnly.push(c.id);
      continue;
    }
    if (!best || ev.comparisonValue > best.value) best = { id: c.id, value: ev.comparisonValue, whole };
  }
  return { ok: !!best, routeId: best?.id ?? null, value: best?.value ?? null, wholeApartments: best?.whole ?? 0, blockedOnlyByFunding: fundingOnly };
}

/** Inclusive ranges of consecutive grid points where pred holds (no monotonicity assumed). */
function ranges(points: number[], pred: (i: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start: number | null = null;
  points.forEach((p, i) => {
    if (pred(i)) {
      if (start === null) start = p;
      if (i === points.length - 1 || !pred(i + 1)) {
        out.push([start, p]);
        start = null;
      }
    }
  });
  return out;
}

export function jointSearch(profile: UserProfile, terms: CommercialTerms, config: ProjectConfig, step = 0.02): JointResult {
  const { min, max } = config.commercial.combination;
  const points: number[] = [];
  for (let c = min; c <= max + EPS; c += step) points.push(Math.round(c * 1e6) / 1e6);
  const target = config.developer.targetMarginOnRevenue;
  const info = calculateRights(profile.landAreaSqm, config, profile.lotId);
  const lotCtx = { info, profile, config };
  const opts = { markup: terms.developerMarkup };

  const grid: JointCell[] = [];
  const funding = new Map<string, string[]>();
  for (const arrangement of ARRANGEMENTS) {
    const cfg = withArrangement(config, arrangement);
    for (const c of points) {
      const o = ownerSide(profile, { ...terms, combinationPct: c }, cfg);
      funding.set(`${arrangement}|${c}`, o.blockedOnlyByFunding);
      const margin = lotDeveloperPnL({ ...lotCtx, config: cfg }, arrangement, c, opts).margin;
      grid.push({
        arrangement,
        combinationPct: c,
        owner: { ok: o.ok, routeId: o.routeId, value: o.value, wholeApartments: o.wholeApartments },
        developer: { ok: margin >= target - EPS, margin },
      });
    }
  }

  const feasible = grid.filter((g) => g.owner.ok && g.developer.ok);
  const frontier = feasible.filter(
    (g) => !feasible.some((o) => o !== g && o.owner.value! >= g.owner.value! && o.developer.margin >= g.developer.margin && (o.owner.value! > g.owner.value! || o.developer.margin > g.developer.margin)),
  );

  const arrangements: ArrangementSummary[] = ARRANGEMENTS.map((arrangement) => {
    const cells = grid.filter((g) => g.arrangement === arrangement);
    const ownerOk = ranges(points, (i) => cells[i].owner.ok);
    const developerOk = ranges(points, (i) => cells[i].developer.ok);
    const both = ranges(points, (i) => cells[i].owner.ok && cells[i].developer.ok);
    const cfgA = withArrangement(config, arrangement);
    const developerMaxExact = lotViablePct({ ...lotCtx, config: cfgA }, arrangement, opts);
    let gap: ArrangementSummary['gap'] = null;
    if (!both.length) {
      const ownerMin = cells.find((g) => g.owner.ok)?.combinationPct ?? null;
      const developerMax = [...cells].reverse().find((g) => g.developer.ok)?.combinationPct ?? developerMaxExact;
      const cfg = withArrangement(config, arrangement);
      let atOwnerMin: NonNullable<ArrangementSummary['gap']>['atOwnerMin'] = null;
      if (ownerMin !== null) {
        const b = developerBreakEvens({ ...lotCtx, config: cfg }, arrangement, ownerMin, opts);
        atOwnerMin = { margin: cells.find((g) => g.combinationPct === ownerMin)!.developer.margin, maxDirectCostPerSqm: b.maxDirectCostPerSqm, minApartmentPricePerSqm: b.minApartmentPricePerSqm };
      }
      let atDeveloperMax: NonNullable<ArrangementSummary['gap']>['atDeveloperMax'] = null;
      if (developerMax !== null && developerMax > 0 && profile.availableCapital !== null) {
        const t = { ...terms, combinationPct: developerMax };
        const ctx: EngineContext = { info: calculateRights(profile.landAreaSqm, cfg, profile.lotId), profile, terms: t };
        const ids = funding.get(`${arrangement}|${developerMax}`) ?? ownerSide(profile, t, cfg).blockedOnlyByFunding;
        const cands = generateStrategies(ctx.info, t, cfg).filter((c) => ids.includes(c.id)).slice(0, 4);
        let bestExtra: { extra: number; id: string } | null = null;
        for (const c of cands) {
          const v = requiredAdditionalCapital(c, ctx, cfg).value;
          if (v !== null && (!bestExtra || v < bestExtra.extra)) bestExtra = { extra: v, id: c.id };
        }
        atDeveloperMax = { combinationPct: developerMax, extraCapital: bestExtra?.extra ?? null, routeId: bestExtra?.id ?? null };
      }
      gap = {
        ownerMin,
        developerMax,
        points: ownerMin !== null && developerMax !== null ? Math.max(0, ownerMin - developerMax) : null,
        atOwnerMin,
        atDeveloperMax,
      };
    }
    return { arrangement, ownerOk, developerMaxExact, developerOk, both, gap };
  });

  return { grid, feasible, frontier, arrangements, targetMargin: target, step };
}
