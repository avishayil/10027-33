/**
 * The default (simple) result: one route per deal family — combination, revenue share, cash, construction
 * services — ranked, with only the numbers a household needs to decide whether to look further. No route here
 * assumes a requested apartment size. Everything else lives in advanced mode.
 */
import type { DecisionResult, Goal, TaxArrangement } from '../../domain/types';
import { FAMILY_LABELS, priorityRoutes, type PriorityRoute } from '../../optimizer/families';
import {
  AFFORDABILITY_LABELS,
  formatRights,
  plainExplanation,
  RISK_LABELS,
  riskLevel,
  strategyTitle,
} from '../../optimizer/explain';
import { formatCompactCurrency, formatCurrency } from '../../utils/format';
import { formatKnob, KNOB_LABELS } from '../comparisons/DetailSections';

const CONDITION_FOR: Record<TaxArrangement, string> = {
  gross: '',
  mixed: 'בתנאי שהיזם נושא בהיטל ההשבחה',
  net: 'בתנאי שהיזם נושא במס השבח ובהיטל ההשבחה (עסקת נטו)',
};

const AFF_CLASS = { fits: 'estimated_feasible', fits_with_financing: 'conditional', does_not_fit: 'infeasible', unknown: 'unknown' } as const;
const RISK_CLASS = { low: 'estimated_feasible', medium: 'fragile', high: 'infeasible' } as const;

/** Why money leaves your pocket, in one line — usually the capital gains tax, sometimes building or completion. */
function pocketNote(r: DecisionResult['results'][number]): string | null {
  if (r.personalCapitalRequired <= 1) return null;
  const parts: string[] = [];
  if (r.capitalGainsTaxReserve > 1) parts.push(`מס שבח כ-${formatCompactCurrency(r.capitalGainsTaxReserve)}`);
  if (r.delivery.constructionAndCompletionPaid > 1) parts.push(`תשלומים ליזם על בנייה/השלמה כ-${formatCompactCurrency(r.delivery.constructionAndCompletionPaid)}`);
  if (r.purchaseTax > 1) parts.push(`מס רכישה כ-${formatCompactCurrency(r.purchaseTax)}`);
  return parts.length ? `מה משלמים: ${parts.join(' · ')}` : null;
}

const RANK_LABELS = ['עדיפות ראשונה', 'עדיפות שנייה', 'עדיפות שלישית', 'עדיפות רביעית'];

function noteFor(p: PriorityRoute): string | null {
  switch (p.kind) {
    case 'fits':
      return p.condition ? CONDITION_FOR[p.condition] || null : null;
    case 'price': {
      const t = p.threshold;
      if (t.required !== null && t.required <= 0) return t.against ? 'משתלם בכל מחיר סביר' : 'תלוי במחיר שעוד לא ידוע';
      if (t.required === null) return `תלוי במחיר שעוד לא ידוע — ובהנחות שלנו לא נמצא ${KNOB_LABELS[t.knob]} סביר שבו זה משתלם לכם`;
      return `תלוי במחיר שעוד לא ידוע — משתלם רק אם ${KNOB_LABELS[t.knob]} יהיה לפחות ${formatKnob(t.knob, t.required)}`;
    }
    case 'short':
      return p.additionalCapital === null
        ? 'לא מתאים ליכולת שהזנתם'
        : `חסרים כ-${formatCurrency(Math.ceil(p.additionalCapital / 1000) * 1000)} הון עצמי`;
    case 'none':
      if (p.r.reasonCodes.includes('DEVELOPER_POLICY_WHOLE_FROM_COMBINATION'))
        return 'היזם צפוי לא להציע: הקומבינציה כבר נותנת לכם דירה שלמה, ולכן יציע קומבינציה מלאה. אפשרי רק במשא ומתן.';
      if (p.r.reasonCodes.includes('DEVELOPER_POLICY_PER_OWNER_CAP'))
        return 'היזם צפוי להגביל שירותי בנייה לדירה אחת לכל בעלים. אפשרי רק במשא ומתן.';
      return p.r.assessment.commercial === 'negotiable' ? 'היזם צפוי לא להציע — אפשרי רק במשא ומתן.' : 'לא מתאים ליכולת שהזנתם';
  }
}

export function TopPriorities({ result, goal, combinationPct }: { result: DecisionResult; goal: Goal; combinationPct: number }) {
  const items = priorityRoutes(result, goal);
  const R = result.rights.apartmentEquivalents;
  return (
    <section className="priorities" aria-live="polite" aria-labelledby="priorities-title">
      <h2 id="priorities-title" className="section-title">
        סוגי העסקאות לפי סדר התאמה · {formatRights(result.rights.landAreaSqm)} מ״ר · {formatRights(R)} זכויות
      </h2>
      {items.length === 0 && (
        <p className="card">אין מסלול שאפשר לחשב עם הנתונים שהזנתם. נסו לשנות את התשובות, או פתחו את התצוגה המתקדמת.</p>
      )}
      <ol className="priority-list">
        {items.map((p, i) => {
          const r = p.r;
          const debt = r.mortgageRequired > 1;
          const note = noteFor(p);
          const risk = riskLevel(r);
          return (
            <li key={p.family} className={`card priority-card ${i === 0 && p.kind === 'fits' ? 'priority-first' : ''}`}>
              <p className="priority-rank">
                {RANK_LABELS[i]} · {FAMILY_LABELS[p.family]}
              </p>
              <h3>{strategyTitle(r)}</h3>
              {note && <p className="priority-note">{note}</p>}
              <p className="priority-desc">{plainExplanation(r, R, combinationPct)}</p>
              <div className="chips chips-compact">
                <span className="chip">
                  <span className={`status status-${AFF_CLASS[r.assessment.affordability]}`} title="יכולת כלכלית">
                    {AFFORDABILITY_LABELS[r.assessment.affordability]}
                  </span>
                </span>
                <span className="chip">
                  <span className={`status status-${RISK_CLASS[risk.level]}`} title={risk.reasons.join(' · ') || 'בלי משכנתא, עומד בתרחיש שמרני'}>
                    {RISK_LABELS[risk.level]}
                  </span>
                </span>
              </div>
              {risk.reasons.length > 0 && <p className="priority-risk">{risk.reasons.join(' · ')}</p>}
              {pocketNote(r) && <p className="priority-risk">{pocketNote(r)}</p>}
              <dl className="priority-numbers">
                <div>
                  <dt>דירות שלמות</dt>
                  <dd>{r.metrics.wholeApartments}</dd>
                </div>
                <div>
                  <dt>כסף מכיסכם</dt>
                  <dd>{r.personalCapitalRequired > 1 ? formatCompactCurrency(r.personalCapitalRequired) : '₪0'}</dd>
                </div>
                <div>
                  <dt>משכנתא</dt>
                  <dd>
                    {debt ? formatCompactCurrency(r.mortgageRequired) : 'ללא'}
                    {debt && <span className="sub">{formatCurrency(r.monthlyRepayment)} לחודש</span>}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ol>
      <p className="verdict-note">
        עסקה אחת מכל סוג, בלי הנחה על גודל דירה מבוקש. כיוון לבדיקה, לא אישור — הפירוט המלא, המסים והתנאים בתצוגה
        המתקדמת.
      </p>
    </section>
  );
}
