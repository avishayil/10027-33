/**
 * Domain-boundary validation (iteration 9 / D4). The UI guards its own fields; this rejects impossible inputs wherever
 * the engine is called from, so a value that slipped through can never produce a confident-looking result.
 */
import { BASE_SHARE_AREA, getLot, PARCEL } from '../data/parcel33';
import type { CommercialTerms, ProjectConfig, UserProfile } from './types';

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
  for (const [x, label] of [
    [terms.combinationPct, 'אחוז הקומבינציה'],
    [terms.developerMarkup, 'הרווח היזמי'],
  ] as const) {
    if (!Number.isFinite(x) || x < 0 || x > 1) errors.push(`${label} חייב להיות בין 0% ל-100%.`);
  }
  return errors;
}
