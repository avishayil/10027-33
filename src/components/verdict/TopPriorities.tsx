/**
 * The default (simple) result: one route per deal family — combination, revenue share, cash, construction
 * services — ranked, with only the numbers a household needs to decide whether to look further. No route here
 * assumes a requested apartment size. Everything else lives in advanced mode.
 */
import type { DecisionResult, Goal, TaxArrangement } from '../../domain/types';
import { FAMILY_LABELS, PAYMENT_METHOD, priorityRoutes, type RouteCondition, type RouteOption } from '../../optimizer/families';
import {
  AFFORDABILITY_LABELS,
  debtLabel,
  formatRights,
  plainExplanation,
  RISK_LABELS,
  riskLevel,
  strategyTitle,
} from '../../optimizer/explain';
import { formatCompactCurrency, formatCurrency, formatNumber } from '../../utils/format';

const formatPct = (x: number) => `${formatNumber(Math.round(x * 200) / 2, 1)}%`;
import { formatRate, KNOB_LABELS, thresholdBound } from '../comparisons/thresholds';

const CONDITION_FOR: Record<TaxArrangement, string> = {
  gross: '',
  mixed: 'בתנאי שהיזם נושא בהיטל ההשבחה',
  net: 'בתנאי שהיזם נושא בכל המסים — היטל, מס שבח ומע״מ (עסקת נטו)',
};

/**
 * The condition a direction depends on: financing to obtain (a tax loan is a loan, not a payment), or other tax terms
 * at the lower % that is equivalent for them under the economic model.
 */
export function conditionText(c: RouteCondition): string | null {
  if (c.kind === 'funding') {
    return c.method === 'other_property'
      ? 'בתנאי שתוכלו ללוות על הנכס האחר שלכם כדי לשלם את המסים — לפי היכולת והשווי שלו.'
      : 'בתנאי שתקבלו הלוואת מסים מהיזם או מהבנק המלווה — הלוואה, לא תשלום: הקרן והריבית עליכם.';
  }
  const base = CONDITION_FOR[c.arrangement];
  if (!base) return null;
  return `${base}. יזם שלוקח על עצמו את המסים מגלם אותם באחוז נמוך יותר — חישבנו לפי כ-${formatPct(c.combinationPct)} (אחוז שקול לפי המודל הכלכלי).`;
}

/** A whole apartment of another size depends on the project's inventory and allocation. */
const SIZE_NOTE = 'לבדיקה מול היזם — תלוי במלאי הדירות ובהקצאה.';

const AFF_CLASS = { fits: 'estimated_feasible', fits_with_financing: 'conditional', does_not_fit: 'infeasible', unknown: 'unknown' } as const;
const RISK_CLASS = { low: 'estimated_feasible', medium: 'fragile', high: 'infeasible' } as const;

/**
 * Why money leaves your pocket (or is borrowed), in one line — usually the capital gains tax and the VAT on the
 * services, sometimes building or completion; plus a tax loan with its interest when one covers the taxes.
 */
function pocketNote(r: DecisionResult['results'][number]): string | null {
  const loan = r.simulation.taxLoanDrawn;
  if (r.personalCapitalRequired <= 1 && loan <= 1) return null;
  const parts: string[] = [];
  if (r.capitalGainsTaxReserve > 1) parts.push(`מס שבח כ-${formatCompactCurrency(r.capitalGainsTaxReserve)}`);
  if (r.servicesVat > 1) parts.push(`מע״מ על שירותי הבנייה כ-${formatCompactCurrency(r.servicesVat)}`);
  if (r.delivery.constructionAndCompletionPaid > 1) parts.push(`תשלומים ליזם על בנייה/השלמה כ-${formatCompactCurrency(r.delivery.constructionAndCompletionPaid)}`);
  if (r.purchaseTax > 1) parts.push(`מס רכישה כ-${formatCompactCurrency(r.purchaseTax)}`);
  const paid = parts.length ? `מה משלמים: ${parts.join(' · ')}` : null;
  const loanNote =
    loan > 1
      ? `הלוואת מסים כ-${formatCompactCurrency(loan)}, ריבית עד המסירה כ-${formatCompactCurrency(r.simulation.taxLoanInterest)} — לפירעון במסירה כ-${formatCompactCurrency(r.simulation.taxLoanAtMaturity)}`
      : null;
  return [paid, loanNote].filter(Boolean).join('. ') || null;
}

function shortStatus(v: RouteOption): string | null {
  switch (v.kind) {
    case 'fits':
      return null;
    case 'price':
      return 'תלוי במחיר שעוד לא ידוע';
    case 'short':
      return v.additionalCapital === null ? 'לא מתאים ליכולת' : `חסרים כ-${formatCompactCurrency(v.additionalCapital)}`;
    case 'none':
      return v.r.assessment.commercial === 'negotiable' ? 'היזם צפוי לא להציע' : 'לא מתאים ליכולת';
  }
}

/** Other ways to pay for the same apartments, compared with the card's main route in one line each. */
function Variants({ main, variants }: { main: RouteOption; variants: RouteOption[] }) {
  if (!variants.length) return null;
  return (
    <div className="priority-variants">
      <p className="priority-variants-title">דרכים אחרות לשלם על אותה דירה</p>
      <ul>
        {variants.map((v) => {
          const r = v.r;
          const status = shortStatus(v);
          const diff = r.delivery.netPosition - main.r.delivery.netPosition;
          const risk = riskLevel(r);
          return (
            <li key={r.id}>
              <strong>{PAYMENT_METHOD[r.strategyType] ?? strategyTitle(r)}</strong>
              {status && <span className="priority-note-inline"> · {status}</span>}
              {r.strategyType === 'S13' && <span className="priority-note-inline"> · {SIZE_NOTE}</span>}
              <span className="sub">
                {r.mortgageRequired > 1 ? `משכנתא ${formatCompactCurrency(r.mortgageRequired)} (${formatCurrency(r.monthlyRepayment)} לחודש)` : 'בלי משכנתא'}
                {' · '}
                {RISK_LABELS[risk.level]}
                {v.kind !== 'price' && !r.priceDependency && Math.abs(diff) >= 5000 && <> · משאיר לכם {formatCompactCurrency(Math.abs(diff))} {diff > 0 ? 'יותר' : 'פחות'} בסוף</>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const RANK_LABELS = ['עדיפות ראשונה', 'עדיפות שנייה', 'עדיפות שלישית', 'עדיפות רביעית'];

function noteFor(p: RouteOption): string | null {
  const size = p.r.strategyType === 'S13' ? SIZE_NOTE : null;
  switch (p.kind) {
    case 'fits':
      return [p.condition ? conditionText(p.condition) : null, size].filter(Boolean).join(' ') || null;
    case 'price': {
      const t = p.threshold;
      if (t.direction === 'min' && t.required !== null && t.required <= 0) return t.against ? 'משתלם בכל מחיר סביר' : 'תלוי במחיר שעוד לא ידוע';
      if (t.required === null) return `תלוי במחיר שעוד לא ידוע — ובהנחות שלנו לא נמצא ${KNOB_LABELS[t.knob]} סביר שבו זה משתלם לכם`;
      return `תלוי במחיר שעוד לא ידוע — משתלם רק אם ${KNOB_LABELS[t.knob]} יהיה ${thresholdBound(t)}`;
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

const ARRANGEMENT_IN: Record<TaxArrangement, string> = { gross: 'בעסקת ברוטו', mixed: 'בעסקה מעורבת', net: 'בעסקת נטו' };

/**
 * When the direction depends on terms the household must still obtain — a tax loan, or other tax terms — say what
 * to ask the developer for, with the household's own numbers and what is still unknown.
 */
function AskDeveloper({ result, availableCapital }: { result: DecisionResult; availableCapital: number | null }) {
  const c = result.conditionalRecommendation;
  if (!c) return null;
  const r = c.result;
  // The combination taxes on the owner under the offer (levy, capital gains on the services received, services VAT) —
  // not a later tax on selling the fraction.
  const ownerTaxes = r.ledger.filter((e) => e.payer === 'owner' && e.taxLoanEligible).reduce((s, e) => s + e.amount, 0);
  const loan = c.kind === 'funding' && c.method === 'developer_loan' ? result.fundingAlternatives.find((f) => f.method === 'developer_loan') : undefined;
  // A smaller whole apartment instead of selling the fraction — from the same run (same funding terms) as the
  // direction, and only when the direction leaves no whole apartment.
  const smaller = r.metrics.wholeApartments === 0 ? (loan?.smaller ?? undefined) : undefined;
  const completion = smaller?.ledger.filter((e) => e.category === 'completion_payment').reduce((s, e) => s + e.amount, 0) ?? 0;
  return (
    <section className="card ask-developer" aria-labelledby="ask-developer-title">
      <h2 id="ask-developer-title">מה כדאי לכם לבקש מהיזם?</h2>
      <p className="priority-desc">
        {c.kind === 'funding' ? (
          <>
            <strong>קומבינציה עם הסדר מימון מסים.</strong> בדקו הלוואת מסים מהיזם או מהבנק המלווה — הריבית, הבטוחות ומועד
            הפירעון — ובקשו שהיזם יישא בריבית ושהקרן תיפרע מתוך התמורה שתקבלו.
          </>
        ) : (
          <>
            <strong>{conditionText(c)}</strong>
          </>
        )}
      </p>
      <dl className="priority-numbers">
        <div>
          <dt>היטל השבחה משוער</dt>
          <dd>{formatCompactCurrency(r.levy.total)}</dd>
        </div>
        <div>
          <dt>מסים עליכם {ARRANGEMENT_IN[c.arrangement]}</dt>
          <dd>{formatCompactCurrency(ownerTaxes)}</dd>
        </div>
        <div>
          <dt>הון עצמי זמין</dt>
          <dd>{availableCapital === null ? 'לא ידוע' : formatCompactCurrency(availableCapital)}</dd>
        </div>
        {loan && (
          <div>
            <dt>הלוואת מסים נדרשת</dt>
            <dd>
              {formatCompactCurrency(loan.loan)}
              <span className="sub">
                {formatRate(loan.annualRate)} בשנה · לפירעון במסירה {formatCompactCurrency(loan.atMaturity)}
              </span>
            </dd>
          </div>
        )}
      </dl>
      {loan && loan.savingIfDeveloperPaysInterest > 1 && (
        <p className="priority-risk">אם היזם יישא בריבית — תחסכו כ-{formatCompactCurrency(loan.savingIfDeveloperPaysInterest)}.</p>
      )}
      {smaller && completion > 1 && (
        <p className="priority-risk">
          כדאי לבדוק גם דירת 3 חדרים: השלמה של כ-{formatCompactCurrency(completion)} במקום למכור את החלק. {SIZE_NOTE}
        </p>
      )}
      <p className="field-hint">
        מה עדיין לא ידוע: הצעת הקומבינציה בפועל, שומת ההיטל, זמינות הלוואת המסים ותנאיה, ומנגנון חלוקת הדירות.
      </p>
    </section>
  );
}

/**
 * A sale as a possible direction: the price to ask for — a target computed from the household's own alternatives,
 * not a valuation — with what it is compared against and the assumptions behind it.
 */
function SaleTarget({ result, sale, basisKnown }: { result: DecisionResult; sale: DecisionResult['priceConditional'][number]; basisKnown: boolean }) {
  const t = sale.threshold;
  const total = Math.ceil((t.required! * result.rights.landAreaSqm) / 1000) * 1000;
  const c = result.conditionalRecommendation;
  const against = t.against ? (result.results.find((r) => r.id === t.against) ?? (c?.result.id === t.against ? c.result : undefined)) : undefined;
  const needsLoan = c && c.result.id === t.against && c.kind === 'funding';
  const when = sale.result.strategyType === 'S01M' ? 'היום (מכירה בשוק הפתוח)' : 'במועד אישור התכנית (מכירה ליזם, בהסכם מותנה)';
  return (
    <div className="card priority-note sale-target">
      <p className="priority-rank">מחיר מכירה שכדאי לבדוק לפי ההעדפות שלכם</p>
      <p>
        <strong>{formatCurrency(total)}</strong> · כ-{formatCurrency(t.required!)} למ״ר קרקע מקורי
      </p>
      <p className="field-hint">
        מכירה עשויה להיות הכיוון המתאים לכם. זהו מחיר יעד המחושב לפי החלופות הכלכליות שלכם — לא שומת שווי הקרקע ולא מחיר של
        עסקה שהתקבלה בפועל. הושווה מול: {against ? strategyTitle(against) : 'החלופה הטובה ביותר שחושבה'}
        {needsLoan ? ' (שמצריכה הלוואת מסים)' : ''}. מס שבח לפי {basisKnown ? 'עלות הרכישה שהזנתם' : 'הנחה שמרנית של עלות רכישה אפס'}. מועד
        התשלום: {when}.
      </p>
    </div>
  );
}

export function TopPriorities({
  result,
  goal,
  combinationPct,
  availableCapital = null,
  basisKnown = false,
}: {
  result: DecisionResult;
  goal: Goal;
  combinationPct: number;
  availableCapital?: number | null;
  /** The household entered its acquisition cost (the capital-gains estimate uses it). */
  basisKnown?: boolean;
}) {
  const items = priorityRoutes(result, goal);
  const R = result.rights.apartmentEquivalents;
  // A household that wants no risk or cash soon: a sale may be its direction even though today's price is unknown —
  // say so, with the price it would need, rather than let a calculable development route look better by default.
  const sale = (goal === 'minimize_risk' || goal === 'immediate_cash') && result.priceConditional.find((p) => p.result.strategyType === 'S01M' || p.result.strategyType === 'S01');
  return (
    <section className="priorities" aria-live="polite" aria-labelledby="priorities-title">
      <AskDeveloper result={result} availableCapital={availableCapital} />
      {sale && sale.threshold.required !== null && sale.threshold.required > 0 && (
        <SaleTarget result={result} sale={sale} basisKnown={basisKnown} />
      )}
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
              {PAYMENT_METHOD[r.strategyType] && <p className="priority-method">דרך התשלום: {PAYMENT_METHOD[r.strategyType]}</p>}
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
                  <dt>{debtLabel(r)}</dt>
                  <dd>
                    {debt ? formatCompactCurrency(r.mortgageRequired) : 'ללא'}
                    {debt && <span className="sub">{formatCurrency(r.monthlyRepayment)} לחודש</span>}
                  </dd>
                </div>
              </dl>
              <Variants main={p} variants={p.variants} />
            </li>
          );
        })}
      </ol>
      <p className="verdict-note">
        עסקה אחת מכל סוג; דרכים שונות לשלם על אותה דירה מוצגות יחד. בלי הנחה על גודל דירה מבוקש. כיוון לבדיקה, לא אישור — הפירוט המלא, המסים והתנאים בתצוגה
        המתקדמת.
      </p>
    </section>
  );
}
