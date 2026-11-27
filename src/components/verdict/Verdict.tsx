import type { ConditionCode, DecisionResult, Goal, StrategyResult, TaxArrangement } from '../../domain/types';
import { apartmentValueToday } from '../../domain/valuation';
import { constructionQuotePerApartment } from '../../domain/construction';
import { PROJECT_CONFIG } from '../../data/config';
import {
  AFFORDABILITY_LABELS,
  COMMERCIAL_LABELS,
  RESILIENCE_LABELS,
  CONDITION_TEXT,
  FEASIBILITY_HINTS,
  FEASIBILITY_LABELS,
  REASON_TEXT,
  STRATEGY_DESCRIPTIONS,
  explainWhy,
  formatRights,
  strategyTitle,
} from '../../optimizer/explain';
import { formatCompactCurrency, formatCurrency } from '../../utils/format';
import { Tooltip } from '../Tooltip';

const AFF_CLASS = { fits: 'estimated_feasible', fits_with_financing: 'conditional', does_not_fit: 'infeasible', unknown: 'unknown' } as const;
const RES_CLASS = { robust: 'estimated_feasible', fragile: 'fragile' } as const;
const COM_CLASS = { not_required: 'estimated_feasible', unverified: 'unknown', questionable: 'fragile', negotiable: 'infeasible' } as const;

/** Three independent answers: can I fund it, does it survive bad scenarios, is the deal confirmed/plausible. */
export function AssessmentChips({ r, compact = false }: { r: StrategyResult; compact?: boolean }) {
  const a = r.assessment;
  const items = [
    { title: 'יכולת כלכלית', value: AFFORDABILITY_LABELS[a.affordability], cls: AFF_CLASS[a.affordability] },
    { title: 'עמידות לשינויים', value: RESILIENCE_LABELS[a.resilience], cls: RES_CLASS[a.resilience] },
    { title: 'היתכנות מול היזם', value: COMMERCIAL_LABELS[a.commercial], cls: COM_CLASS[a.commercial] },
  ];
  return (
    <div className={compact ? 'chips chips-compact' : 'chips'}>
      {items.map((i) => (
        <span key={i.title} className="chip">
          {!compact && <span className="chip-title">{i.title}</span>}
          <span className={`status status-${i.cls}`} title={i.title}>
            {i.value}
          </span>
        </span>
      ))}
    </div>
  );
}

export function StatusBadge({ r }: { r: StrategyResult }) {
  return (
    <span className={`status status-${r.feasibility}`} title={FEASIBILITY_HINTS[r.feasibility]}>
      {FEASIBILITY_LABELS[r.feasibility]}
    </span>
  );
}


interface Props {
  result: DecisionResult;
  goal: Goal;
  combinationPct: number;
  developerMarkup: number;
}

export function Verdict({ result, goal, combinationPct, developerMarkup }: Props) {
  const rec = result.recommendation;
  const R = result.rights.apartmentEquivalents;

  if (!rec) {
    return (
      <section className="card verdict verdict-empty">
        <p className="verdict-kicker">אין עדיין המלצה</p>
        <h2>לא נמצא מסלול שמתאים לנתונים שהזנתם</h2>
        <p>
          כל המסלולים חורגים מהיכולת הכלכלית או שחסר מידע כדי להעריך אותם. בדקו את השאלות למטה ואת ״מה לבקש
          מהיזם״ — שם מחושב מה צריך להשתנות כדי שמסלול יתאים.
        </p>
      </section>
    );
  }

  const conditions = rec.requiredConditions.map((c) => CONDITION_TEXT[c]);
  // Check first: tax terms and developer-dependent conditions decide whether the direction holds at all.
  const PRIORITY: ConditionCode[] = ['NET_TAX_TERMS', 'LEVY_TERMS', 'SALE_DATE_DEFERRAL', 'SERVICES_CAPACITY', 'MIXED_STRUCTURE', 'COMPLETION_PRICE', 'COMPLETION_CLASSIFICATION', 'DEVELOPER_PRICE_UNVERIFIED', 'CONSTRUCTION_FINANCING', 'LENDER_CONFIRMATION'];
  const checkFirst = PRIORITY.filter((c) => rec.requiredConditions.includes(c)).slice(0, 3);
  const sizes = rec.plan.apartmentSizes;
  const fallback = result.fallback;
  const why = explainWhy(rec, goal, result.ranked);
  const kept = Math.max(0, R - rec.rightsSold);
  const usesCombination = rec.candidate.legs.some((l) => l.kind === 'combination');
  const builds = rec.plan.apartmentsBuilt > 0;
  const debt = rec.mortgageRequired > 1;

  return (
    <section className="card verdict" aria-live="polite" aria-labelledby="verdict-title">
      <p className="verdict-kicker">
        המסלול המומלץ לבדיקה · {formatRights(result.rights.landAreaSqm)} מ״ר · {formatRights(R)} זכויות
      </p>
      <h2 id="verdict-title">{strategyTitle(rec)}</h2>
      <p className="verdict-desc">{STRATEGY_DESCRIPTIONS[rec.strategyType]}</p>
      <AssessmentChips r={rec} />

      {checkFirst.length > 0 && (
        <div className="check-first">
          <h3>מה כדאי לבדוק קודם</h3>
          <ol>
            {checkFirst.map((c) => (
              <li key={c}>{CONDITION_TEXT[c]}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="verdict-numbers verdict-numbers-4">
        <div className="big-num">
          <strong>{rec.metrics.wholeApartments}</strong>
          <span>
            דירות שלמות בסוף
            {sizes.length > 0 && <> ({sizes.map((x) => `${x} מ״ר`).join(', ')})</>}
          </span>
        </div>
        <div className="big-num">
          <strong>{rec.personalCapitalRequired > 1 ? formatCompactCurrency(rec.personalCapitalRequired) : '₪0'}</strong>
          <span>כסף מכיסכם (בשיא)</span>
        </div>
        <div className="big-num">
          <strong>{debt ? formatCompactCurrency(rec.mortgageRequired) : 'ללא'}</strong>
          <span>משכנתא בשיא</span>
        </div>
        <div className="big-num">
          <strong>{debt ? formatCompactCurrency(rec.monthlyRepayment) : '—'}</strong>
          <span>החזר חודשי</span>
        </div>
      </div>

      <dl className="verdict-details">
        <div>
          <dt>זכויות שנשארות אצלכם</dt>
          <dd>{formatRights(kept)}</dd>
        </div>
        <div>
          <dt>זכויות שעוברות ליזם או נמכרות</dt>
          <dd>{formatRights(rec.rightsSold)}</dd>
        </div>
        <div>
          <dt>מתוכו בחתימה</dt>
          <dd>{formatCurrency(rec.cashAtSigning)}</dd>
        </div>
        <div>
          <dt>שינוי בכסף הפנוי עד המסירה (אחרי מסים ותשלומים)</dt>
          <dd>{formatCurrency(rec.netCashAtDelivery)}</dd>
        </div>
        {usesCombination && (
          <div>
            <dt>דירות מהקומבינציה ({formatRights(combinationPct * 100)}%)</dt>
            <dd>{formatRights(R * combinationPct)}</dd>
          </div>
        )}
        {builds && (
          <div>
            <dt>עלות שירותי בנייה לדירה (לפני הצמדה)</dt>
            <dd>{formatCurrency(constructionQuotePerApartment(PROJECT_CONFIG, developerMarkup))}</dd>
          </div>
        )}
        <div>
          <dt>שווי דירה חדשה היום</dt>
          <dd>{formatCurrency(apartmentValueToday(PROJECT_CONFIG))}</dd>
        </div>
        <div>
          <dt>
            שווי מימוש נטו בעוד 10 שנים{' '}
            <Tooltip content="מה שווה מה שתחזיקו בזכות הקרקע בעוד 10 שנים: דירות (לפי שווי שוק, לפני מכירה), כסף וקרקע — פחות חובות, החזרי משכנתא ומסים, ומעבר למה שהכסף הפנוי שלכם היה צובר ממילא. הנחות: 2% עליית ערך ו-4% תשואה — תרחיש, לא תחזית." />
          </dt>
          <dd>{formatCurrency(rec.metrics.valueCreated)}</dd>
        </div>
        <div>
          <dt>
            לעומת מכירת הקרקע היום{' '}
            <Tooltip content="ההפרש מול מכירה מיידית בשוק הפתוח במחיר הייחוס של עסקאות העבר בחלקה (לא שומה עדכנית)." />
          </dt>
          <dd>{formatCurrency(rec.gainVsSellingToday)}</dd>
        </div>
      </dl>

      <div className="verdict-cols">
        <div>
          <h3>למה כדאי לבדוק את המסלול?</h3>
          <ul>
            {why.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>מה צריך לברר?</h3>
          {conditions.length ? (
            <ul>
              {conditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p>אין תלות בתנאים חיצוניים לפי האומדן — עדיין מומלץ לאמת מול אנשי מקצוע.</p>
          )}
        </div>
      </div>
      {fallback && (
        <div className="fallback">
          <h3>ואם התנאים לא יתקיימו?</h3>
          <p>
            <strong>{strategyTitle(fallback)}</strong> — {STRATEGY_DESCRIPTIONS[fallback.strategyType]}
          </p>
        </div>
      )}
      <ArrangementTree result={result} />
      <p className="verdict-note">
        זהו כיוון לבדיקה, לא אישור שהעסקה אפשרית עבור משק הבית שלכם. אינו שומה, ייעוץ משפטי, מס או אישור בנק.
      </p>
    </section>
  );
}

export function Alternatives({ result }: { result: DecisionResult }) {
  if (!result.alternatives.length) return null;
  return (
    <section className="alternatives">
      <h2 className="section-title">חלופות שכדאי להכיר</h2>
      <div className="alt-grid">
        {result.alternatives.map((r) => (
          <article key={r.id} className="card alt-card">
            <h3>{strategyTitle(r)}</h3>
            <AssessmentChips r={r} compact />
            <p>{STRATEGY_DESCRIPTIONS[r.strategyType]}</p>
            <dl className="alt-dl">
              <div>
                <dt>דירות שלמות</dt>
                <dd>{r.metrics.wholeApartments}</dd>
              </div>
              <div>
                <dt>משכנתא</dt>
                <dd>{r.mortgageRequired > 1 ? formatCurrency(r.mortgageRequired) : 'ללא'}</dd>
              </div>
              <div>
                <dt>שווי מימוש נטו (10 שנים)</dt>
                <dd>{formatCurrency(r.metrics.valueCreated)}</dd>
              </div>
            </dl>
            {r.reasonCodes.includes('FRACTIONAL_UNIT') && <p className="muted">{REASON_TEXT.FRACTIONAL_UNIT}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

const ARRANGEMENT_LABELS: Record<TaxArrangement, string> = {
  gross: 'עסקת ברוטו — אתם משלמים את ההיטל ואת מס השבח',
  mixed: 'עסקה מעורבת — היזם משלם את ההיטל, אתם את מס השבח',
  net: 'עסקת נטו — היזם משלם את ההיטל ואת מס השבח',
};

/** "If the developer pays the taxes choose X, otherwise Y" — the decision under each tax arrangement. */
export function ArrangementTree({ result }: { result: DecisionResult }) {
  const ids = new Set(result.arrangements.map((a) => a.recommendationId));
  const title = (id: string | null) => {
    const r = id ? result.results.find((x) => x.id === id) : null;
    return r ? strategyTitle(r) : 'אין מסלול מתאים';
  };
  return (
    <div className="arrangements">
      <h3>{ids.size > 1 ? 'ההמלצה תלויה במי שמשלם את המסים' : 'ההמלצה זהה בכל הסדרי המסים'}</h3>
      <ul>
        {result.arrangements.map((a) => (
          <li key={a.arrangement}>
            <span className="muted">{ARRANGEMENT_LABELS[a.arrangement]}:</span> <strong>{title(a.recommendationId)}</strong>
            {a.recommendationId && (
              <span className="muted">
                {' '}
                · {a.wholeApartments} דירות · בחתימה {formatCurrency(a.cashAtSigning)}
                {a.mortgageRequired > 1 ? ` · משכנתא ${formatCurrency(a.mortgageRequired)}` : ''}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="field-hint">
        ההמלצה הראשית מניחה עסקה מעורבת. בפועל זה נקבע בחוזה — אף הסדר אינו ״ברירת המחדל של השוק״.
      </p>
    </div>
  );
}
