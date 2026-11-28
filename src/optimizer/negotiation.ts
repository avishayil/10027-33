/**
 * Terms to request from the developer (V1 Milestone C4; spec §3.5). One list: the minimum combination %, the maximum
 * completion payment, tax contributions, an interest subsidy, payment timing and conditional financing — each with what
 * it is worth to the owner, what it costs the developer and whether the model finds it plausible for the developer.
 * Plausibility is a modelled hurdle (the lot margin with this route against an assumed 15% target), never an offer.
 */
import type { CommercialTerms, DecisionResult, ProjectConfig, StrategyResult, UserProfile } from '../domain/types';
import { formatCompactCurrency, formatNumber } from '../utils/format';
import { concessionFrontier, type ConcessionRow } from './concessions';
import { snapshotsFor, type ContractTerms } from './contract';

export interface RequestItem {
  id: 'min_pct' | 'completion' | 'taxes' | 'interest' | 'timing' | 'financing';
  ask: string;
  /** The requested value (% as a fraction, or ₪), when there is one. */
  value: number | null;
  ownerGain: number | null;
  developerCost: number | null;
  developerMargin: number | null;
  plausibility: 'plausible' | 'unlikely' | 'unknown';
  basis: 'modelled';
  why: string;
}

export interface TermsToRequest {
  routeId: string | null;
  items: RequestItem[];
  note: string;
}

const NOTE = 'לפי המודל ויעד רווח משוער של היזם (15% מההכנסות — הנחה, לא כלל). זה סף למשא ומתן, לא הצעה.';

/** The route the list is for: the recommendation, else the best ranked, else the closest one that does not fit yet. */
export function requestRoute(d: DecisionResult): StrategyResult | null {
  return d.recommendation ?? d.ranked[0] ?? d.nearMiss[0]?.result ?? d.results.find((r) => r.id === 'S02') ?? null;
}

export function termsToRequest(d: DecisionResult, profile: UserProfile, terms: CommercialTerms, config: ProjectConfig): TermsToRequest {
  const route = requestRoute(d);
  if (!route) return { routeId: null, items: [], note: NOTE };
  const hurdle = config.developer.targetMarginOnRevenue;
  const k0: ContractTerms = {
    arrangement: config.commercial.taxArrangement,
    combinationPct: terms.combinationPct,
    markup: terms.developerMarkup,
    offer: config.commercial.offer,
    funding: 'none',
  };
  const list: Omit<RequestItem, 'basis'>[] = [];

  // Minimum % for the next whole apartment from the combination alone — judged on that deal (the full combination,
  // S02), at that %, with its own lot margin.
  // Only within the approved combination range (25–45%): beyond it the ask is not a realistic term.
  const min = d.negotiationTargets.find((t) => t.code === 'MIN_COMBINATION_PCT' && t.value !== null && t.value <= config.commercial.combination.max + 1e-9);
  if (min && min.value !== null) {
    const id = min.strategyId ?? 'S02';
    const s = snapshotsFor(profile, { ...k0, combinationPct: min.value }, config).find((x) => x.routeId === id);
    const m = s?.developer.margin ?? null;
    list.push({
      id: 'min_pct',
      ask: `אחוז קומבינציה של לפחות ${formatNumber(min.value * 100, 1)}%${min.note && min.note !== '1' ? ` (ל-${min.note} דירות שלמות)` : ' (לדירה שלמה)'}`,
      value: min.value,
      ownerGain: null,
      developerCost: null,
      developerMargin: m,
      plausibility: m === null ? 'unknown' : m >= hurdle - 1e-9 ? 'plausible' : 'unlikely',
      why: m === null ? 'אין חישוב רווח ליזם במסלול הזה' : `רווח היזם במגרש עם המסלול הזה באחוז הזה: ${formatNumber(m * 100, 1)}%`,
    });
  }

  // Maximum completion payment (the developer's price for the missing area is not known).
  const comp = d.negotiationTargets.find((t) => t.code === 'MAX_COMPLETION_PAYMENT' && t.value !== null && (t.strategyId === route.id || !t.strategyId));
  if (comp && comp.value !== null)
    list.push({
      id: 'completion',
      ask: `תשלום השלמה לדירה שלמה של לכל היותר ${formatCompactCurrency(comp.value)}`,
      value: comp.value,
      ownerGain: null,
      developerCost: null,
      developerMargin: null,
      plausibility: 'unknown',
      why: 'מחיר ההשלמה של היזם לא ידוע — זה המקסימום שתוכלו לממן',
    });

  // Concessions on the same route, re-evaluated on both sides.
  let rows: ConcessionRow[] = [];
  try {
    rows = concessionFrontier(profile, k0, config, route.id).rows.filter((r) => r.applicable && r.ownerGain !== null);
  } catch {
    rows = [];
  }
  const fromRow = (id: RequestItem['id'], r: ConcessionRow, ask: string): Omit<RequestItem, 'basis'> => ({
    id,
    ask,
    value: null,
    ownerGain: r.ownerGain,
    developerCost: r.developerCost,
    developerMargin: r.developerMargin,
    plausibility: r.developerMargin === null ? 'unknown' : r.developerOk ? 'plausible' : 'unlikely',
    why: `שווה לכם כ-${formatCompactCurrency(r.ownerGain ?? 0)}; עולה ליזם כ-${formatCompactCurrency(r.developerCost ?? 0)}${r.executable ? '' : ' — וגם אז המסלול עדיין לא אפשרי לכם'}`,
  });
  const tax = rows.find((r) => r.id === 'levy') ?? rows.find((r) => r.id === 'net_taxes');
  if (tax) list.push(fromRow('taxes', tax, tax.id === 'levy' ? 'שהיזם ישלם את היטל ההשבחה' : 'שהיזם ישלם את המסים (עסקת נטו)'));
  const interest = rows.find((r) => r.id === 'interest');
  if (interest) list.push(fromRow('interest', interest, 'שהיזם יישא בריבית על הלוואת המסים עד המסירה'));
  const timing = rows.find((r) => r.id === 'payment_timing');
  if (timing) list.push(fromRow('timing', timing, 'דחיית התשלומים שלכם ליזם למועד המסירה'));

  // Conditional financing: never assumed — only as a written term.
  const c = d.conditionalRecommendation;
  if (c && c.kind === 'funding')
    list.push({
      id: 'financing',
      ask: c.method === 'other_property' ? 'אישור הלוואה על הנכס האחר כתנאי בחוזה (או זכות יציאה אם לא תאושר)' : 'הלוואת מסים מהיזם כתנאי בחוזה — סכום, ריבית ומועד פירעון',
      value: null,
      ownerGain: null,
      developerCost: null,
      developerMargin: null,
      plausibility: 'unknown',
      why: 'בלי המימון הזה אין מסלול שמתאים לכם בתנאים האלה',
    });
  return { routeId: route.id, items: list.map((x) => ({ ...x, basis: 'modelled' as const })), note: NOTE };
}
