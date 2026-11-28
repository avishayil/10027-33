/**
 * Domain-boundary validation (iteration 9 / D4). The UI guards its own fields; this rejects impossible inputs wherever
 * the engine is called from, so a value that slipped through can never produce a confident-looking result.
 */
import { BASE_SHARE_AREA, getLot, PARCEL } from '../data/parcel33';
import type { CommercialTerms, Goal, ProjectConfig, UserProfile } from './types';

const GOALS: Goal[] = ['balanced', 'maximize_apartments', 'passive_income', 'immediate_cash', 'minimize_risk'];
/** Bounds that keep the engine's searches finite; far above any real holding. */
export const MAX_AMOUNT = 10_000_000_000;
export const MAX_MONTHLY = 10_000_000;

/** The first number in the configuration that is not finite (path), or null. */
export function nonFinitePath(x: unknown, path = 'config'): string | null {
  if (typeof x === 'number') return Number.isFinite(x) ? null : path;
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i += 1) {
      const p = nonFinitePath(x[i], `${path}[${i}]`);
      if (p) return p;
    }
    return null;
  }
  if (x && typeof x === 'object')
    for (const [k, v] of Object.entries(x)) {
      const p = nonFinitePath(v, `${path}.${k}`);
      if (p) return p;
    }
  return null;
}

const finiteNonNegative = (x: number | null | undefined) => x === null || x === undefined || (Number.isFinite(x) && x >= 0);

/** Largest holding (original m²) whose share fits inside one lot (100% of it). */
export function maxAreaInLot(config: ProjectConfig, lotId: string): number {
  return BASE_SHARE_AREA / getLot(config.rights.tableVersion, lotId).sharePer167;
}

/** Problems with the inputs, in plain Hebrew; empty when they are valid. */
export function validateInputs(profile: UserProfile, terms: CommercialTerms, config: ProjectConfig): string[] {
  const errors: string[] = [];
  const a = profile.landAreaSqm;
  if (!Number.isFinite(a) || a <= 0) errors.push('שטח הקרקע חייב להיות מספר חיובי.');
  else if (a > PARCEL.area) errors.push(`השטח גדול מכל החלקה (${PARCEL.area.toLocaleString('he-IL')} מ״ר).`);
  else {
    const lotId = profile.lotId || config.rights.defaultLotId;
    if (config.rights.lotIds.includes(lotId) && a > maxAreaInLot(config, lotId) + 1e-6) {
      errors.push('השטח גדול מכל המגרש שהוקצה. אחזקות בכמה מגרשים עוד לא נתמכות — הזינו את החלק שבמגרש אחד.');
    }
  }
  if (profile.lotId && !config.rights.lotIds.includes(profile.lotId)) errors.push(`מגרש לא מוכר: ${profile.lotId}`);
  if (!finiteNonNegative(profile.availableCapital)) errors.push('הכסף הפנוי חייב להיות מספר לא שלילי.');
  if (!finiteNonNegative(profile.maxMonthlyRepayment)) errors.push('ההחזר החודשי חייב להיות מספר לא שלילי.');
  if (!finiteNonNegative(profile.acquisitionBasis)) errors.push('עלות הרכישה חייבת להיות מספר לא שלילי.');
  // Iteration 10 / E2: optional inputs, the goal, the offer terms and the configuration itself.
  if (!finiteNonNegative(profile.otherPropertyBorrowingLimit)) errors.push('גבול ההלוואה על הנכס האחר חייב להיות מספר לא שלילי.');
  const deadline = profile.liquidityDeadlineYears;
  if (deadline !== undefined && (!Number.isFinite(deadline) || deadline <= 0 || deadline > config.analysis.horizonYears))
    errors.push(`מועד הצורך בכסף חייב להיות בין 0 ל-${config.analysis.horizonYears} שנים.`);
  if (!GOALS.includes(profile.goal)) errors.push(`מטרה לא מוכרת: ${String(profile.goal)}`);
  for (const [x, label] of [
    [profile.availableCapital, 'הכסף הפנוי'],
    [profile.acquisitionBasis, 'עלות הרכישה'],
    [profile.otherPropertyBorrowingLimit, 'גבול ההלוואה על הנכס האחר'],
  ] as const)
    if (typeof x === 'number' && x > MAX_AMOUNT) errors.push(`${label} גדול מכדי לחשב (${MAX_AMOUNT.toLocaleString('he-IL')} ₪ לכל היותר).`);
  if (typeof profile.maxMonthlyRepayment === 'number' && profile.maxMonthlyRepayment > MAX_MONTHLY)
    errors.push(`ההחזר החודשי גדול מכדי לחשב (${MAX_MONTHLY.toLocaleString('he-IL')} ₪ לכל היותר).`);
  const cap = config.commercial.offer.levyCap;
  if (cap !== null && (!Number.isFinite(cap) || cap < 0)) errors.push('תקרת ההיטל בהצעה חייבת להיות מספר לא שלילי.');
  const broken = nonFinitePath(config);
  if (broken) errors.push(`ערך לא תקין בהגדרות המודל: ${broken}`);
  for (const [x, label] of [
    [terms.combinationPct, 'אחוז הקומבינציה'],
    [terms.developerMarkup, 'הרווח היזמי'],
  ] as const) {
    if (!Number.isFinite(x) || x < 0 || x > 1) errors.push(`${label} חייב להיות בין 0% ל-100%.`);
  }
  return errors;
}
