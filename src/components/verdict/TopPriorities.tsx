/**
 * The default (simple) result: three ranked routes — first, second and third priority — with only the numbers a
 * household needs to decide whether to look further. Everything else lives in advanced mode.
 */
import type { DecisionResult, StrategyResult, TaxArrangement } from '../../domain/types';
import { formatRights, STRATEGY_DESCRIPTIONS, strategyTitle } from '../../optimizer/explain';
import { formatCompactCurrency, formatCurrency } from '../../utils/format';
import { AssessmentChips } from './Verdict';

interface Priority {
  r: StrategyResult;
  /** A short line shown under the title when the route depends on something (a contract term, more capital). */
  note?: string;
}

const CONDITION_FOR: Record<TaxArrangement, string> = {
  gross: '',
  mixed: 'בתנאי שהיזם נושא בהיטל ההשבחה',
  net: 'בתנאי שהיזם נושא במס השבח ובהיטל ההשבחה (עסקת נטו)',
};

/** Recommendation first, then the engine's alternatives, fallback and near-misses — distinct routes, at most 3. */
export function topPriorities(result: DecisionResult): Priority[] {
  const out: Priority[] = [];
  const seen = new Set<string>();
  const add = (r: StrategyResult | null | undefined, note?: string) => {
    if (!r || seen.has(r.strategyType) || out.length >= 3) return;
    seen.add(r.strategyType);
    out.push({ r, note });
  };
  if (result.recommendation) add(result.recommendation);
  else if (result.conditionalRecommendation) {
    const c = result.conditionalRecommendation;
    add(c.result, CONDITION_FOR[c.arrangement] || undefined);
  }
  for (const r of result.alternatives) add(r);
  add(result.fallback, 'אם התנאים של העדיפות הראשונה לא יתקיימו');
  for (const n of result.nearMiss)
    add(
      n.result,
      n.additionalCapital === null
        ? 'לא מתאים ליכולת שהזנתם'
        : `חסרים כ-${formatCurrency(Math.ceil(n.additionalCapital / 1000) * 1000)} הון עצמי`,
    );
  for (const r of result.ranked) add(r);
  return out;
}

const RANK_LABELS = ['עדיפות ראשונה', 'עדיפות שנייה', 'עדיפות שלישית'];

export function TopPriorities({ result }: { result: DecisionResult }) {
  const items = topPriorities(result);
  const R = result.rights.apartmentEquivalents;
  return (
    <section className="priorities" aria-live="polite" aria-labelledby="priorities-title">
      <h2 id="priorities-title" className="section-title">
        המסלולים המתאימים לכם · {formatRights(result.rights.landAreaSqm)} מ״ר · {formatRights(R)} זכויות
      </h2>
      {items.length === 0 && (
        <p className="card">אין מסלול שאפשר לחשב עם הנתונים שהזנתם. נסו לשנות את התשובות, או פתחו את התצוגה המתקדמת.</p>
      )}
      <ol className="priority-list">
        {items.map(({ r, note }, i) => {
          const debt = r.mortgageRequired > 1;
          return (
            <li key={r.id} className={`card priority-card ${i === 0 ? 'priority-first' : ''}`}>
              <p className="priority-rank">{RANK_LABELS[i]}</p>
              <h3>{strategyTitle(r)}</h3>
              {note && <p className="priority-note">{note}</p>}
              <p className="priority-desc">{STRATEGY_DESCRIPTIONS[r.strategyType]}</p>
              <AssessmentChips r={r} compact />
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
        כיוון לבדיקה, לא אישור. המספרים הם אומדן — הפירוט המלא, המסים והתנאים בתצוגה המתקדמת.
      </p>
    </section>
  );
}
