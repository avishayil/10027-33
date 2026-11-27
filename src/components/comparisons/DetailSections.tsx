import { SCENARIO_LABELS } from '../../data/scenarios';
import type { DecisionResult, Goal, LedgerEntry, NegotiationTarget, StrategyResult } from '../../domain/types';
import {
  CONDITION_TEXT,
  NEGOTIATION_LABELS,
  REASON_TEXT,
  explainWhy,
  formatRights,
  strategyTitle,
} from '../../optimizer/explain';
import { formatArea, formatCompactCurrency, formatCurrency, formatNumber } from '../../utils/format';
import { AssessmentChips } from '../verdict/Verdict';

function Section({ title, sub, children, open = false }: { title: string; sub?: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="card detail-section" open={open}>
      <summary>
        <span>
          {title}
          {sub && <span className="summary-sub">{sub}</span>}
        </span>
      </summary>
      {children}
    </details>
  );
}

const monthLabel = (m: number) => (m === 0 ? 'בחתימה' : m % 12 === 0 ? `שנה ${m / 12}` : `חודש ${m}`);

export function WhyFits({ result, goal }: { result: DecisionResult; goal: Goal }) {
  const rec = result.recommendation;
  if (!rec) return null;
  const rejected = result.results.filter((r) => r.feasibility === 'infeasible' && r.assessment.commercial !== 'negotiable');
  const notOffered = result.results.filter((r) => r.assessment.commercial === 'negotiable');
  return (
    <Section title="למה זה מתאים לי?" sub="הנימוקים, ומה נפסל ולמה">
      <ul>
        {explainWhy(rec, goal, result.ranked).map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {rejected.length > 0 && (
        <>
          <h3>מסלולים שנפסלו</h3>
          <ul>
            {rejected.map((r) => (
              <li key={r.id}>
                <strong>{strategyTitle(r)}</strong> —{' '}
                {r.reasonCodes
                  .filter((c) => ['NO_BORROWING_CAPACITY', 'REPAYMENT_EXCEEDED', 'LTV_EXCEEDED', 'UNFUNDED_OBLIGATION'].includes(c))
                  .map((c) => REASON_TEXT[c])
                  .join(' ')}
              </li>
            ))}
          </ul>
        </>
      )}
      {notOffered.length > 0 && (
        <>
          <h3>מסלולים שהיזם צפוי שלא להציע לכם</h3>
          <p className="field-hint">
            {REASON_TEXT[notOffered[0].reasonCodes.find((c) => c.startsWith('DEVELOPER_POLICY')) ?? 'DEVELOPER_POLICY_PER_OWNER_CAP']}
          </p>
          <ul>
            {notOffered.map((r) => (
              <li key={r.id}>{strategyTitle(r)}</li>
            ))}
          </ul>
        </>
      )}
      {result.sensitivity.drivers.length > 0 && (
        <p className="callout">
          ההמלצה רגישה ל: <strong>{result.sensitivity.drivers.join(', ')}</strong>. שינוי שמרני באחד מהם לבדו
          משנה את המסלול המוביל.
        </p>
      )}
    </Section>
  );
}

export function StrategyComparison({ result }: { result: DecisionResult }) {
  const order = new Map(result.ranked.map((r, i) => [r.id, i]));
  const rows = [...result.results].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  return (
    <Section title="השוואת מסלולים" sub={`${result.results.length} מסלולים נבדקו אוטומטית`}>
      <div className="table-scroll">
        <table className="compare-table strategy-table stack-on-mobile">
          <thead>
            <tr>
              <th>מסלול</th>
              <th>יכולת · עמידות · יזם</th>
              <th>דירות שלמות</th>
              <th>זכויות שנמכרות</th>
              <th>משכנתא</th>
              <th>החזר חודשי</th>
              <th>כסף נטו תוך שנתיים</th>
              <th>היטל — עליכם / היזם</th>
              <th>מצב נטו במסירה (מחירי היום)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === result.recommendation?.id ? 'row-recommended' : ''}>
                <td className="cell-title">
                  {strategyTitle(r)}
                  {r.id === result.recommendation?.id && <span className="kind-tag">מומלץ</span>}
                  {r.priceDependency && <span className="kind-tag kind-tag-warn">תלוי במחיר לא ידוע</span>}
                </td>
                <td data-label="יכולת · עמידות · יזם">
                  <AssessmentChips r={r} compact />
                </td>
                <td data-label="דירות שלמות">{r.metrics.wholeApartments}</td>
                <td data-label="זכויות שנמכרות">{formatRights(r.rightsSold)}</td>
                <td data-label="משכנתא">{r.mortgageRequired > 1 ? formatCurrency(r.mortgageRequired) : '—'}</td>
                <td data-label="החזר חודשי">{r.monthlyRepayment > 1 ? formatCurrency(r.monthlyRepayment) : '—'}</td>
                <td data-label="כסף נטו תוך שנתיים">{formatCurrency(r.metrics.liquidity)}</td>
                <td data-label="היטל — עליכם / היזם">
                  {formatCurrency(r.levy.owner)} / {formatCurrency(r.levy.developer)}
                </td>
                <td data-label="מצב נטו במסירה (מחירי היום)">{r.priceDependency ? 'תלוי במחיר' : formatCurrency(r.delivery.netPosition)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        ״מצב נטו במסירה״ = שווי הדירות במחירי היום (תרחיש מבוסס עסקאות השוואה) + כסף שתקבלו − כל מה שתשלמו (מסים,
        היטל, בנייה, השלמה) − ריבית עד המסירה. בלי עליית מחירים ובלי תשואה; לא כסף ביד. מסלולים שתלויים במחיר שעוד לא
        ידוע (מכירה, תמורות, פיצוי כספי) לא מקבלים ציון — ראו ״מסלולים שתלויים במחיר״.
      </p>
    </Section>
  );
}

function LedgerRows({ entries }: { entries: LedgerEntry[] }) {
  return (
    <>
      {entries.map((e, idx) => (
        <tr key={idx}>
          <th>
            {e.label}
            {e.payer !== 'owner' && <span className="muted"> (לא עליכם)</span>}
          </th>
          <td>{e.deferred ? 'במימוש' : monthLabel(e.month)}</td>
          <td className={e.direction === 'in' ? 'amount-in' : 'amount-out'}>
            {e.direction === 'in' ? '+' : '−'}
            {formatCurrency(e.amount)}
            {e.range && e.range.high - e.range.low > 1 && (
              <span className="muted range">
                {' '}
                (טווח {formatCurrency(e.range.low)}–{formatCurrency(e.range.high)})
              </span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

export function CostLedger({ r }: { r: StrategyResult }) {
  const entries = r.ledger.filter((e) => e.amount > 0 || e.payer !== 'owner');
  return (
    <Section title="פירוט עלויות ומסים" sub={strategyTitle(r)}>
      <div className="table-scroll">
        <table className="kv-table ledger-table">
          <tbody>
            <LedgerRows entries={entries} />
            <tr className="row-total">
              <th>היטל השבחה שעליכם (אומדן)</th>
              <td />
              <td>{formatCurrency(r.bettermentLevy)}</td>
            </tr>
            <tr className="row-total">
              <th>רזרבת מס שבח</th>
              <td />
              <td>{formatCurrency(r.capitalGainsTaxReserve)}</td>
            </tr>
            {r.servicesVat > 0 && (
              <tr className="row-total">
                <th>מע״מ על שירותי הבנייה שעליכם</th>
                <td />
                <td>{formatCurrency(r.servicesVat)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        עלויות הבנייה כוללות מע״מ, רווח יזמי, רזרבה של 10% לבלתי צפוי והצמדה של 3% בשנה. היטל ההשבחה מוערך מטבלת
        האיזון (50% מעליית השווי); כל זכות נושאת היטל פעם אחת בלבד. מס שבח — רזרבה על הרווח, לא על התמורה ברוטו. בקומבינציה
        כל מס (היטל, מס שבח, מע״מ על שירותי הבנייה) משולם פעם אחת — על ידיכם או על ידי היזם, לפי ההסדר.
      </p>
    </Section>
  );
}

export function Financing({ result, r }: { result: DecisionResult; r: StrategyResult }) {
  const s = r.simulation;
  return (
    <Section title="מימון ומשכנתא" sub="מקורות, החזרים ותזרים לאורך הזמן">
      <table className="kv-table">
        <tbody>
          <tr>
            <th>משכנתא מקסימלית לפי יכולת ההחזר שהזנתם</th>
            <td>{result.mortgageCapacity === null ? 'לא הוזן' : formatCurrency(result.mortgageCapacity)}</td>
          </tr>
          <tr>
            <th>הון עצמי שמשמש את המסלול</th>
            <td>{formatCurrency(r.personalCapitalRequired)}</td>
          </tr>
          <tr>
            <th>משכנתא נדרשת (בשיא)</th>
            <td>{formatCurrency(r.mortgageRequired)}</td>
          </tr>
          <tr>
            <th>— מתוכה הלוואת גישור לפני ההיתר</th>
            <td>{formatCurrency(s.drawsByStage.bridge)}</td>
          </tr>
          <tr>
            <th>— מתוכה מימון בנייה (היתר עד מסירה)</th>
            <td>{formatCurrency(s.drawsByStage.construction)}</td>
          </tr>
          <tr>
            <th>— מתוכה משכנתא על הדירה הגמורה</th>
            <td>{formatCurrency(s.drawsByStage.mortgage)}</td>
          </tr>
          {s.facilities.map((f) => (
            <tr key={f.type}>
              <th>
                {f.type === 'project_loan' ? 'מימון הפרויקט (בנייה ← משכנתא על הדירה)' : f.type === 'secured_other_property' ? 'הלוואה על הנכס האחר (״לכל מטרה״)' : 'הלוואת מסים'}
                <span className="summary-sub">
                  {formatNumber(f.annualRate * 100, 2)}% ·{' '}
                  {f.repayment === 'amortising_from_draw' ? 'החזר מהמשיכה' : f.repayment === 'bullet_at_delivery' ? 'פירעון במסירה' : 'ריבית בלבד עד המסירה, אחר כך שפיצר'}
                </span>
              </th>
              <td>
                {formatCurrency(f.drawn)} · בשיא {formatCurrency(f.peak)}
              </td>
            </tr>
          ))}
          {s.taxesFinancedBySecuredLoan > 1 && (
            <tr>
              <th>הלוואה על הנכס האחר שלכם (״לכל מטרה״, עד הסכום שהזנתם)</th>
              <td>{formatCurrency(s.taxesFinancedBySecuredLoan)}</td>
            </tr>
          )}
          {s.taxLoanDrawn > 1 && (
            <tr>
              <th>הלוואת מסים מהיזם / מהבנק המלווה (נפרעת במסירה) · ריבית מצטברת</th>
              <td>
                {formatCurrency(s.taxLoanDrawn)} · {formatCurrency(s.taxLoanInterest)}
              </td>
            </tr>
          )}
          <tr className={s.unfunded > 1 ? 'row-alert' : ''}>
            <th>תשלומים שאין להם מימון (מסים, היטל, עלויות)</th>
            <td>{formatCurrency(s.unfunded)}</td>
          </tr>
          <tr>
            <th>שיעור מימון מקסימלי (לפני מסירה / אחרי)</th>
            <td>
              {formatNumber(Math.min(s.peakPreCompletionLtv, 9.99) * 100, 0)}% / {formatNumber(Math.min(s.peakPostCompletionLtv, 9.99) * 100, 0)}%
            </td>
          </tr>
          <tr>
            <th>החזר חודשי בזמן הבנייה (ריבית בלבד)</th>
            <td>{formatCurrency(s.constructionPhaseMonthly)}</td>
          </tr>
          <tr>
            <th>החזר חודשי אחרי המסירה</th>
            <td>{formatCurrency(s.postCompletionMonthly)}</td>
          </tr>
          <tr>
            <th>שכר דירה נטו אחרי המסירה</th>
            <td>{formatCurrency(s.monthlyNetRent)}</td>
          </tr>
          <tr>
            <th>פער מימון שלא מכוסה</th>
            <td>{formatCurrency(r.peakFundingGap)}</td>
          </tr>
        </tbody>
      </table>
      <h3>כסף וחוב בסוף כל שנה</h3>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th>שנה</th>
              {s.yearly.map((y) => (
                <th key={y.year}>{y.year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>מזומן</td>
              {s.yearly.map((y) => (
                <td key={y.year}>{formatNumber(y.cash / 1000, 0)}K</td>
              ))}
            </tr>
            <tr>
              <td>חוב</td>
              {s.yearly.map((y) => (
                <td key={y.year}>{formatNumber(y.debt / 1000, 0)}K</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        משכנתא רגילה לא מממנת מסים, היטל ועלויות עסקה — הם משולמים מכסף פנוי, או בהלוואה נפרדת ומותנית (על נכס אחר / הלוואת מסים מהיזם). לפני המסירה הבטוחה היא הקרקע שנשארת
        בבעלותכם והסכומים ששולמו לבנייה; זכויות שנמכרו אינן בטוחה. שכר דירה מגיע רק אחרי המסירה ורק מדירות שלמות.
        מימון בפועל, במיוחד לבנייה על קרקע בבעלות משותפת, דורש אישור בנק.
      </p>
    </Section>
  );
}

export function ScenarioComparison({ result }: { result: DecisionResult }) {
  const rows = result.ranked.slice(0, 5);
  const byScenarioTitle = (id: string | null) => {
    const r = result.results.find((x) => x.id === id);
    return r ? strategyTitle(r) : '—';
  };
  return (
    <Section title="מה אם המחירים ישתנו?" sub="שלושה תרחישים קבועים מראש">
      <ul className="scenario-recs">
        {(['favorable', 'base', 'adverse'] as const).map((id) => (
          <li key={id}>
            <strong>{SCENARIO_LABELS[id]}:</strong> {byScenarioTitle(result.sensitivity.byScenario[id])}
          </li>
        ))}
      </ul>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th>מסלול</th>
              {(['favorable', 'base', 'adverse'] as const).map((id) => (
                <th key={id}>{SCENARIO_LABELS[id]}</th>
              ))}
              <th>אם התכנית לא תאושר</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{strategyTitle(r)}</td>
                {r.scenarioResults.map((s) => (
                  <td key={s.scenarioId} className={s.feasible ? '' : 'cell-fail'}>
                    {formatCurrency(s.comparisonValue)}
                    {!s.feasible && <span className="muted"> · לא עומד</span>}
                  </td>
                ))}
                <td className={r.noApproval.unprotected > 1000 ? 'cell-fail' : ''}>
                  {r.noApproval.unprotected > 1000
                    ? `מוגן ${formatCurrency(r.noApproval.protected)} · חלקית ${formatCurrency(r.noApproval.partial)} · בלי הגנה ${formatCurrency(r.noApproval.unprotected)}${r.noApproval.purchasedRights > 1 ? ` (וזכויות שנקנו ב-${formatCurrency(r.noApproval.purchasedRights)} — שווי מכירה לא ידוע)` : ''}`
                    : 'בלי חשיפה — הקרקע נשארת שלכם'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>מה קורה אם… (לפי מצב החוזה)</h3>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th>מסלול</th>
              <th>האישור מתעכב בשנתיים</th>
              <th>היזם קורס באמצע הבנייה</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{strategyTitle(r)}</td>
                <td className={r.delayedApproval && !r.delayedApproval.feasible ? 'cell-fail' : ''}>
                  {r.delayedApproval
                    ? `${r.delayedApproval.feasible ? 'עדיין מתאים' : 'כבר לא מתאים'} · ${r.delayedApproval.valueChange >= 0 ? '+' : '−'}${formatCurrency(Math.abs(r.delayedApproval.valueChange))} בערך${r.delayedApproval.extraInterest > 1000 ? ` · עוד ${formatCurrency(r.delayedApproval.extraInterest)} ריבית` : ''}`
                    : '—'}
                </td>
                <td className={r.developerFailure.unprotected > 1000 ? 'cell-fail' : ''}>
                  {r.developerFailure.paidToDeveloper > 1000
                    ? `שולם ליזם ${formatCurrency(r.developerFailure.paidToDeveloper)} — מוגן בערבות: הפסד ${formatCurrency(r.developerFailure.protected)} · בלי ערבות: ${formatCurrency(r.developerFailure.unprotected)}${r.developerFailure.debtOutstanding > 1000 ? ` · חוב פתוח ${formatCurrency(r.developerFailure.debtOutstanding)}` : ''}`
                    : `לא שולם ליזם על בנייה${r.developerFailure.debtOutstanding > 1000 ? ` · חוב פתוח ${formatCurrency(r.developerFailure.debtOutstanding)}` : ''}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        בכל המצבים הקרקע (ומה שנבנה עליה) נשארת שלכם — בשווי לא ידוע במצב כזה, ולכן לא נזקף. ״קורס באמצע הבנייה״: מה ששולם
        ליזם על בנייה והשלמה עד אמצע תקופת הבנייה, הריבית עד אז והחוב שנשאר. ערבות חוק המכר או חשבון נאמנות מחזירים את
        התשלומים רק אם החוזה מחייב אותם — לבדוק. אלה מצבי חוזה, לא הסתברויות.
      </p>
      <p className="field-hint">
        הערך: ערך נוכחי ביום החתימה, במחירי היום, בהיוון ריאלי של 3% — כל תשלום ותקבול במועדו והדירה במועד המסירה, פחות
        הריבית. כך דירה שמתקבלת מאוחר יותר שווה פחות גם בלי עליית מחירים. אופטימי: דירה
        ₪28,000 למ״ר, ריבית 4%, אישור בעוד 18 חודשים ומסירה בעוד 4 שנים. שמרני: דירה ₪21,000 למ״ר, חריגה של 15% בבנייה,
        ריבית 7% (וגם הלוואת המסים יקרה ב-2%), אישור בעוד 3 שנים, היתר שנה אחריו, מסירה בעוד 8 שנים, מכירת יחידת הסל שנה
        אחרי המסירה, מחיר זכויות −25%, היטל +25%. ״אם התכנית לא תאושר״: חוזה מותנה בטל, לא נבנות דירות, אין שכירות
        והקרקע נשארת שלכם. ההפסד תלוי בחוזה: מוגן (ערבויות מחזירות את המקדמות — נשארים הריבית ועלויות שלא מוחזרות), חלקית
        (כמחצית המקדמות), בלי הגנה (כל המקדמות והריבית — החשיפה המקסימלית). זכויות שנקנו נשארות שלכם, אבל שווי המכירה
        שלהן לא ידוע. אחוז
        הקומבינציה והרווח היזמי נשארים כפי שבחרתם. אלה תרחישי לחץ — לא תחזית.
      </p>
      <p className="field-hint">
        לפני חתימה כדאי לשאול: אילו ערבויות מבטיחות את המקדמות ואת מסי הבעלים שהיזם מתחייב להם; מהם התנאים המתלים ומה
        המועד האחרון לאישור התכנית; אילו שעבודים יירשמו על הזכויות; ומי מחזיק את הכספים בנאמנות עד האישור.
      </p>
    </Section>
  );
}

function formatTarget(t: NegotiationTarget): string {
  if (t.value === null) return 'לא ניתן בטווח שנבדק';
  switch (t.unit) {
    case 'ils':
      return formatCurrency(t.value);
    case 'ils_per_sqm':
      return t.value <= 0 ? 'לא נדרש מחיר מינימלי' : `${formatCurrency(t.value)} למ״ר קרקע`;
    case 'pct':
      return `${formatNumber(t.value * 100, 1)}%`;
    case 'months':
      return t.value === 0 ? 'בחתימה' : `עד ${t.value} חודשים מהחתימה`;
  }
}

const KIND_LABELS: Record<NonNullable<NegotiationTarget['kind']>, string> = {
  financing: 'כדי שתוכלו לממן',
  breakeven: 'איזון כלכלי',
  conservative: 'מומלץ (שמרני)',
  developer: 'מודל צד היזם',
  general: '',
};

function formatCurrent(t: NegotiationTarget): string {
  if (t.current === undefined) return '';
  return `הנחה נוכחית: ${formatTarget({ ...t, value: t.current })}`;
}

export function NegotiationPanel({ result }: { result: DecisionResult }) {
  const groups = new Map<string, NegotiationTarget[]>();
  for (const t of result.negotiationTargets.filter((x) => x.kind !== 'developer')) {
    const key = t.strategyId ?? '';
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const titleOf = (id: string) => {
    const r = result.results.find((x) => x.id === id);
    return r ? `${strategyTitle(r)}${r.feasibility === 'infeasible' ? ' — כרגע לא מתאים' : ''}` : 'כללי';
  };
  const unknownInputs = result.mortgageCapacity === null;
  return (
    <Section title="מה לבקש מהיזם?" sub="ספי משא ומתן שמחושבים מהיכולת הכלכלית שלכם" open>
      {[...groups.entries()].map(([id, targets]) => (
        <div key={id} className="negotiation-group">
          <h3>{titleOf(id)}</h3>
          <table className="kv-table">
            <tbody>
              {targets.map((t) => (
                <tr key={t.code}>
                  <th>
                    {NEGOTIATION_LABELS[t.code]}
                    {t.kind && KIND_LABELS[t.kind] && <span className="kind-tag">{KIND_LABELS[t.kind]}</span>}
                    {t.note && t.code !== 'MIN_COMBINATION_PCT' && (
                      <span className="muted"> (לעומת: {titleOf(t.note).replace(' — כרגע לא מתאים', '')})</span>
                    )}
                    {t.code === 'MIN_COMBINATION_PCT' && t.note && (
                      <span className="muted"> ({t.note === '1' ? 'לדירה שלמה אחת' : `ל-${t.note} דירות`})</span>
                    )}
                  </th>
                  <td>
                    {formatTarget(t)}
                    <span className="summary-sub">{formatCurrent(t)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {unknownInputs && (
        <p className="field-hint">יכולת ההחזר לא הוזנה — הספים חושבו בהנחה שלא תיקחו משכנתא (וכסף פנוי שלא הוזן נחשב 0).</p>
      )}
      <p className="field-hint">
        שלושה מחירים שונים לזכויות עודפות: <strong>כדי שתוכלו לממן</strong> — המחיר שבו המסלול נכנס ליכולת שלכם;{' '}
        <strong>איזון כלכלי</strong> — המחיר שבו הוא שווה למסלול המשתלם ביותר בלי מכירה; <strong>מומלץ</strong> — המחיר
        שבו הוא עדיף גם בתרחיש השמרני. מסלול יכול להיות אפשרי מימונית ועדיין פחות משתלם.
      </p>
    </Section>
  );
}

export function Conditions({ r }: { r: StrategyResult }) {
  if (!r.requiredConditions.length) return null;
  return (
    <ul>
      {r.requiredConditions.map((c) => (
        <li key={c}>{CONDITION_TEXT[c]}</li>
      ))}
    </ul>
  );
}

export function DeveloperPanel({ result, combinationPct }: { result: DecisionResult; combinationPct: number }) {
  const d = result.developer;
  const lp = result.lotPolicy;
  const pctFmt = (x: number) => `${formatNumber(x * 100, 1)}%`;
  const R = result.rights.apartmentEquivalents;
  return (
    <Section title="היתכנות העסקה מול היזם" sub="מדיניות שירותי בנייה במגרש, והאם התנאים הגיוניים מבחינת היזם">
      <h3>שירותי בנייה במגרש {lp.lotId}</h3>
      <div className={`callout ${lp.servicesOffered ? '' : 'callout-strong'}`}>
        {lp.servicesOffered ? (
          <>
            עם {formatRights(R)} זכויות, הקומבינציה המלאה ({pctFmt(combinationPct)}) נותנת לכם{' '}
            {formatRights(R * combinationPct)} דירה — פחות מדירה שלמה. לכן שירותי בנייה לדירה אחת הם אפשרות סבירה,
            בכפוף למקום פנוי במגרש.
          </>
        ) : (
          <>
            עם {formatRights(R)} זכויות, הקומבינציה המלאה ({pctFmt(combinationPct)}) כבר נותנת לכם{' '}
            {formatRights(R * combinationPct)} דירות. יזם צפוי להציע לכם קומבינציה מלאה ולא שירותי בנייה — לכן מסלולי
            הבנייה מסומנים ״לא צפוי שיוצע״.
          </>
        )}
      </div>
      <table className="kv-table">
        <tbody>
          <tr>
            <th>יחידות דיור במגרש</th>
            <td>{lp.lotUnits}</td>
          </tr>
          <tr>
            <th>תקרה משוערת לשירותי בנייה ({pctFmt(lp.capShare)})</th>
            <td>כ-{formatNumber(lp.capUnits, 0)} דירות</td>
          </tr>
          <tr>
            <th>ביקוש משוער (בעלי ~167 מ״ר שהקומבינציה לא נותנת להם דירה שלמה)</th>
            <td>כ-{formatNumber(lp.estimatedDemand, 0)} בעלים</td>
          </tr>
          <tr>
            <th>מעל כמה זכויות צפויה קומבינציה מלאה</th>
            <td>{formatNumber(lp.wholeFromCombinationThreshold, 2)} זכויות</td>
          </tr>
          <tr>
            <th>מקסימום דירות בשירותי בנייה לבעלים</th>
            <td>{lp.maxServiceApartmentsPerOwner}</td>
          </tr>
        </tbody>
      </table>
      {lp.servicesOffered && lp.estimatedDemand > lp.capUnits && (
        <p className="field-hint">
          לפי ההערכה יש יותר מבקשים ממקומות — כדאי לברר מוקדם מול היזם איך יוקצו מקומות לשירותי בנייה.
        </p>
      )}
      <p className="field-hint">
        הנחת עבודה: יזם מרוויח הכי הרבה מקומבינציה מלאה, ולכן יקצה לשירותי בנייה רק 20%–30% מהדירות במגרש וידאג שכל בעל
        זכויות יוכל להגיע לדירה. זו הערכה — לא מדיניות שפורסמה.
      </p>
      <h3>טווח משא ומתן על זכויות עודפות</h3>
      {result.negotiationTargets
        .filter((t) => t.code === 'NEGOTIATION_RANGE')
        .map((t) => (
          <p key={t.strategyId} className={`callout ${t.overlap ? '' : 'callout-strong'}`}>
            {titleFor(result, t.strategyId)}: המינימום שמשתלם לכם {t.value === null ? 'לא נמצא' : `${formatCurrency(t.value)} למ״ר`} · המקסימום
            הסביר ליזם (רווח 15%) {formatCurrency(t.upper ?? 0)} למ״ר —{' '}
            <strong>{t.overlap ? 'יש טווח חופף למשא ומתן.' : 'אין טווח חופף בהנחות האלה.'}</strong>
          </p>
        ))}
      <h3>כלכלת העסקה מבחינת היזם — כל המגרש</h3>
      <p className="field-hint">
        כל {formatNumber(d.lot.units, 0)} יחידות המגרש לפי תנאי ההצעה: {formatNumber(d.lot.servicesUnits, 1)} בשירותי בנייה (מכסה),
        השאר בקומבינציה ({formatNumber(d.lot.developerUnits, 1)} יחידות נמכרות ע״י היזם). חודש אחר חודש, במחירי היום, כולל מימון
        (הון עצמי ואז ליווי בנקאי) והמסים שהיזם נושא בהם במועדם — כאילו כל הבעלים במצבכם.
      </p>
      <table className="kv-table">
        <tbody>
          {d.lot.lines.map((l) => (
            <tr key={l.label}>
              <th>{l.label}</th>
              <td>{formatCurrency(l.amount)}</td>
            </tr>
          ))}
          <tr className="row-total">
            <th>רווח משוער ליזם במגרש (מההכנסות)</th>
            <td className={d.combinationMargin < 0 ? 'cell-fail' : ''}>
              {formatCurrency(d.lot.profit)} · {pctFmt(d.combinationMargin)}
            </td>
          </tr>
          <tr>
            <th>הון עצמי של היזם בשיא · ליווי בנקאי בשיא</th>
            <td>
              {formatCurrency(d.lot.peakEquity)} · {formatCurrency(d.lot.peakLoan)}
            </td>
          </tr>
        </tbody>
      </table>
      {result.recommendation?.developerPnL && (
        <>
          <p className="field-hint">החלק שלכם בעסקה מבחינת היזם, במסלול המומלץ (בעלים אחד, במחירי היום, לפני מימון ותזמון):</p>
          <table className="kv-table">
            <tbody>
              {result.recommendation.developerPnL.lines.map((l) => (
                <tr key={l.label}>
                  <th>{l.label}</th>
                  <td>{formatCurrency(l.amount)}</td>
                </tr>
              ))}
              <tr className="row-total">
                <th>רווח משוער ליזם (מההכנסות)</th>
                <td className={result.recommendation.developerPnL.marginOnRevenue < 0 ? 'cell-fail' : ''}>
                  {pctFmt(result.recommendation.developerPnL.marginOnRevenue)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="field-hint">רווח שלילי כאן הוא אזהרת מודל — לא קביעה שיזם אמיתי מפסיד. בדקו היקף עלויות, שטחים ותמהיל.</p>
        </>
      )}
      <table className="kv-table">
        <tbody>
          <tr>
            <th>שווי הדירות שתקבלו בקומבינציה של {pctFmt(combinationPct)} (היום, לפני מסים ועיתוי)</th>
            <td>{formatCurrency(d.combinationEntitlementValue)}</td>
          </tr>
          <tr>
            <th>אותו שווי, למ״ר קרקע מקורי</th>
            <td>{formatCurrency(d.impliedCombinationValuePerSqm)}</td>
          </tr>
          <tr>
            <th>תמורה ממכירת כל הקרקע ב-{formatCurrency(result.negotiationTargets.find((t) => t.code === 'DEVELOPER_RESIDUAL_LAND_PRICE')?.current ?? 0)} למ״ר</th>
            <td>{formatCurrency(d.grossSaleValue)}</td>
          </tr>
          <tr>
            <th>מחיר במזומן ששקול להצעת הקומבינציה מבחינת היזם</th>
            <td>{formatCurrency(d.consistentCashPricePerSqm)} למ״ר</td>
          </tr>
          <tr>
            <th>מס שבח שהיזם משלם עבורכם בקומבינציה (רק בעסקת נטו, כולל גילום)</th>
            <td>{formatCurrency(d.combinationTaxCost)}</td>
          </tr>
          <tr>
            <th>רווח משוער ליזם בקומבינציה של {pctFmt(combinationPct)} — כל המגרש, כולל מימון</th>
            <td className={d.combinationMargin < 0 ? 'cell-fail' : ''}>{pctFmt(d.combinationMargin)}</td>
          </tr>
          <tr>
            <th>רווח משוער ליזם אם יקנה את כל הקרקע במחיר התרחיש</th>
            <td>{pctFmt(d.landPurchaseMargin)}</td>
          </tr>
          <tr>
            <th>רווח משוער ליזם בעסקת תמורות</th>
            <td className={d.revenueShareMargin < 0 ? 'cell-fail' : ''}>{pctFmt(d.revenueShareMargin)}</td>
          </tr>
          <tr>
            <th>מחיר קרקע מקסימלי שמשאיר ליזם רווח של 15%</th>
            <td>{formatCurrency(d.residualLandValuePerSqm)} למ״ר</td>
          </tr>
          <tr>
            <th>אחוז קומבינציה מקסימלי שמשאיר ליזם רווח של 15% (מודל המגרש)</th>
            <td>{pctFmt(d.maxCombinationAtTargetMargin)}</td>
          </tr>
        </tbody>
      </table>
      <DeveloperThresholdsView result={result} combinationPct={combinationPct} />
      <p className="field-hint">
        מודל אינדיקטיבי: הכנסות מכירה ללא מע״מ, עלות בנייה ישירה לפי שטחי התכנית ותעריפי סקר עלויות הבנייה (לא ₪11,000 — זה המחיר שהבעלים משלמים על שירותי בנייה), 12% עלויות רכות, היטל השבחה, ומע״מ
        על שירותי הבנייה לבעלים בקומבינציה. ״רווח יזמי״ בסליידר הוא תוספת על שירותי בנייה בלבד — כאן מדובר ברווח על
        הפרויקט כולו. אם יזם מציע בפועל קומבינציה גבוהה מהמקסימום, כנראה שעלויות הבנייה שלו נמוכות מההנחה — ואז גם מחיר
        הקרקע שהוא יכול לשלם גבוה יותר. זו הערכה, לא הצעה.
      </p>
    </Section>
  );
}

/**
 * What would make the offer viable for a developer: calculated thresholds on the lot model — not market estimates and
 * never new defaults. The ₪11,000/m² construction price charged to owners stays the user's assumption; the
 * developer's own direct cost is a separate quantity.
 */
function DeveloperThresholdsView({ result, combinationPct }: { result: DecisionResult; combinationPct: number }) {
  const pctFmt = (x: number) => `${formatNumber(x * 100, 1)}%`;
  const t = result.developerThresholds;
  const cell = (x: number | null) => (x === null ? '—' : pctFmt(x));
  return (
    <>
      <h3>מה היה צריך להשתנות כדי ש-{pctFmt(combinationPct)} ישתלם ליזם?</h3>
      <p className="field-hint">
        יעד היזם: {pctFmt(t.targetMarginOnRevenue)} רווח מההכנסות (שקול ל-{pctFmt(t.profitOnCostAtTarget)} רווח על העלות). עלות הבנייה
        שהבעלים משלמים (₪11,000 למ״ר) נשארת ההנחה שלכם; עלות הבנייה הישירה של היזם (כרגע כ-{formatCurrency(t.budget.perSaleableSqm)} למ״ר מכר
        לפי התקציב) היא גודל נפרד.
      </p>
      <NegotiationRange result={result} combinationPct={combinationPct} />
      <h3>תקציב הבנייה של היזם — לפי שטחי התכנית ואומדן השמאים</h3>
      <p className="field-hint">
        שטחי הבנייה במגרש לפי טבלה 5 בהוראות התכנית, בתעריפי אומדן עלויות הבנייה של לשכת שמאי המקרקעין (יוני 2026,
        השרון, בניין רב קומות): ₪6,600 למ״ר עילי, ₪3,400 למ״ר תת-קרקעי, מרפסות 40% מהתעריף. ללא מע״מ, תכנון, אגרות,
        היטלים, פיתוח ומימון. זה תקציב היזם בלבד — המחיר שהבעלים משלמים על שירותי בנייה נשאר ₪11,000 למ״ר.
      </p>
      <table className="kv-table">
        <tbody>
          <tr>
            <th>בנייה עילית · תת-קרקעית · מרפסות</th>
            <td>
              {formatCurrency(t.budget.lines.aboveGround)} · {formatCurrency(t.budget.lines.underground)} · {formatCurrency(t.budget.lines.balconies)}
            </td>
          </tr>
          <tr className="row-total">
            <th>סה״כ עלות ישירה · למ״ר מכר (פלדלת)</th>
            <td>
              {formatCurrency(t.budget.direct)} · {formatCurrency(t.budget.perSaleableSqm)}
            </td>
          </tr>
          {t.budget.sensitivity.map((x) => (
            <tr key={x.label}>
              <th>רווח היזם במגרש — {x.label}</th>
              <td className={x.margin < 0 ? 'cell-fail' : ''}>{pctFmt(x.margin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="kv-table">
        <tbody>
          <tr>
            <th>עלות בנייה ישירה מקסימלית ליזם, למ״ר מכר (בשווי דירה של ₪25,000 למ״ר)</th>
            <td>{t.maxDirectCostPerSqm === null ? 'לא נמצאה' : `${formatCurrency(t.maxDirectCostPerSqm)} למ״ר`}</td>
          </tr>
          <tr>
            <th>שווי דירה מינימלי (בתקציב הבנייה לפי הסקר)</th>
            <td>{t.minApartmentPricePerSqm === null ? 'לא נמצא' : `${formatCurrency(t.minApartmentPricePerSqm)} למ״ר`}</td>
          </tr>
        </tbody>
      </table>
      <p className="field-hint">אלה ספי איזון שהמודל מחשב — לא מחירים שנבדקו בשוק ולא ברירת מחדל חדשה.</p>
      <h3>בדיקות לחץ ליזם — במגרש שלכם, בתנאים שהזנתם</h3>
      <p className="field-hint">
        בבסיס: רווח על העלות {pctFmt(t.budget.returns.profitOnCost)}, תשואה שנתית על ההון העצמי של היזם{' '}
        {t.budget.returns.equityIrr === null ? '— לא מוגדרת' : pctFmt(t.budget.returns.equityIrr)}, הון עצמי בשיא{' '}
        {formatCompactCurrency(t.budget.returns.peakEquity)}, אשראי בשיא {formatCompactCurrency(t.budget.returns.peakLoan)}. חישוב אינדיקטיבי.
      </p>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th>תרחיש</th>
              <th>רווח מההכנסות</th>
              <th>רווח על העלות</th>
              <th>תשואה על ההון</th>
              <th>אשראי בשיא</th>
            </tr>
          </thead>
          <tbody>
            {t.budget.stress.map((x) => (
              <tr key={x.label}>
                <th>{x.label}</th>
                <td className={x.margin < 0 ? 'cell-fail' : ''}>{pctFmt(x.margin)}</td>
                <td>{pctFmt(x.profitOnCost)}</td>
                <td>{x.equityIrr === null ? '—' : pctFmt(x.equityIrr)}</td>
                <td>{formatCompactCurrency(x.peakLoan)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        עלויות שלא נכללו ולא ידועות (היטלי פיתוח, תשתיות, אגרות מעבר ל-12%):{' '}
        {t.budget.headroom.toTargetPerSqm >= 0
          ? `הפרויקט סופג עד כ-${formatCurrency(t.budget.headroom.toTargetPerSqm)} למ״ר מכר לפני שהרווח יורד מתחת ליעד, `
          : 'הרווח כבר מתחת ליעד בתנאים האלה; '}
        {t.budget.headroom.toZeroPerSqm >= 0
          ? `ועד כ-${formatCurrency(t.budget.headroom.toZeroPerSqm)} למ״ר לפני הפסד.`
          : 'והפרויקט כבר בהפסד.'}{' '}
        לא בדקנו ששטח המגורים בתכנית (11,209 מ״ר במגרש 149) מוגדר כמו השטח שבו נמדדים מחירי הדירות, ולא שמבני הציבור (325 מ״ר) נפרדים
        מהשטח העילי — לכן שתי השורות בטבלה. מבני הציבור מחושבים כולל מע״מ (לא ברור שהיזם יכול לקזז אותו).
      </p>
      <div className="table-scroll">
        <table className="compare-table">
          <caption>אחוז קומבינציה מקסימלי שמשאיר ליזם את יעד הרווח</caption>
          <thead>
            <tr>
              <th>עלות ישירה ליזם למ״ר מכר \ שווי דירה למ״ר</th>
              {t.matrix.apartmentPrices.map((p) => (
                <th key={p}>{formatCurrency(p)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.matrix.directCosts.map((d, i) => (
              <tr key={d}>
                <th>{formatCurrency(d)}</th>
                {t.matrix.cells[i].map((x, j) => (
                  <td key={j} className={x !== null && x >= combinationPct ? '' : 'cell-fail'}>
                    {cell(x)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="kv-table">
        <tbody>
          {t.participation.map((p) => (
            <tr key={p.share}>
              <th>רווח היזם במגרש אם {pctFmt(p.share)} ממכסת שירותי הבנייה ינוצלו</th>
              <td className={p.margin < 0 ? 'cell-fail' : ''}>{pctFmt(p.margin)}</td>
            </tr>
          ))}
          {t.project.lots.map((l) => (
            <tr key={l.lotId}>
              <th>
                מגרש {l.lotId} ({formatNumber(l.units, 0)} יח״ד)
              </th>
              <td className={l.margin < 0 ? 'cell-fail' : ''}>
                {formatCurrency(l.profit)} · {pctFmt(l.margin)}
              </td>
            </tr>
          ))}
          <tr className="row-total">
            <th>כל התכנית (שלושת המגרשים, {formatNumber(t.project.units, 0)} יח״ד)</th>
            <td className={t.project.margin < 0 ? 'cell-fail' : ''}>
              {formatCurrency(t.project.profit)} · {pctFmt(t.project.margin)}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

/**
 * Is there a % both sides can accept? The developer's highest viable % (lot model, target margin) against the offer
 * and the % this owner needs for a whole apartment — and, if they do not meet, what would have to change.
 */
function NegotiationRange({ result, combinationPct }: { result: DecisionResult; combinationPct: number }) {
  const pctFmt = (x: number) => `${formatNumber(x * 100, 1)}%`;
  const headline = result.arrangements.find((a) => a.combinationPct === combinationPct) ?? result.arrangements[1];
  const devMax = headline?.viablePct ?? null;
  const R = result.rights.apartmentEquivalents;
  const forWhole = R > 0 ? Math.min(1, Math.ceil(R * combinationPct + 1e-9) / R) : null;
  const t = result.developerThresholds;
  const overlap = devMax !== null && devMax >= combinationPct;
  return (
    <>
      <h3>טווח משא ומתן על אחוז הקומבינציה</h3>
      <table className="kv-table">
        <tbody>
          <tr>
            <th>המקסימום שהיזם יכול לפי המודל (רווח {pctFmt(t.targetMarginOnRevenue)})</th>
            <td>{devMax === null ? 'אין אחוז כזה' : pctFmt(devMax)}</td>
          </tr>
          <tr>
            <th>ההצעה שהזנתם</th>
            <td>{pctFmt(combinationPct)}</td>
          </tr>
          {forWhole !== null && (
            <tr>
              <th>האחוז שנותן לכם דירה שלמה נוספת</th>
              <td>{pctFmt(forWhole)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className={`callout ${overlap ? '' : 'callout-strong'}`}>
        {overlap
          ? 'ההצעה בתוך מה שהיזם יכול לפי המודל — יש טווח למשא ומתן.'
          : `ההצעה מעל מה שהיזם יכול לפי המודל. כדי שתשתלם לו היה צריך אחד מאלה: עלות בנייה ישירה של עד ${t.maxDirectCostPerSqm === null ? '—' : formatCurrency(t.maxDirectCostPerSqm)} למ״ר מכר, שווי דירה של לפחות ${t.minApartmentPricePerSqm === null ? '—' : formatCurrency(t.minApartmentPricePerSqm)} למ״ר, שתישאו ביותר מסים (עסקת ברוטו), או מימון זול יותר. ייתכן גם שהיזם מצפה לעליית מחירים — המודל לא מניח אותה.`}
      </p>
    </>
  );
}

function titleFor(result: DecisionResult, id?: string): string {
  const r = id ? result.results.find((x) => x.id === id) : undefined;
  return r ? strategyTitle(r) : '';
}

export { formatKnob, KNOB_LABELS, thresholdBound } from './thresholds';
import { formatKnob, KNOB_LABELS, thresholdBound } from './thresholds';

/** Routes whose outcome depends on a price nobody has verified: the price they would need — not an assumed price. */
export function PriceConditionalRoutes({ result }: { result: DecisionResult }) {
  if (!result.priceConditional.length) return null;
  const against = result.recommendation ? strategyTitle(result.recommendation) : null;
  return (
    <Section title="מסלולים שתלויים במחיר שעוד לא ידוע" sub="מכירה, תמורות ופיצוי כספי — כמה תצטרכו לקבל כדי שישתלמו" open>
      <p className="field-hint">
        אין מחיר שוק עדכני, הצעת יזם מאושרת או מחיר אחרי אישור התכנית. לכן לא מניחים מחיר — מחשבים את המחיר (המינימלי
        למה שתמכרו, המקסימלי למה שתקנו)
        {against ? <> שבו המסלול מתאים ליכולת שלכם ושווה לפחות כמו <strong>{against}</strong>.</> : ' שבו המסלול מתאים ליכולת שלכם (אין מסלול מבוסס-ראיות להשוות אליו).'}
      </p>
      <div className="table-scroll">
        <table className="kv-table">
          <tbody>
            {result.priceConditional.map(({ result: r, threshold: t }) => (
              <tr key={r.id}>
                <th>
                  {strategyTitle(r)}
                  <span className="summary-sub">{KNOB_LABELS[t.knob]}</span>
                </th>
                <td>
                  <strong>
                    {t.direction === 'min' && t.required !== null && t.required <= 0
                      ? t.against
                        ? 'משתלם בכל מחיר'
                        : 'ישים בכל מחיר — אין מסלול להשוות אליו; השוו לעוגני השווי'
                      : thresholdBound(t)}
                  </strong>
                  <span className="summary-sub">תרחיש היפותטי לשם השוואה בלבד: {formatKnob(t.knob, t.scenarioValue)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">כשתגיע הצעה אמיתית — השוו אותה לסף. הצעה מתחת לסף לא משתלמת לכם בהנחות האלה.</p>
    </Section>
  );
}

const LEVEL_LABELS = { observedTransaction: 'עסקה מדווחת', planningAppraisal: 'שמאות תכנונית', confirmedOffer: 'הצעה מאושרת', unknown: 'לא ידוע' } as const;

/** Land value references for the owner's area — dated and typed; never presented as today's market price. */
export function LandReferences({ result }: { result: DecisionResult }) {
  return (
    <Section title="השוואת שווי הקרקע" sub={`${formatArea(result.rights.landAreaSqm)} מ״ר בחלקה 33 — מה ידוע ומה לא`}>
      <div className="table-scroll">
        <table className="kv-table">
          <tbody>
            {result.landReferences.map((l) => (
              <tr key={l.label}>
                <th>
                  {l.label}
                  <span className="summary-sub">
                    {LEVEL_LABELS[l.level]} · {l.date} · {l.note}
                  </span>
                </th>
                <td>{l.amount === null ? <strong>טרם ידוע</strong> : formatCurrency(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        עסקאות עבר, שווי שמאי לאיזון והצעות עתידיות מודדים דברים שונים — אין להתייחס אליהם כמחיר השוק היום. במקום להניח
        מחיר, ״מסלולים שתלויים במחיר״ מחשב את המחיר שתצטרכו.
      </p>
    </Section>
  );
}

/** Optional long-term projection — illustrative, itemised. Never part of the primary verdict. */
export function ProjectionSection({ result }: { result: DecisionResult }) {
  const p = result.projection;
  if (!p) return null;
  const rows: [string, number][] = [
    ['דירות (ושאר נכסים) בסוף התקופה', p.assets],
    ['מזומן בסוף התקופה (כולל תשואה)', p.cash],
    ['פחות: יתרת משכנתא', -p.debt],
    ['פחות: החזרי משכנתא ששולמו (בערך עתידי)', -p.mortgagePaymentsFV],
    ['פחות: התחייבויות נדחות', -p.deferredLiabilities],
    ['פחות: תשלומים שאין להם מימון', -p.unfunded],
    ['פחות: הכסף הפנוי שהיה צובר ממילא', -p.startingCapitalGrown],
  ];
  return (
    <Section title="תחזית כלכלית ארוכת טווח" sub={`המחשה בלבד — ${p.years} שנים, ${formatNumber(p.apartmentGrowth * 100, 0)}% עליית ערך, ${formatNumber(p.alternativeReturn * 100, 0)}% תשואה, בשקלים של שנת היעד`}>
      <p className="field-hint">
        זו לא תחזית ולא סכום שתקבלו. ההנחות (עליית ערך דירות, תשואה על כסף) הן תרחיש. הדירות מוערכות לפי שווי שוק
        ולא לפי מכירה בפועל (בלי מס ועלויות מכירה).
      </p>
      <table className="kv-table">
        <tbody>
          {rows.map(([label, v]) => (
            <tr key={label}>
              <th>{label}</th>
              <td>{formatCurrency(v)}</td>
            </tr>
          ))}
          <tr className="row-total">
            <th>תוצאה משוערת</th>
            <td>{formatCurrency(p.total)}</td>
          </tr>
          <tr>
            <th>לא כלול (לא כסף): חיסכון בשכר דירה אם תגורו בדירה</th>
            <td>{formatCurrency(p.housingBenefit)}</td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}
