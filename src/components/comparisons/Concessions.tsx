/**
 * Iteration 10 / I6: what each concession is worth to you and what it costs the developer — the same route re-evaluated
 * on both sides — and what currently blocks the deal. Computed from the inputs the shown result was computed from.
 */
import { useMemo } from 'react';
import type { CommercialTerms, DecisionResult, ProjectConfig, StrategyResult, UserProfile } from '../../domain/types';
import { concessionFrontier, explainFeasibility, type BindingKind } from '../../optimizer/concessions';
import type { ContractTerms } from '../../optimizer/contract';
import { strategyTitle } from '../../optimizer/explain';
import { formatCompactCurrency, formatNumber } from '../../utils/format';
import { concessionRows, GainVsCost } from '../charts/outputs';

const BINDING: Record<BindingKind, string> = {
  financing_gap: 'פער מימון — אין מספיק כסף או יכולת החזר לתשלומים שבמסלול',
  missing_information: 'חסר מידע (למשל כמה כסף פנוי) — אי אפשר לקבוע שזה אפשרי',
  market_evidence: 'תלוי במחיר או במלאי דירות שלא אושרו',
  developer_hurdle: 'היזם מתחת ליעד הרווח (הנחה, לא כלל) — שאלה חוזית, לא שאלת מימון',
  developer_policy: 'מדיניות היזם (שירותי בנייה) — דורש הסכמה',
  physical: 'מגבלה פיזית (חלק דירה שלא נסגר, זכויות לא מספיקות)',
  goal: 'לא מתאים למה שחשוב לכם',
};

/** The route the card explains: the recommendation, else the best ranked, else the closest one that does not fit yet. */
export function concessionRoute(result: DecisionResult): StrategyResult | null {
  return result.recommendation ?? result.ranked[0] ?? result.nearMiss[0]?.result ?? result.results.find((r) => r.id === 'S02') ?? null;
}

export function ConcessionsCard({ route, profile, terms, config }: { route: StrategyResult; profile: UserProfile; terms: CommercialTerms; config: ProjectConfig }) {
  const data = useMemo(() => {
    const k0: ContractTerms = {
      arrangement: config.commercial.taxArrangement,
      combinationPct: terms.combinationPct,
      markup: terms.developerMarkup,
      offer: config.commercial.offer,
      funding: 'none',
    };
    try {
      const f = concessionFrontier(profile, k0, config, route.id);
      return { f, e: explainFeasibility(profile, k0, config, route.id, f) };
    } catch {
      return null;
    }
  }, [route.id, profile, terms, config]);
  if (!data) return null;
  const { f, e } = data;
  const money = (x: number | null) => (x === null ? '—' : formatCompactCurrency(x));
  return (
    <section className="card detail-section" aria-labelledby="concessions-title">
      <h2 id="concessions-title">ויתורים: כמה זה שווה לכם וכמה זה עולה ליזם</h2>
      <p className="card-sub">
        למסלול {strategyTitle(route)}: כל ויתור מחושב מחדש לשני הצדדים על אותו מסלול — הרווח לכם (ערך נוכחי, מחירי היום) מול
        העלות ליזם (ערך נוכחי של תזרים ההון שלו במגרש, באותה ריבית היוון). ״יעילות״ = כמה אתם מרוויחים על כל שקל שזה עולה ליזם.
      </p>
      <GainVsCost rows={concessionRows(f.rows)} />
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th>ויתור</th>
              <th>שווה לכם</th>
              <th>עולה ליזם</th>
              <th>יעילות</th>
              <th>אחרי הוויתור</th>
            </tr>
          </thead>
          <tbody>
            {f.rows
              .filter((r) => r.applicable)
              .map((r) => (
                <tr key={r.id}>
                  <th>
                    {r.label}
                    {r.scope === 'lot' && <span className="sub">תנאי אחיד לכל המגרש — העלות היא החלק שלכם (לכל המגרש: {money(r.developerCostLot)})</span>}
                  </th>
                  <td>{money(r.ownerGain)}</td>
                  <td>{money(r.developerCost)}</td>
                  <td>{r.efficiency === null ? (r.developerCost !== null && r.developerCost <= 0 ? 'לא עולה ליזם' : '—') : formatNumber(r.efficiency, 2)}</td>
                  <td className={r.executable && r.developerOk ? '' : 'cell-warn'}>
                    {r.executable ? 'אפשר לבצע' : 'עדיין לא אפשר לבצע'}
                    {r.developerMargin !== null && <span className="sub">רווח היזם {formatNumber(r.developerMargin * 100, 1)}%{r.developerOk ? '' : ' — מתחת ליעד'}</span>}
                    {r.note && <span className="sub">{r.note}</span>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <h3>מה חוסם עכשיו</h3>
      {e.binding.length ? (
        <ul>
          {e.binding.map((b) => (
            <li key={b.kind}>{BINDING[b.kind]}</li>
          ))}
        </ul>
      ) : (
        <p>שום אילוץ שנבדק לא חוסם את המסלול הזה בתנאים האלה.</p>
      )}
      {e.binding.length > 0 &&
        (e.closingConcessions.length ? (
          <p>
            ויתור אחד שנבדק לשני הצדדים ופותר את זה: {e.closingConcessions.map((c) => c.label).join('; או ')}.
          </p>
        ) : (
          <p>אף ויתור אחד מהרשימה לא פותר את זה לבד, לשני הצדדים יחד. זה לא אומר שאין הסכם — רק שבבדיקה הזו לא נמצא; שילובים לא נבדקו.</p>
        ))}
      <p className="field-hint">
        יעילות אינה הבטחת רווח: סיכון אשראי, עלות מימון והגדלת מס (gross-up) נכנסים רק כפי שמודלו. עוד לא ידוע: כמה שווה לכם לא לחתום,
        והאם יעד הרווח של היזם הוא הדרישה האמיתית שלו; מחירים שמסומנים כהשערה אינם עובדה.
      </p>
    </section>
  );
}
