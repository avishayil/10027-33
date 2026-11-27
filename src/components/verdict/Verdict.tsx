import type { ConditionCode, DecisionResult, Goal, StrategyResult, TaxArrangement } from '../../domain/types';
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
import { formatCompactCurrency, formatCurrency, formatNumber } from '../../utils/format';

const pctHalf = (x: number) => `${formatNumber(Math.round(x * 200) / 2, 1)}%`;
import { KNOB_LABELS, thresholdBound } from '../comparisons/thresholds';
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

const ROOMS_LABEL = (rooms: number[]) => rooms.map((r) => `${r} חד׳`).join(' + ');

/** Betterment levy — always visible: total proxy, who pays it, when, and how it was estimated. */
export function LevyCard({ result, r }: { result: DecisionResult; r: StrategyResult | null }) {
  const info = result.rights;
  const total = r?.levy.total ?? info.bettermentLevy;
  const range = result.levyRangeAcrossLots;
  return (
    <div className="levy-card">
      <h3>
        היטל השבחה משוער{' '}
        <Tooltip content="אומדן לפי הפרשי השווי בטבלאות האיזון (50% מהעלייה), לא שומת היטל רשמית של הוועדה המקומית. הסכום בפועל עשוי להיות שונה. החבות החוקית היא של הבעלים גם אם היזם מתחייב לשלם." />
      </h3>
      <p className="levy-total">
        {formatCurrency(total)}
        {result.lotAssumed && range.max - range.min > 1 && (
          <span className="muted"> (בין {formatCurrency(range.min)} ל-{formatCurrency(range.max)} לפי המגרש — לא הוזן מגרש, חושב לפי 149)</span>
        )}
      </p>
      {r && (
        <dl className="levy-split">
          <div>
            <dt>אתם משלמים</dt>
            <dd>
              {formatCurrency(r.levy.owner)}
              {r.levy.ownerMonth !== null && <span className="muted"> · {r.levy.ownerMonth === 0 ? 'בחתימה' : `חודש ${r.levy.ownerMonth}`}</span>}
            </dd>
          </div>
          <div>
            <dt>היזם משלם (לפי החוזה)</dt>
            <dd>{formatCurrency(r.levy.developer)}</dd>
          </div>
          {r.levy.buyer > 0 && (
            <div>
              <dt>עובר לקונה (מכירה לפני אישור)</dt>
              <dd>{formatCurrency(r.levy.buyer)}</dd>
            </div>
          )}
          {r.levy.deferred > 0 && (
            <div>
              <dt>יחול במימוש מאוחר</dt>
              <dd>{formatCurrency(r.levy.deferred)}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="field-hint">
        חישוב: (שווי הזכויות בטבלה {formatCurrency(info.table.allocationValue)} − שווי במצב הנכנס{' '}
        {formatCurrency(info.table.incomingValue)}) × 50%. מקור: טבלאות האיזון 106(ב), 23.11.2026, מגרש {info.lotId}. החלק
        שלכם כלול בכסף מכיסכם.
      </p>
    </div>
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
      <section className="card verdict verdict-empty" aria-labelledby="verdict-title">
        <p className="verdict-kicker">
          {formatRights(result.rights.landAreaSqm)} מ״ר · {formatRights(R)} זכויות
        </p>
        {result.conditionalRecommendation ? (
          <ConditionalDirection result={result} />
        ) : (
          <>
            <h2 id="verdict-title">אין מסלול מבוסס-ראיות שמתאים לנתונים שהזנתם — כרגע</h2>
            <p>
              כל מסלול שאפשר לחשב בלי להמציא מחירים חורג מהיכולת הכלכלית בתנאים שהנחנו. הנה מה שיכול לשנות את
              התמונה:
            </p>
          </>
        )}
        {result.nearMiss.length > 0 && (
          <div className="check-first">
            <h3>{result.conditionalRecommendation ? 'ובלי השגת התנאי — הכי קרוב להתאים' : 'הכי קרוב להתאים'}</h3>
            <ul>
              {result.nearMiss.map((n) => (
                <li key={n.result.id}>
                  <strong>{strategyTitle(n.result)}</strong> —{' '}
                  {n.additionalCapital === null
                    ? 'לא מתאים גם עם הון נוסף סביר'
                    : `חסרים כ-${formatCurrency(Math.ceil(n.additionalCapital / 1000) * 1000)} הון עצמי (או הלוואת מסים, עסקת נטו, או דחיית מס לפי סעיף 91א — בכפוף לאישור, עם ריבית והצמדה)`}
                </li>
              ))}
            </ul>
          </div>
        )}
        <LevyCard result={result} r={result.conditionalRecommendation?.result ?? null} />
        <ArrangementTree result={result} />
        <p className="verdict-note">מכירה ומסלולים שתלויים במחיר שעוד לא ידוע — ראו ״מסלולים שתלויים במחיר״ למטה.</p>
      </section>
    );
  }

  const conditions = rec.requiredConditions.map((c) => CONDITION_TEXT[c]);
  const PRIORITY: ConditionCode[] = ['NET_TAX_TERMS', 'LEVY_TERMS', 'TAX_LOAN', 'SALE_DATE_DEFERRAL', 'SERVICES_CAPACITY', 'MIXED_STRUCTURE', 'COMPLETION_PRICE', 'COMPLETION_CLASSIFICATION', 'CONSTRUCTION_FINANCING', 'LENDER_CONFIRMATION'];
  const checkFirst = PRIORITY.filter((c) => rec.requiredConditions.includes(c)).slice(0, 3);
  const why = explainWhy(rec, goal, result.ranked);
  const debt = rec.mortgageRequired > 1;
  const d = rec.delivery;
  const combRights = rec.plan.rightsInCombination;
  const builds = rec.plan.apartmentsBuilt > 0;
  const ownerTax = rec.capitalGainsTaxReserve;
  const devTax = rec.ledger.filter((e) => e.payer === 'developer' && e.category === 'capital_gains_tax').reduce((s, e) => s + e.amount, 0);
  const devVat = rec.ledger.filter((e) => e.payer === 'developer' && e.category === 'services_vat').reduce((s, e) => s + e.amount, 0);
  const loan = rec.simulation.taxLoanDrawn;

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
            דירות שלמות
            {rec.plan.apartmentRooms.length > 0 && <> ({ROOMS_LABEL(rec.plan.apartmentRooms)})</>}
          </span>
        </div>
        <div className="big-num">
          <strong>{d.apartmentsValue + d.fractionValue > 0 ? formatCompactCurrency(d.apartmentsValue + d.fractionValue) : '—'}</strong>
          <span>שווי הדירות (במחירי היום, תרחיש)</span>
        </div>
        <div className="big-num">
          <strong>{rec.personalCapitalRequired > 1 ? formatCompactCurrency(rec.personalCapitalRequired) : '₪0'}</strong>
          <span>כסף מכיסכם (בשיא)</span>
        </div>
        <div className="big-num">
          <strong>{debt ? formatCompactCurrency(rec.mortgageRequired) : 'ללא'}</strong>
          <span>משכנתא בשיא{debt ? ` · ${formatCurrency(rec.monthlyRepayment)} לחודש` : ''}</span>
        </div>
      </div>

      <LevyCard result={result} r={rec} />

      <dl className="verdict-details">
        {combRights > 0 && (
          <div>
            <dt>
              דירות מהקומבינציה ({formatRights(combRights)} זכויות × {formatRights(combinationPct * 100)}%)
            </dt>
            <dd>{formatRights(combRights * combinationPct)}</dd>
          </div>
        )}
        <div>
          <dt>מס שבח — עליכם / על היזם</dt>
          <dd>
            {formatCurrency(ownerTax)} / {formatCurrency(devTax)}
          </dd>
        </div>
        {combRights > 0 && (
          <div>
            <dt>מע״מ על שירותי הבנייה — עליכם / על היזם</dt>
            <dd>
              {formatCurrency(rec.servicesVat)} / {formatCurrency(devVat)}
            </dd>
          </div>
        )}
        {loan > 1 && (
          <div>
            <dt>הלוואת מסים (נפרעת במסירה) · ריבית עד המסירה</dt>
            <dd>
              {formatCurrency(loan)} · {formatCurrency(rec.simulation.taxLoanInterest)}
            </dd>
          </div>
        )}
        {rec.purchaseTax > 0 && (
          <div>
            <dt>מס רכישה (עליכם)</dt>
            <dd>{formatCurrency(rec.purchaseTax)}</dd>
          </div>
        )}
        {d.constructionAndCompletionPaid > 0 && (
          <div>
            <dt>{builds ? 'תשלומי בנייה והשלמה' : 'תשלום השלמה ליזם'}</dt>
            <dd>{formatCurrency(d.constructionAndCompletionPaid)}</dd>
          </div>
        )}
        {builds && (
          <div>
            <dt>הצעת מחיר לבנייה לדירה (לפני הצמדה)</dt>
            <dd>{formatCurrency(constructionQuotePerApartment(PROJECT_CONFIG, developerMarkup))}</dd>
          </div>
        )}
        <div>
          <dt>כסף בחתימה</dt>
          <dd>{formatCurrency(rec.cashAtSigning)}</dd>
        </div>
        <div>
          <dt>
            מצב נטו במסירה (במחירי היום){' '}
            <Tooltip content="שווי הדירות שתקבלו (לפי תרחיש מחיר מבוסס עסקאות השוואה) + כסף שתקבלו − כל מה שתשלמו (מסים, היטל, בנייה, השלמה) − ריבית עד המסירה. בלי עליית מחירים ובלי תשואה. לא כסף ביד." />
          </dt>
          <dd>{formatCurrency(d.netPosition)}</dd>
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
      {result.fallback && (
        <div className="fallback">
          <h3>ואם התנאים לא יתקיימו?</h3>
          <p>
            <strong>{strategyTitle(result.fallback)}</strong>
            {result.fallbackTerms && <> — בעסקת ברוטו, בכ-{pctHalf(result.fallbackTerms.combinationPct)}</>} —{' '}
            {STRATEGY_DESCRIPTIONS[result.fallback.strategyType]}
          </p>
          {result.fallbackThreshold && (
            <p className="field-hint">
              משתלם רק אם {KNOB_LABELS[result.fallbackThreshold.knob]} יהיה {thresholdBound(result.fallbackThreshold)} — המחיר בפועל
              עוד לא ידוע.
            </p>
          )}
        </div>
      )}
      <ArrangementTree result={result} />
      <p className="verdict-note">
        זהו כיוון לבדיקה, לא אישור שהעסקה אפשרית עבור משק הבית שלכם. אינו שומה, ייעוץ משפטי, מס או אישור בנק. מחירי
        הדירות הם תרחיש המבוסס על עסקאות השוואה בשמאות הפרויקט — לא מלאי או מחיר מאושר.
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
                <dt>מצב נטו במסירה (מחירי היום)</dt>
                <dd>{formatCurrency(r.delivery.netPosition)}</dd>
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
  gross: 'עסקת ברוטו — אתם משלמים את ההיטל, את מס השבח ואת המע״מ',
  mixed: 'עסקה מעורבת — היזם משלם את ההיטל, אתם את מס השבח והמע״מ',
  net: 'עסקת נטו — היזם משלם את ההיטל, את מס השבח ואת המע״מ',
};
const ARRANGEMENT_NAME: Record<TaxArrangement, string> = { gross: 'עסקת ברוטו', mixed: 'עסקה מעורבת', net: 'עסקת נטו' };

/**
 * "If the developer pays the taxes choose X, otherwise Y" — the decision under each tax arrangement, each at the %
 * a developer would offer for it (same developer profit), with the % at which it is still worth it for you.
 */
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
            <span className="muted">
              {ARRANGEMENT_LABELS[a.arrangement]}
              {a.combinationPct !== null && <> · בכ-{pctHalf(a.combinationPct)}</>}:
            </span>{' '}
            <strong>{a.combinationPct === null ? 'אין אחוז שקול בטווח' : title(a.recommendationId)}</strong>
            {a.recommendationId && (
              <span className="muted">
                {' '}
                · {a.wholeApartments} דירות · בחתימה {formatCurrency(a.cashAtSigning)}
                {a.mortgageRequired > 1 ? ` · חוב בשיא ${formatCurrency(a.mortgageRequired)}` : ''}
              </span>
            )}
          </li>
        ))}
      </ul>
      <BreakEvens result={result} />
      <p className="field-hint">
        יזם שלוקח על עצמו מסים מגלם אותם בתמורה: לכן כל הסדר מחושב באחוז שמשאיר ליזם אותו רווח, ולא באותו אחוז. ההמלצה
        הראשית לפי ההצעה שהזנתם. בפועל זה נקבע בחוזה — אף הסדר אינו ״ברירת המחדל של השוק״. הלוואה לתשלום המסים אינה
        תשלום שלהם: הקרן והריבית עליכם.
      </p>
    </div>
  );
}

/** "A net offer is worth it for you only from X%; a developer is expected to offer about Y%." */
function BreakEvens({ result }: { result: DecisionResult }) {
  const lines = result.arrangements.filter(
    (a) => a.combinationPct !== null && a.ownerBreakEvenPct !== null && Math.abs(a.combinationPct - a.ownerBreakEvenPct) > 1e-9,
  );
  if (!lines.length) return null;
  return (
    <ul className="field-hint">
      {lines.map((a) => (
        <li key={a.arrangement}>
          {ARRANGEMENT_NAME[a.arrangement]} משתלמת לכם רק מ-{pctHalf(a.ownerBreakEvenPct!)} ומעלה; יזם צפוי להציע בה כ-
          {pctHalf(a.combinationPct!)}
          {a.combinationPct! >= a.ownerBreakEvenPct! ? ' — בערך שווה או טוב יותר לכם.' : ' — פחות טוב לכם מההצעה שהזנתם.'}
        </li>
      ))}
    </ul>
  );
}

const CONDITION_FOR: Record<TaxArrangement, string> = {
  gross: '',
  mixed: 'שהיזם נושא בהיטל ההשבחה (עסקה מעורבת)',
  net: 'שהיזם נושא בכל המסים — היטל, מס שבח ומע״מ (עסקת נטו)',
};

/** Nothing fits under the headline terms, but a route fits under other contract terms — say so plainly. */
function ConditionalDirection({ result }: { result: DecisionResult }) {
  const c = result.conditionalRecommendation!;
  const r = c.result;
  const debt = r.mortgageRequired > 1;
  return (
    <>
      <h2 id="verdict-title">
        {strategyTitle(r)} — בתנאי {CONDITION_FOR[c.arrangement]}
      </h2>
      <p className="verdict-desc">
        בתנאי ההצעה שהזנתם אין לכם מספיק כסף פנוי לשלם את המסים במועד. אם היזם ייקח אותם על עצמו בחוזה — המסלול הזה
        מתאים ליכולת שלכם. אבל יזם שמשלם מסים מגלם אותם בתמורה: חישבנו לפי אחוז קומבינציה של כ-{pctHalf(c.combinationPct)}{' '}
        בלבד. זה הדבר הראשון לבדוק מול היזם. חלופות: הלוואת מסים מהיזם או מהבנק המלווה, או בקשת דחיית תשלום המס לפי סעיף
        91א — בכפוף לאישור, עם ריבית והצמדה.
      </p>
      <p className="verdict-desc">{STRATEGY_DESCRIPTIONS[r.strategyType]}</p>
      <div className="verdict-numbers">
        <div className="big-num">
          <strong>{r.metrics.wholeApartments}</strong>
          <span>דירות שלמות{r.plan.apartmentRooms.length > 0 && <> ({ROOMS_LABEL(r.plan.apartmentRooms)})</>}</span>
        </div>
        <div className="big-num">
          <strong>{r.personalCapitalRequired > 1 ? formatCompactCurrency(r.personalCapitalRequired) : '₪0'}</strong>
          <span>כסף מכיסכם</span>
        </div>
        <div className="big-num">
          <strong>{debt ? formatCompactCurrency(r.mortgageRequired) : 'ללא'}</strong>
          <span>משכנתא{debt ? ` · ${formatCurrency(r.monthlyRepayment)} לחודש` : ''}</span>
        </div>
      </div>
    </>
  );
}
