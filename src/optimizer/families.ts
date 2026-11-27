/**
 * Deal families for the summary: the owner compares kinds of deal, not variants of one deal.
 * The summary shows at most one route per family — combination, revenue share (תמורות), cash, construction
 * services — and never a route that assumes a requested apartment size (S13 tiers stay in the advanced view).
 * Hybrids belong to the family of their distinctive part: S06 (combination + paid completion) is combination;
 * S05/S11 (selling or combining part of the rights to fund building the rest) are construction services.
 */
import type { DecisionResult, Goal, PriceThreshold, StrategyResult, StrategyType, TaxArrangement } from '../domain/types';

export type DealFamily = 'combination' | 'revenue_share' | 'cash' | 'services';

export const DEAL_FAMILIES: DealFamily[] = ['combination', 'revenue_share', 'cash', 'services'];

export const FAMILY_OF: Partial<Record<StrategyType, DealFamily>> = {
  S02: 'combination',
  S02C: 'combination',
  S02P: 'combination',
  S06: 'combination',
  S04: 'revenue_share',
  S01: 'cash',
  S09: 'cash',
  S01M: 'cash',
  S03: 'services',
  S05: 'services',
  S07: 'services',
  S08: 'services',
  S10: 'services',
  S11: 'services',
  // S13 is deliberately absent: it assumes a requested apartment size.
};

export const FAMILY_LABELS: Record<DealFamily, string> = {
  combination: 'עסקת קומבינציה',
  revenue_share: 'עסקת תמורות',
  cash: 'עסקת מזומן',
  services: 'עסקת שירותי בנייה',
};

export type PriorityRoute =
  /** Fits under the evidence-based assumptions (or under a stated contract condition). */
  | { family: DealFamily; kind: 'fits'; r: StrategyResult; condition: TaxArrangement | null }
  /** Depends on a price nobody has verified: shown with the price it would need. */
  | { family: DealFamily; kind: 'price'; r: StrategyResult; threshold: PriceThreshold }
  /** Close: fits with this much more capital. */
  | { family: DealFamily; kind: 'short'; r: StrategyResult; additionalCapital: number | null }
  /** Does not fit the inputs. */
  | { family: DealFamily; kind: 'none'; r: StrategyResult };

const familyOf = (r: StrategyResult): DealFamily | undefined => FAMILY_OF[r.strategyType];

/**
 * One route per deal family, best first:
 *  0. fits (rank order; a conditional recommendation first),
 *  1. depends on an unverified price but is affordable,
 *  2. evidence-based and short of capital (smallest gap first),
 *  3. depends on a price and is not affordable either,
 *  4. does not fit (or the developer is not expected to offer it).
 * When the goal is a whole apartment, a route that does not fit and leaves no apartment comes after those that would.
 */
export function priorityRoutes(result: DecisionResult, goal: Goal = 'balanced'): PriorityRoute[] {
  const options: { p: PriorityRoute; key: [number, number] }[] = [];
  const c = result.conditionalRecommendation;
  if (!result.recommendation && c && familyOf(c.result)) {
    options.push({ p: { family: familyOf(c.result)!, kind: 'fits', r: c.result, condition: c.arrangement }, key: [0, -1] });
  }
  result.ranked.forEach((r, i) => {
    const f = familyOf(r);
    if (f) options.push({ p: { family: f, kind: 'fits', r, condition: null }, key: [0, i] });
  });
  result.priceConditional.forEach((x, i) => {
    const f = familyOf(x.result);
    if (!f) return;
    const affordable = x.result.assessment.affordability !== 'does_not_fit';
    options.push({ p: { family: f, kind: 'price', r: x.result, threshold: x.threshold }, key: [affordable ? 1 : 3, i] });
  });
  for (const g of [...result.nearMiss, ...result.capitalGaps]) {
    const f = familyOf(g.result);
    if (f) options.push({ p: { family: f, kind: 'short', r: g.result, additionalCapital: g.additionalCapital }, key: [2, g.additionalCapital ?? Infinity] });
  }
  for (const r of result.results) {
    const f = familyOf(r);
    if (!f) continue;
    const effort = r.personalCapitalRequired + r.mortgageRequired + (r.assessment.commercial === 'negotiable' ? 1e12 : 0);
    options.push({ p: { family: f, kind: 'none', r }, key: [4, effort] });
  }
  if (goal === 'maximize_apartments') {
    for (const o of options) if (o.key[0] > 0 && o.p.r.metrics.wholeApartments === 0) o.key[0] += 2.5;
  }
  const better = (a: [number, number], b: [number, number]) => a[0] - b[0] || a[1] - b[1];
  const best = new Map<DealFamily, { p: PriorityRoute; key: [number, number] }>();
  for (const o of options) {
    const cur = best.get(o.p.family);
    if (!cur || better(o.key, cur.key) < 0) best.set(o.p.family, o);
  }
  return [...best.values()].sort((a, b) => better(a.key, b.key)).map((o) => o.p);
}
