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
import { formatCurrency, formatNumber } from '../../utils/format';
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
              <th>רווח כלכלי (10 שנים)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === result.recommendation?.id ? 'row-recommended' : ''}>
                <td className="cell-title">
                  {strategyTitle(r)}
                  {r.id === result.recommendation?.id && <span className="kind-tag">מומלץ</span>}
                </td>
                <td data-label="יכולת · עמידות · יזם">
                  <AssessmentChips r={r} compact />
                </td>
                <td data-label="דירות שלמות">{r.metrics.wholeApartments}</td>
                <td data-label="זכויות שנמכרות">{formatRights(r.rightsSold)}</td>
                <td data-label="משכנתא">{r.mortgageRequired > 1 ? formatCurrency(r.mortgageRequired) : '—'}</td>
                <td data-label="החזר חודשי">{r.monthlyRepayment > 1 ? formatCurrency(r.monthlyRepayment) : '—'}</td>
                <td data-label="כסף נטו תוך שנתיים">{formatCurrency(r.metrics.liquidity)}</td>
                <td data-label="רווח כלכלי (10 שנים)">{formatCurrency(r.metrics.valueCreated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        ״רווח כלכלי״ = הון בעוד 10 שנים (דירות, כסף, קרקע) פחות חובות, החזרי משכנתא ומסים עתידיים — מעבר למה
        שהכסף הפנוי שלכם היה צובר בלאו הכי. כולל שכר דירה (או חיסכון בשכר דירה) מהדירות שנשארות.
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
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        עלויות הבנייה כוללות מע״מ, רווח יזמי, רזרבה של 10% לבלתי צפוי והצמדה של 3% בשנה. היטל ההשבחה מוערך מטבלת
        האיזון (50% מעליית השווי); כל זכות נושאת היטל פעם אחת בלבד. מס שבח — רזרבה על הרווח, לא על התמורה ברוטו.
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
        מסים, היטל ועלויות עסקה משולמים מכסף פנוי — בנקים לא מממנים אותם. לפני המסירה הבטוחה היא הקרקע שנשארת
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{strategyTitle(r)}</td>
                {r.scenarioResults.map((s) => (
                  <td key={s.scenarioId} className={s.feasible ? '' : 'cell-fail'}>
                    {formatCurrency(s.valueCreated)}
                    {!s.feasible && <span className="muted"> · לא עומד</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        אופטימי: דירה ₪28,000 למ״ר, ריבית 4%, 3 שנים. שמרני: דירה ₪21,000 למ״ר, חריגה של 15% בבנייה, ריבית 7%, 8
        שנים, מחיר זכויות −25%, היטל +25%. אחוז הקומבינציה והרווח היזמי נשארים כפי שבחרתם. אלה תרחישי לחץ — לא
        תחזית.
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
      <h3>כלכלת העסקה מבחינת היזם</h3>
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
            <th>מס שבח שהיזם משלם עבורכם בעסקת נטו (כולל גילום)</th>
            <td>{formatCurrency(d.combinationTaxCost)}</td>
          </tr>
          <tr>
            <th>רווח משוער ליזם בקומבינציה של {pctFmt(combinationPct)}</th>
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
            <th>אחוז קומבינציה מקסימלי שמשאיר ליזם רווח של 15%</th>
            <td>{pctFmt(d.maxCombinationAtTargetMargin)}</td>
          </tr>
        </tbody>
      </table>
      <p className="field-hint">
        מודל אינדיקטיבי: הכנסות מכירה ללא מע״מ, עלות בנייה ישירה של ₪11,000 למ״ר, 12% עלויות רכות, היטל השבחה, ומע״מ
        על שירותי הבנייה לבעלים בקומבינציה. ״רווח יזמי״ בסליידר הוא תוספת על שירותי בנייה בלבד — כאן מדובר ברווח על
        הפרויקט כולו. אם יזם מציע בפועל קומבינציה גבוהה מהמקסימום, כנראה שעלויות הבנייה שלו נמוכות מההנחה — ואז גם מחיר
        הקרקע שהוא יכול לשלם גבוה יותר. זו הערכה, לא הצעה.
      </p>
    </Section>
  );
}
