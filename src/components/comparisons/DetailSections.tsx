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
import { StatusBadge } from '../verdict/Verdict';

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
  const rejected = result.results.filter((r) => r.feasibility === 'infeasible');
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
                  .filter((c) => ['NO_BORROWING_CAPACITY', 'REPAYMENT_EXCEEDED', 'LTV_EXCEEDED'].includes(c))
                  .map((c) => REASON_TEXT[c])
                  .join(' ')}
              </li>
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
        <table className="compare-table strategy-table">
          <thead>
            <tr>
              <th>מסלול</th>
              <th>מצב</th>
              <th>דירות שלמות</th>
              <th>זכויות שנמכרות</th>
              <th>משכנתא</th>
              <th>החזר חודשי</th>
              <th>כסף נטו תוך שנתיים</th>
              <th>שווי נטו שנוצר (10 שנים)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === result.recommendation?.id ? 'row-recommended' : ''}>
                <td>{strategyTitle(r)}</td>
                <td>
                  <StatusBadge r={r} />
                </td>
                <td>{r.metrics.wholeApartments}</td>
                <td>{formatRights(r.rightsSold)}</td>
                <td>{r.mortgageRequired > 1 ? formatCurrency(r.mortgageRequired) : '—'}</td>
                <td>{r.monthlyRepayment > 1 ? formatCurrency(r.monthlyRepayment) : '—'}</td>
                <td>{formatCurrency(r.metrics.liquidity)}</td>
                <td>{formatCurrency(r.metrics.valueCreated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        ״שווי נטו שנוצר״ = הון בעוד 10 שנים (דירות, כסף, קרקע) פחות חובות, החזרי משכנתא ומסים עתידיים — מעבר למה
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
        שכר דירה לא משמש לתשלומים בזמן הבנייה — רק אחרי שהדירה קיימת. זכויות שנמכרו לא נספרות גם כבטוחה. אישור
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

function formatCurrent(t: NegotiationTarget): string {
  if (t.current === undefined) return '';
  return `הנחה נוכחית: ${formatTarget({ ...t, value: t.current })}`;
}

export function NegotiationPanel({ result }: { result: DecisionResult }) {
  const groups = new Map<string, NegotiationTarget[]>();
  for (const t of result.negotiationTargets) {
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
                    {t.code === 'MIN_COMBINATION_PCT' && t.note && (
                      <span className="muted"> (ל-{t.note === '1' ? 'דירה שלמה אחת' : `${t.note} דירות`})</span>
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
        השתמשו בספים כדי לבדוק הצעות כשיגיעו: הצעה שמתחת למחיר המינימלי, או מעל עלות הבנייה המקסימלית, לא תתאים
        ליכולת שהזנתם.
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
