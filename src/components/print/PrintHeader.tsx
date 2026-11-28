import { CONFIG_VERSION } from '../../data/config';
import type { AnalysisSnapshot } from '../../hooks/useDecisionEngine';
import { GOAL_LABELS } from '../../optimizer/explain';
import { formatCurrency, formatNumber } from '../../utils/format';

const ARR: Record<string, string> = { gross: 'ברוטו (אתם משלמים מס שבח והיטל)', mixed: 'מעורבת (היזם משלם היטל)', net: 'נטו (היזם משלם את המסים)' };

/**
 * Shown only when printing: the exact calculation snapshot behind the printed summary (V1 / MH-08, MH-10) — its id,
 * when it ran, the data and build versions, and the inputs and terms it used. While a newer calculation is running the
 * printout says so instead of mixing old results with new inputs.
 */
export function PrintHeader({ analysis, updating, build }: { analysis: AnalysisSnapshot; updating: boolean; build: string }) {
  const { profile, terms, config } = analysis;
  const fmt = (v: number | null, zero: string) => (v === null ? 'לא הוזן' : v === 0 ? zero : formatCurrency(v));
  const offer = config.commercial.offer;
  const when = new Date(analysis.computedAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <section className="print-only print-header">
      <h2>סיכום לפגישה — מתחם 13 – סימולציית עסקאות, חדרה</h2>
      {updating && <p className="print-warning">החישוב התעדכן מאז — הדפיסו שוב אחרי שהחישוב יסתיים.</p>}
      <p>
        קרקע: {formatNumber(profile.landAreaSqm, 2)} מ״ר{profile.lotId ? ` (מגרש ${profile.lotId})` : ''} · הון פנוי: {fmt(profile.availableCapital, '0')} · החזר
        חודשי: {fmt(profile.maxMonthlyRepayment, 'ללא משכנתא')} · מטרה: {GOAL_LABELS[profile.goal]} · קומבינציה{' '}
        {formatNumber(terms.combinationPct * 100, 1)}% · רווח יזמי {formatNumber(terms.developerMarkup * 100, 1)}% · עסקה{' '}
        {ARR[config.commercial.taxArrangement]}
        {offer.levyCap !== null ? ` · תקרת היטל ${formatCurrency(offer.levyCap)}` : ''}
        {offer.developerPaysTaxLoanInterest ? ' · היזם נושא בריבית הלוואת המסים' : ''}
      </p>
      <p>
        חישוב {analysis.id} · {when} · גרסת נתונים {CONFIG_VERSION} · מחירי היום נכון ל-{config.analysis.valuationDate} · build {build}
      </p>
      <p>אומדן בלבד — לבדיקה מול יזם, שמאי, עורך דין ויועץ משכנתאות. טרם נבדק מקצועית.</p>
    </section>
  );
}
