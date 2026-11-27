/**
 * Deal families for the summary: the owner compares kinds of deal, not variants of one deal.
 *  - combination_paid: combination + a payment to the developer to end with whole apartment(s). The ways to pay are
 *    variants of one deal, shown together on one card: completion at market price (S06), construction services on
 *    land kept out of the combination (S11), or selling part of the rights and paying for building on the rest
 *    (S03/S05/S07/S08/S10).
 *  - combination_only: all rights into combination, no payment; the fraction is held jointly, pooled or paid out.
 *  - cash: sell (S01/S09/S01M).  - revenue_share: עסקת תמורות (S04).
 * A whole apartment of another size (S13) sits on the combination + payment card, marked as depending on inventory.
 */
import type { DecisionResult, Goal, PriceThreshold, StrategyResult, StrategyType } from '../domain/types';

export type DealFamily = 'combination_paid' | 'combination_only' | 'cash' | 'revenue_share';

export const DEAL_FAMILIES: DealFamily[] = ['combination_paid', 'combination_only', 'cash', 'revenue_share'];

export const FAMILY_OF: Partial<Record<StrategyType, DealFamily>> = {
  S06: 'combination_paid',
  S11: 'combination_paid',
  S03: 'combination_paid',
  S05: 'combination_paid',
  S07: 'combination_paid',
  S08: 'combination_paid',
  S10: 'combination_paid',
  S02: 'combination_only',
  S02C: 'combination_only',
  S02P: 'combination_only',
  S01: 'cash',
  S09: 'cash',
  S01M: 'cash',
  S04: 'revenue_share',
  // A whole smaller (or larger) apartment: combination + a completion payment. Shown as an option to negotiate —
  // it depends on the project's inventory and allocation (iteration 6, review §10).
  S13: 'combination_paid',
};

export const FAMILY_LABELS: Record<DealFamily, string> = {
  combination_paid: 'קומבינציה + תשלום ליזם',
  combination_only: 'קומבינציה בלבד, בלי תשלום',
  cash: 'עסקת מזומן',
  revenue_share: 'עסקת תמורות',
};

/** How the owner pays for the missing part of the apartment — the variants inside combination_paid. */
export const PAYMENT_METHOD: Partial<Record<StrategyType, string>> = {
  S06: 'השלמה במחיר שוק',
  S11: 'שירותי בנייה על חלק מהקרקע',
  S03: 'מכירת היתרה ושירותי בנייה',
  S05: 'מכירה חלקית ושירותי בנייה',
  S07: 'שירותי בנייה ומכירת דירה במסירה',
  S08: 'שירותי בנייה והשכרה',
  S10: 'קניית זכויות ושירותי בנייה',
  S13: 'השלמה לדירה בגודל אחר (תלוי במלאי)',
};

/** The terms a conditional direction depends on (funding to obtain, or other tax terms at their %). */
export type RouteCondition = Omit<NonNullable<DecisionResult['conditionalRecommendation']>, 'result'>;

interface Base {
  family: DealFamily;
  r: StrategyResult;
}
export type RouteOption =
  /** Fits under the evidence-based assumptions (or under a stated contract condition). */
  | (Base & { kind: 'fits'; condition: RouteCondition | null })
  /** Depends on a price nobody has verified: shown with the price it would need. */
  | (Base & { kind: 'price'; threshold: PriceThreshold })
  /** Close: fits with this much more capital. */
  | (Base & { kind: 'short'; additionalCapital: number | null })
  /** Does not fit the inputs. */
  | (Base & { kind: 'none' });

/** A summary card: the best route of a family, plus other payment methods reaching the same apartments. */
export type PriorityRoute = RouteOption & { variants: RouteOption[] };

const familyOf = (r: StrategyResult): DealFamily | undefined => FAMILY_OF[r.strategyType];

/**
 * One card per deal family, best first:
 *  0. fits (rank order; a conditional recommendation first),
 *  1. depends on an unverified price but is affordable,
 *  2. evidence-based and short of capital (smallest gap first),
 *  3. depends on a price and is not affordable either,
 *  4. does not fit (or the developer is not expected to offer it).
 * When the goal is a whole apartment, a route that does not fit and leaves no apartment comes after those that would.
 * The combination + payment card also lists up to two other payment methods with the same number of apartments.
 */
export function priorityRoutes(result: DecisionResult, goal: Goal = 'balanced'): PriorityRoute[] {
  const options: { p: RouteOption; key: [number, number] }[] = [];
  const c = result.conditionalRecommendation;
  if (!result.recommendation && c && familyOf(c.result)) {
    const condition: RouteCondition = { kind: c.kind, method: c.method, arrangement: c.arrangement, combinationPct: c.combinationPct };
    options.push({ p: { family: familyOf(c.result)!, kind: 'fits', r: c.result, condition }, key: [0, -1] });
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
  // Best option per route, then per family.
  const byRoute = new Map<string, { p: RouteOption; key: [number, number] }>();
  for (const o of options) {
    const cur = byRoute.get(o.p.r.id);
    if (!cur || better(o.key, cur.key) < 0) byRoute.set(o.p.r.id, o);
  }
  const best = new Map<DealFamily, { p: RouteOption; key: [number, number] }>();
  for (const o of byRoute.values()) {
    const cur = best.get(o.p.family);
    if (!cur || better(o.key, cur.key) < 0) best.set(o.p.family, o);
  }
  return [...best.values()]
    .sort((a, b) => better(a.key, b.key))
    .map(({ p }) => {
      if (p.family !== 'combination_paid') return { ...p, variants: [] };
      const seen = new Set<StrategyType>([p.r.strategyType]);
      const variants = [...byRoute.values()]
        .filter((o) => o.p.family === p.family && o.p.r.metrics.wholeApartments === p.r.metrics.wholeApartments)
        .sort((a, b) => better(a.key, b.key))
        .filter((o) => (seen.has(o.p.r.strategyType) ? false : (seen.add(o.p.r.strategyType), true)))
        .slice(0, 2)
        .map((o) => o.p);
      return { ...p, variants };
    });
}
