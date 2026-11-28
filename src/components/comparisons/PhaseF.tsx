/**
 * Iteration 9 / phase F — two advanced-view cards:
 *  - ContingentCard: fixed routes vs "combination now, switch after approval if financed" — values per state, regret.
 *  - GroupPlanner: an anonymous group of owners in one lot — who takes the services slots and who pools fractions so
 *    that the shared resources fit and nobody is worse off than alone. Inputs are typed here, never saved or sent.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CommercialTerms, DecisionResult, Goal, ProjectConfig, StrategyResult, UserProfile } from '../../domain/types';
import { contingentPlan } from '../../optimizer/contingent';
import { GOAL_LABELS, strategyTitle } from '../../optimizer/explain';
import { fingerprint } from '../../optimizer/contract';
import { MAX_MEMBERS, planGroup, type GroupMember, type GroupResult, type MemberStatus } from '../../optimizer/group/collective';
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
  { label: 'בעלים 2', landAreaSqm: 167, availableCapital: 300_000, maxMonthlyRepayment: 5000, goal: 'balanced' },
  { label: 'בעלים 3', landAreaSqm: 167, availableCapital: 800_000, maxMonthlyRepayment: 6000, goal: 'maximize_apartments' },
  { label: 'בעלים 4', landAreaSqm: 167, availableCapital: 2_000_000, maxMonthlyRepayment: 15000, goal: 'balanced' },
];
const GOALS: Goal[] = ['balanced', 'maximize_apartments', 'minimize_risk', 'immediate_cash', 'passive_income'];
const STATUS: Record<MemberStatus, string> = {
  at_or_above_reservation: 'לפחות כמו המסלול שלו בלי משאבים משותפים',
  no_reservation_option: 'אין לו מסלול בלי משאב משותף — אין הבטחה שלא ייפגע',
  outside_option: 'לא נכנס לתכנון: נשאר בלי הסכם (ערך לא ידוע)',
};
const FUNDING: Record<string, string> = { none: 'בלי מימון למסים', developer_loan: 'הלוואת מסים מהיזם לכל הקבוצה', other_property: 'הלוואה על נכס אחר' };

export function GroupPlanner({ terms, config, lotId }: { terms: CommercialTerms; config: ProjectConfig; lotId: string }) {
  const [members, setMembers] = useState<GroupMember[]>(DEFAULT_GROUP);
  const [slots, setSlots] = useState(1);
  const [state, setState] = useState<{ key: string; res: GroupResult } | { key: string; error: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = fingerprint({ members, slots, terms, lotId, arrangement: config.commercial.taxArrangement, offer: config.commercial.offer, v: config.version });
  const latest = useRef(key);
  useEffect(() => {
    latest.current = key;
  }, [key]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const update = (i: number, patch: Partial<GroupMember>) => setMembers((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const run = () => {
    const runKey = key;
    setBusyKey(runKey);
    if (timer.current) clearTimeout(timer.current);
    // A run started on older inputs is discarded (the inputs changed while it waited).
    timer.current = setTimeout(() => {
      timer.current = null;
      if (latest.current !== runKey) return setBusyKey(null);
      try {
        const ctx = { lotId, members, slotsAvailable: slots, terms, offer: config.commercial.offer, arrangement: config.commercial.taxArrangement };
        const res = planGroup(ctx, (r: StrategyResult) => strategyTitle(r), config);
        if (latest.current === runKey) setState({ key: runKey, res });
      } catch (e) {
        setState({ key: runKey, error: (e as Error).message });
      }
      setBusyKey(null);
    }, 30);
  };
  const current = state && state.key === key ? state : null;
  const res = current && 'res' in current ? current.res : null;
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v.replace(/[^\d.]/g, '')) || 0));
  return (
    <section className="card detail-section" aria-labelledby="group-title">
      <h2 id="group-title">תכנון קבוצתי — כמה בעלים באותו מגרש</h2>
      <p className="card-sub">
        בעלים באותו מגרש (מגרש {lotId}, כמו בנתונים שלכם) מתחרים על מקומות לשירותי בנייה, ויחידת סל נמכרת רק בדירות שלמות. כאן
        אפשר להזין קבוצה אנונימית (ללא שמות) ולבדוק חלוקה על אותם תנאי חוזה לכולם. הנתונים לא נשמרים ולא נשלחים.
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
                  <button type="button" className="link-btn" aria-label={`הסרת ${m.label}`} onClick={() => setMembers((x) => x.filter((_, j) => j !== i))}>
                    הסרה
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chip-row">
        {members.length < MAX_MEMBERS && (
          <button
            type="button"
            className="btn-chip"
            onClick={() => setMembers((x) => [...x, { label: `בעלים ${x.length + 1}`, landAreaSqm: 167, availableCapital: 300_000, maxMonthlyRepayment: 5000, goal: 'balanced' }])}
          >
            הוספת בעלים
          </button>
        )}
        <label className="inline-field">
          מקומות פנויים לשירותי בנייה לקבוצה (אחרי התחייבויות לאחרים){' '}
          <input aria-label="מקומות פנויים לשירותי בנייה" inputMode="numeric" value={slots} onChange={(e) => setSlots(Math.floor(num(e.target.value) ?? 0))} />
        </label>
      </div>
      {state && !current && <p className="field-hint">הנתונים השתנו מאז החישוב הקודם — התוצאה הוסתרה. חשבו מחדש.</p>}
      <button type="button" className="btn-secondary" onClick={run} disabled={busyKey === key || members.length === 0}>
        {busyKey === key ? 'מחשב…' : 'תכנון קבוצתי'}
      </button>
      {current && 'error' in current && <p className="field-error">{current.error}</p>}
      {res && <GroupOutcome res={res} />}
    </section>
  );
}

function GroupOutcome({ res }: { res: GroupResult }) {
  const p = res.pool;
  return (
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
                <td>{m.alone ? m.alone.title : 'אין מסלול מתאים בתנאים האלה'}</td>
                <td className={m.status === 'at_or_above_reservation' && m.chosen?.rank === 0 ? '' : 'cell-warn'}>
                  {m.chosen ? m.chosen.title : 'אין מסלול בתכנון הזה'}
                  {m.chosen && m.chosen.rank > 0 && <span className="sub">בחירה {m.chosen.rank + 1} שלו — כדי שהקבוצה תסתדר</span>}
                  {m.chosen && m.chosen.poolShare > 0 && (
                    <span className="sub">
                      ביחידת סל: {formatNumber(m.chosen.poolShare, 2)} דירה, מהן נמכרות {formatNumber(m.chosen.poolShare * p.soldFraction, 2)}
                      {m.chosenValue !== null && m.chosenValue < m.chosen.value - 1000 ? ` (ערך ${formatCompactCurrency(m.chosenValue)} — לא ${formatCompactCurrency(m.chosen.value)})` : ''}
                    </span>
                  )}
                  {m.chosen && m.chosen.slots > 0 && <span className="sub">תופס {m.chosen.slots} מקום לשירותי בנייה</span>}
                  <span className="sub">{STATUS[m.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        {res.uncoordinated.feasible ? 'גם לבד כל אחד היה מסתדר. ' : `לבד זה לא מסתדר: ${res.uncoordinated.problems.join('; ')}. `}
        חוזה אחד לכולם: {ARR_NAMES[res.contract.arrangement]}, קומבינציה {formatNumber(res.contract.combinationPct * 100, 1)}%, {FUNDING[res.contract.funding]}. בתכנון:{' '}
        {res.assigned} מתוך {res.members.length} נכנסים; {res.firstChoices} מקבלים את הבחירה הראשונה שלהם; {res.slotsUsed} מתוך {res.slotsAvailable} מקומות
        לשירותי בנייה.
        {p.shares > 0
          ? ` יחידת סל: ${formatNumber(p.shares, 2)} חלקי דירה → ${p.units} דירות שלמות נמכרות (${formatCompactCurrency(p.proceeds)} נטו, לפני מס), כל אחד מקבל רק את חלקו היחסי.${p.residualShares > 0.01 ? ` עוד ${formatNumber(p.residualShares, 2)} דירה לא נמכרת — נשארת חלק לא סחיר (שווי ברוטו כ-${formatCompactCurrency(p.residualValueGross)}), בלי כסף אלא אם נמצא קונה או שהיזם קונה.` : ''}`
          : ' בלי יחידת סל.'}
      </p>
      <p className={`field-hint ${res.developer.ok ? '' : 'cell-fail'}`}>
        רווח היזם במגרש עם כל המסלולים של הקבוצה יחד:{' '}
        {res.developer.margin === null ? 'לא חושב (אף אחד לא נכנס)' : `${formatNumber(res.developer.margin * 100, 1)}% מההכנסות`}
        {res.developer.margin !== null && (res.developer.ok ? ' — לפחות ביעד.' : ` — מתחת ליעד של ${formatNumber(res.developer.hurdle * 100, 1)}%, ולכן התכנון הזה לא סגור מול היזם.`)}
      </p>
      <p className="field-hint">
        {res.fairness.holdsForAll
          ? 'כל אחד מקבל לפחות את מה שהיה מקבל במסלול בלי משאבים משותפים. '
          : `הבטחה שאף אחד לא ייפגע אינה מתקיימת לכולם: ${res.fairness.outside ? `${res.fairness.outside} בלי מסלול בתכנון` : ''}${res.fairness.outside && res.fairness.noReservation ? ', ' : ''}${res.fairness.noReservation ? `${res.fairness.noReservation} בלי מסלול עצמאי להשוואה` : ''}. `}
        השוואה מול ״בלי הסכם״ לא אפשרית — אין מחיר קרקע עדכני. נבדקו עד {res.search.maxOptions} מסלולים לכל בעלים (ועוד המסלול העצמאי שלו), {res.search.explored.toLocaleString('he-IL')} חלוקות
        {res.search.truncated ? ' — החיפוש נעצר בגבול שלו' : ''}; זו לא הוכחה שאין חלוקה טובה יותר. העברת זכויות בין בעלים לא מוצעת כאן — המחיר לא
        ידוע. כל הסכם כזה צריך הסכם שיתוף ועורך דין.
      </p>
    </>
  );
}

const ARR_NAMES: Record<string, string> = { gross: 'עסקת ברוטו', mixed: 'עסקה מעורבת', net: 'עסקת נטו' };
