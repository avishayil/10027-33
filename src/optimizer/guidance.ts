/**
 * Goal guidance for the summary (V1 Milestone C2/C3; spec §3): one direction and up to two materially different
 * alternatives (other deal families), the goal's own measure, and — when nothing fits — the reasons instead of a forced
 * winner. A cash-oriented or no-risk owner also gets the sale price to ask for, even though today's sale value is
 * unknown. The goal is always the one the household chose.
 */
import type { DecisionResult, Goal, StrategyResult } from '../domain/types';
import { formatCompactCurrency } from '../utils/format';
import { REASON_TEXT } from './explain';
import { FAMILY_OF, priorityRoutes, type DealFamily, type PriorityRoute } from './families';

export interface GoalGuidance {
  goal: Goal;
  /** fits: on the evidence-based terms; conditional: only under terms still to obtain; no_fit: nothing fits. */
  kind: 'fits' | 'conditional' | 'no_fit';
  direction: StrategyResult | null;
  directionFamily: DealFamily | null;
  /** Up to two, each a different deal family from the direction and from each other. */
  alternatives: PriorityRoute[];
  alternativeFamilies: DealFamily[];
  /** The goal's own measure on the direction (or on the closest route when nothing fits). */
  measure: { label: string; value: number | null; text: string };
  /** For cash soon / no risk: the price per original m² a sale would need (no current sale value is known). */
  saleThreshold: number | null;
  /** When nothing fits: what stops the closest routes, in plain Hebrew. */
  reasons: string[];
}

const MEASURES: Record<Goal, { label: string; of: (r: StrategyResult) => number; text: (v: number) => string }> = {
  balanced: { label: 'ערך עבורכם (ערך נוכחי, מחירי היום)', of: (r) => r.comparisonValue, text: (v) => formatCompactCurrency(v) },
  maximize_apartments: { label: 'דירות שלמות בסוף', of: (r) => r.metrics.wholeApartments, text: (v) => String(v) },
  passive_income: {
    label: 'הכנסה חודשית נטו אחרי החזרי ההלוואות',
    of: (r) => r.metrics.sustainableMonthlyIncome,
    text: (v) => (v > 0 ? `${formatCompactCurrency(v)} לחודש` : 'אין הכנסה נטו'),
  },
  immediate_cash: {
    label: 'כסף זמין עד המועד שהגדרתם',
    of: (r) => r.metrics.liquidity,
    text: (v) => (v > 0 ? formatCompactCurrency(v) : 'אין כסף עד המועד'),
  },
  minimize_risk: { label: 'הלוואה נדרשת', of: (r) => r.mortgageRequired, text: (v) => (v > 1 ? formatCompactCurrency(v) : 'בלי הלוואה') },
};

const reasonsOf = (p: PriorityRoute): string[] => {
  if (p.kind === 'price') return [`תלוי במחיר שאינו ידוע (${p.r.priceDependency ?? 'מחיר'}) — צריך הצעה או שומה`];
  if (p.kind === 'short') return [p.additionalCapital !== null ? `חסר הון: עוד כ-${formatCompactCurrency(p.additionalCapital)}` : 'חסר הון'];
  const codes = p.r.reasonCodes.filter((c) => REASON_TEXT[c]).slice(0, 3);
  return codes.length ? codes.map((c) => REASON_TEXT[c]) : ['לא מתאים לנתונים שהזנתם'];
};

export function goalGuidance(result: DecisionResult, goal: Goal): GoalGuidance {
  const items = priorityRoutes(result, goal);
  const first = items[0] ?? null;
  const fits = !!first && first.kind === 'fits';
  const kind: GoalGuidance['kind'] = fits ? (first.condition ? 'conditional' : 'fits') : 'no_fit';
  const direction = fits ? first.r : null;
  // When nothing fits, the closest options are shown as alternatives (they are not a recommendation).
  const alternatives = (fits ? items.slice(1) : items).slice(0, 2);
  const m = MEASURES[goal];
  const ref = direction ?? first?.r ?? null;
  const value = ref ? m.of(ref) : null;
  const sale =
    goal === 'immediate_cash' || goal === 'minimize_risk'
      ? result.priceConditional.find((p) => (p.result.strategyType === 'S01M' || p.result.strategyType === 'S01') && (p.threshold.required ?? 0) > 0)
      : undefined;
  const reasons = kind === 'no_fit' ? [...new Set(items.slice(0, 3).flatMap(reasonsOf))] : [];
  if (kind === 'no_fit' && !reasons.length) reasons.push('אין מסלול שאפשר לחשב עם הנתונים שהזנתם');
  return {
    goal,
    kind,
    direction,
    directionFamily: direction ? (FAMILY_OF[direction.strategyType] ?? null) : null,
    alternatives,
    alternativeFamilies: alternatives.map((a) => a.family),
    measure: { label: m.label, value, text: value === null ? 'לא חושב' : m.text(value) },
    saleThreshold: sale?.threshold.required ?? null,
    reasons,
  };
}
