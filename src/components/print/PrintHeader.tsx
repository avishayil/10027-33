import type { CommercialTerms, UserProfile } from '../../domain/types';
import { CONFIG_VERSION } from '../../data/config';
import { GOAL_LABELS } from '../../optimizer/explain';
import { formatCurrency, formatNumber } from '../../utils/format';

/** Shown only when printing: the inputs behind the summary, for a meeting with a professional. */
export function PrintHeader({ profile, terms }: { profile: UserProfile; terms: CommercialTerms }) {
  const fmt = (v: number | null, zero: string) => (v === null ? 'לא הוזן' : v === 0 ? zero : formatCurrency(v));
  return (
    <section className="print-only print-header">
      <h2>סיכום לפגישה — מתחם 13 – סימולציית עסקאות, חדרה</h2>
      <p>
        קרקע: {formatNumber(profile.landAreaSqm, 2)} מ״ר · הון פנוי: {fmt(profile.availableCapital, '0')} · החזר
        חודשי: {fmt(profile.maxMonthlyRepayment, 'ללא משכנתא')} · מטרה: {GOAL_LABELS[profile.goal]} · קומבינציה{' '}
        {formatNumber(terms.combinationPct * 100, 1)}% · רווח יזמי {formatNumber(terms.developerMarkup * 100, 1)}% ·
        גרסת נתונים {CONFIG_VERSION}
      </p>
      <p>אומדן בלבד — לבדיקה מול יזם, שמאי, עורך דין ויועץ משכנתאות.</p>
    </section>
  );
}
