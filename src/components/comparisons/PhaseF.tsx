/**
 * Iteration 9 / phase F — two advanced-view cards:
 *  - ContingentCard: fixed routes vs "combination now, switch after approval if financed" — values per state, regret.
 *  - GroupPlanner: an anonymous group of owners in one lot — who takes the services slots and who pools fractions so
 *    that the shared resources fit and nobody is worse off than alone. Inputs are typed here, never saved or sent.
 */
import { useMemo, useState } from 'react';
import type { CommercialTerms, DecisionResult, Goal, ProjectConfig, StrategyResult, UserProfile } from '../../domain/types';
import { contingentPlan } from '../../optimizer/contingent';
import { GOAL_LABELS, strategyTitle } from '../../optimizer/explain';
import { planGroup, type GroupMember, type GroupResult } from '../../optimizer/group/collective';
import { formatCompactCurrency, formatNumber } from '../../utils/format';

const money = (x: number | null) => (x === null ? 'לא ניתן' : formatCompactCurrency(x));

export function ContingentCard({ result, profile, terms, config }: { result: DecisionResult; profile: UserProfile; terms: CommercialTerms; config: ProjectConfig }) {
  const plan = useMemo(() => contingentPlan(result, profile, terms, config), [result, profile, terms, config]);
  if (!plan.rows.length) return null;
  const title = (id: string) => {
    const r = result.results.find((x) => x.id === id);
    return r ? strategyTitle(r) : id;
  };
  return (
    <section className="card detail-section" aria-labelledby="contingent-title">
      <h2 id="contingent-title">חוזה עם אופציה — מה קורה בכל מצב</h2>
      <p className="card-sub">
        שלושה מצבים שאי אפשר לדעת בחתימה. במקום להמר על אחד: חוזה קומבינציה עכשיו, עם אפשרות לעבור למסלול אחר אחרי האישור —
        רק אם המימון אושר. ״חרטה״ = כמה פחות מהבחירה הטובה ביותר באותו מצב. בלי הסתברויות.
      </p>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th>חוזה</th>
              <th>התכנית לא מאושרת (חשיפה מרבית)</th>
              <th>מאושרת ויש מימון</th>
              <th>מאושרת בלי מימון</th>
              <th>חרטה מרבית</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.label}>
                <th>
                  {r.optionRouteId ? (
                    <>
                      {title(r.routeId)}, ואופציה ל{title(r.optionRouteId)}
                    </>
                  ) : (
                    title(r.routeId)
                  )}
                </th>
                <td>{r.noApprovalExposure > 1000 ? formatCompactCurrency(r.noApprovalExposure) : 'אין'}</td>
                <td>
                  {money(r.financed)}
                  {r.fellBackFinanced && r.financed !== null && <span className="sub">חוזר לקומבינציה</span>}
                </td>
                <td>
                  {money(r.noFinancing)}
                  {r.fellBackNoFinancing && r.noFinancing !== null && <span className="sub">חוזר לקומבינציה</span>}
                </td>
                <td className={Number.isFinite(r.maxRegret) && r.maxRegret < 1000 ? '' : 'cell-fail'}>
                  {Number.isFinite(r.maxRegret) ? (r.maxRegret < 1000 ? 'אין' : formatCompactCurrency(r.maxRegret)) : 'לא ניתן באחד המצבים'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        ערכים: ערך נוכחי במחירי היום, כמו בהשוואה הראשית. ״בלי מימון״: בלי משכנתא, בלי הלוואה על נכס אחר ובלי הלוואת מסים. מסלול
        שלא ניתן לבצע במצב מסוים חוזר לקומבינציה המלאה. אופציה כזו צריכה את הסכמת היזם וייתכן שיהיה לה מחיר — לא הנחנו אותו.
      </p>
    </section>
  );
}

const DEFAULT_GROUP: GroupMember[] = [
  { label: 'בעלים 1', landAreaSqm: 167, availableCapital: 0, maxMonthlyRepayment: 0, goal: 'minimize_risk' },
  { label: 'בעלים 2', landAreaSqm: 167, availableCapital: 300_000, maxMonthlyRepayment: 5000, goal: 'maximize_apartments' },
  { label: 'בעלים 3', landAreaSqm: 167, availableCapital: 800_000, maxMonthlyRepayment: 6000, goal: 'maximize_apartments' },
  { label: 'בעלים 4', landAreaSqm: 167, availableCapital: 2_000_000, maxMonthlyRepayment: 15000, goal: 'balanced' },
];
const GOALS: Goal[] = ['balanced', 'maximize_apartments', 'minimize_risk'];

export function GroupPlanner({ terms, config }: { terms: CommercialTerms; config: ProjectConfig }) {
  const [members, setMembers] = useState<GroupMember[]>(DEFAULT_GROUP);
  const [slots, setSlots] = useState(1);
  const [res, setRes] = useState<GroupResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (i: number, patch: Partial<GroupMember>) => {
    setRes(null);
    setMembers((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  };
  const run = () => {
    setBusy(true);
    setError(null);
    setTimeout(() => {
      try {
        setRes(planGroup(members, terms, slots, (r: StrategyResult) => strategyTitle(r), config));
      } catch (e) {
        setError((e as Error).message);
      }
      setBusy(false);
    }, 30);
  };
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v.replace(/[^\d.]/g, '')) || 0));
  return (
    <section className="card detail-section" aria-labelledby="group-title">
      <h2 id="group-title">תכנון קבוצתי — כמה בעלים באותו מגרש</h2>
      <p className="card-sub">
        בעלים באותו מגרש מתחרים על מקומות לשירותי בנייה, ויחידת סל נוצרת רק כשחלקי הדירות מגיעים לדירה שלמה. כאן אפשר להזין
        קבוצה אנונימית (ללא שמות) ולראות איזה חלוקה מתאימה לכולם — בלי שאף אחד יקבל פחות ממה שהיה מקבל לבד. הנתונים לא נשמרים
        ולא נשלחים.
      </p>
      <div className="table-scroll">
        <table className="compare-table group-inputs">
          <thead>
            <tr>
              <th>בעלים</th>
              <th>מ״ר</th>
              <th>כסף פנוי</th>
              <th>החזר חודשי</th>
              <th>מה חשוב</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={i}>
                <th>{m.label}</th>
                <td>
                  <input aria-label={`${m.label} — מ״ר`} inputMode="decimal" value={m.landAreaSqm} onChange={(e) => update(i, { landAreaSqm: num(e.target.value) ?? 0 })} />
                </td>
                <td>
                  <input aria-label={`${m.label} — כסף פנוי`} inputMode="numeric" value={m.availableCapital ?? ''} onChange={(e) => update(i, { availableCapital: num(e.target.value) })} />
                </td>
                <td>
                  <input aria-label={`${m.label} — החזר חודשי`} inputMode="numeric" value={m.maxMonthlyRepayment ?? ''} onChange={(e) => update(i, { maxMonthlyRepayment: num(e.target.value) })} />
                </td>
                <td>
                  <select aria-label={`${m.label} — מה חשוב`} value={m.goal} onChange={(e) => update(i, { goal: e.target.value as Goal })}>
                    {GOALS.map((g) => (
                      <option key={g} value={g}>
                        {GOAL_LABELS[g]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button type="button" className="link-btn" aria-label={`הסרת ${m.label}`} onClick={() => (setRes(null), setMembers((x) => x.filter((_, j) => j !== i)))}>
                    הסרה
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chip-row">
        {members.length < 8 && (
          <button
            type="button"
            className="btn-chip"
            onClick={() => (setRes(null), setMembers((x) => [...x, { label: `בעלים ${x.length + 1}`, landAreaSqm: 167, availableCapital: 300_000, maxMonthlyRepayment: 5000, goal: 'balanced' }]))}
          >
            הוספת בעלים
          </button>
        )}
        <label className="inline-field">
          מקומות פנויים לשירותי בנייה לקבוצה{' '}
          <input aria-label="מקומות פנויים לשירותי בנייה" inputMode="numeric" value={slots} onChange={(e) => (setRes(null), setSlots(num(e.target.value) ?? 0))} />
        </label>
      </div>
      <button type="button" className="btn-secondary" onClick={run} disabled={busy || members.length === 0}>
        {busy ? 'מחשב…' : 'תכנון קבוצתי'}
      </button>
      {error && <p className="field-error">{error}</p>}
      {res && (
        <>
          <div className="table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>בעלים</th>
                  <th>לבד היה בוחר</th>
                  <th>בתכנון הקבוצתי</th>
                </tr>
              </thead>
              <tbody>
                {res.members.map((m, i) => (
                  <tr key={i}>
                    <th>{m.member.label}</th>
                    <td>{m.alone ? `${m.alone.title}${m.alone.condition ? ` (${m.alone.condition})` : ''}` : 'אין מסלול מתאים'}</td>
                    <td className={m.chosen && m.chosen.rank === 0 ? '' : 'cell-warn'}>
                      {m.chosen ? `${m.chosen.title}${m.chosen.condition ? ` (${m.chosen.condition})` : ''}` : 'אין מסלול בתכנון הזה'}
                      {m.chosen && m.chosen.rank > 0 && <span className="sub">בחירה {m.chosen.rank + 1} שלו — כדי שהקבוצה תסתדר</span>}
                      {m.chosen && m.chosen.poolShare > 0 && <span className="sub">מצטרף ליחידת סל ({formatNumber(m.chosen.poolShare, 2)} דירה)</span>}
                      {m.chosen && m.chosen.slots > 0 && <span className="sub">תופס מקום לשירותי בנייה</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field-hint">
            {res.uncoordinated.feasible ? 'גם לבד כל אחד היה מסתדר. ' : `לבד זה לא מסתדר: ${res.uncoordinated.problems.join('; ')}. `}
            בתכנון: {res.firstChoices} מתוך {res.members.length} מקבלים את הבחירה הראשונה שלהם; {res.slotsUsed} מתוך {res.slotsAvailable} מקומות לשירותי בנייה;
            {res.pool.shares > 0 ? ` יחידת סל: ${formatNumber(res.pool.shares, 2)} דירה (${res.pool.units} שלמות${res.pool.leftover > 0.01 ? `, ועוד ${formatNumber(res.pool.leftover, 2)} שצריך לסדר — קנייה של היזם או בעלים נוספים` : ''}).` : ' בלי יחידת סל.'}{' '}
            אף אחד לא מקבל פחות ממה שהיה מקבל בלי משאבים משותפים. העברת זכויות בין בעלים לא מוצעת כאן — המחיר לא ידוע. כל הסכם כזה
            צריך הסכם שיתוף ועורך דין.
          </p>
        </>
      )}
    </section>
  );
}
