/**
 * Iteration 9 / phase E: "terms that work for both sides" — on demand (it runs the owner check on ~33 contracts), in the
 * advanced view only. Shows where each side accepts, the overlap, or the gap and the single levers that would close it.
 */
import { useState } from 'react';
import { PROJECT_CONFIG } from '../../data/config';
import type { CommercialTerms, TaxArrangement, UserProfile } from '../../domain/types';
import { jointSearch, type JointResult } from '../../optimizer/joint/search';
import { formatCompactCurrency, formatCurrency, formatNumber } from '../../utils/format';

const ARR_LABELS: Record<TaxArrangement, string> = {
  gross: 'עסקת ברוטו (אתם משלמים מס שבח והיטל)',
  mixed: 'עסקה מעורבת (היזם משלם את ההיטל)',
  net: 'עסקת נטו (היזם משלם מס שבח והיטל)',
};
const pct = (x: number) => `${formatNumber(x * 100, 1)}%`;
const range = (r: [number, number][]) => (r.length ? r.map(([a, b]) => (a === b ? pct(a) : `${pct(a)} עד ${pct(b)}`)).join(', ') : 'אף אחוז בטווח');

export function JointSearch({ profile, terms, offer }: { profile: UserProfile; terms: CommercialTerms; offer: { levyCap: number | null; developerPaysTaxLoanInterest: boolean } }) {
  const [res, setRes] = useState<JointResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    // Let the button show "מחשב…" before the (synchronous) search runs.
    setTimeout(() => {
      const config = { ...PROJECT_CONFIG, commercial: { ...PROJECT_CONFIG.commercial, offer } };
      setRes(jointSearch(profile, terms, config));
      setBusy(false);
    }, 30);
  };
  return (
    <section className="card detail-section" aria-labelledby="joint-title">
      <h2 id="joint-title">תנאים שמתאימים לשני הצדדים</h2>
      <p className="card-sub">
        לכל אחוז קומבינציה (בטווח הסליידר) ולכל הסדר מס: האם יש לכם מסלול שתוכלו לממן, והאם היזם נשאר מעל יעד הרווח
        ({pct(PROJECT_CONFIG.developer.targetMarginOnRevenue)} מההכנסות — הנחה, לא כלל). חישוב לפי המודל, לא הצעה.
      </p>
      {!res && (
        <button type="button" className="btn-secondary" onClick={run} disabled={busy}>
          {busy ? 'מחשב…' : 'חיפוש תנאים'}
        </button>
      )}
      {res && (
        <>
          {res.frontier.length > 0 ? (
            <div className="callout">
              <strong>יש תנאים שמתאימים לשניכם:</strong>
              <ul>
                {res.frontier.map((f) => (
                  <li key={`${f.arrangement}-${f.combinationPct}`}>
                    {ARR_LABELS[f.arrangement]}, קומבינציה {pct(f.combinationPct)} — {routeLabel(f.owner.routeId)}; רווח היזם {pct(f.developer.margin)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="callout callout-strong">
              <strong>אין בטווח הזה תנאים שמתאימים לשניכם.</strong> מה היה צריך להשתנות — לכל הסדר מס:
            </div>
          )}
          <div className="table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>הסדר מס</th>
                  <th>מתאים לכם</th>
                  <th>מתאים ליזם</th>
                  <th>לשניכם</th>
                </tr>
              </thead>
              <tbody>
                {res.arrangements.map((a) => (
                  <tr key={a.arrangement}>
                    <th>{ARR_LABELS[a.arrangement]}</th>
                    <td>{range(a.ownerOk)}</td>
                    <td>
                      {range(a.developerOk)}
                      <span className="sub">עד {a.developerMaxExact === null ? '— אף אחוז' : pct(a.developerMaxExact)} בדיוק</span>
                    </td>
                    <td className={a.both.length ? '' : 'cell-fail'}>{a.both.length ? range(a.both) : 'אין'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res.frontier.length === 0 && (
            <ul className="joint-gaps">
              {res.arrangements.map((a) => {
                const g = a.gap;
                if (!g) return null;
                const parts: string[] = [];
                if (g.ownerMin !== null && g.developerMax !== null && g.ownerMin > g.developerMax)
                  parts.push(`אתם צריכים לפחות ${pct(g.ownerMin)}, והיזם עומד ביעד רק עד ${pct(g.developerMax)} — פער של ${formatNumber((g.ownerMin - g.developerMax) * 100, 1)} נקודות`);
                else if (g.ownerMin === null) parts.push('אין אחוז בטווח שבו תוכלו לממן מסלול');
                else if (g.developerMax === null) parts.push('היזם לא עומד ביעד הרווח באף אחוז');
                if (g.atOwnerMin) {
                  const levers = [
                    `היזם מסתפק ברווח של ${pct(g.atOwnerMin.margin)} (במקום ${pct(res.targetMargin)})`,
                    g.atOwnerMin.maxDirectCostPerSqm !== null ? `עלות בנייה ליזם עד ${formatCurrency(g.atOwnerMin.maxDirectCostPerSqm)} למ״ר מכר` : null,
                    g.atOwnerMin.minApartmentPricePerSqm !== null ? `מחיר דירה של ${formatCurrency(g.atOwnerMin.minApartmentPricePerSqm)} למ״ר` : null,
                  ].filter(Boolean);
                  parts.push(`ב-${pct(g.ownerMin!)} זה יעבוד ליזם אם: ${levers.join(', או ')}`);
                }
                if (g.atDeveloperMax && g.atDeveloperMax.extraCapital !== null)
                  parts.push(`ב-${pct(g.atDeveloperMax.combinationPct)} זה יעבוד לכם עם עוד כ-${formatCompactCurrency(Math.ceil(g.atDeveloperMax.extraCapital / 1000) * 1000)} הון עצמי`);
                return (
                  <li key={a.arrangement}>
                    <strong>{ARR_LABELS[a.arrangement]}:</strong> {parts.join('. ')}.
                  </li>
                );
              })}
            </ul>
          )}
          <p className="field-hint">
            ״מתאים לכם״: יש מסלול שלא תלוי במחיר לא ידוע ושאתם יכולים לממן{profile.goal === 'maximize_apartments' ? ', ושמסתיים בדירה שלמה' : ''}.
            ״מתאים ליזם״: רווח המגרש לפחות ביעד — רווח שווה לרווח היום אינו מספיק אם הוא מתחת ליעד. כל מנוף נבדק לבד; בפועל
            אפשר לשלב. מחירים ועלויות כאן הם ספים מחושבים, לא נתוני שוק.
          </p>
          <button type="button" className="link-btn" onClick={() => setRes(null)}>
            חישוב מחדש
          </button>
        </>
      )}
    </section>
  );
}

/** A short label from a route id (the search keeps ids, not full results). */
function routeLabel(id: string | null): string {
  if (!id) return '—';
  const labels: Record<string, string> = {
    S02: 'קומבינציה מלאה',
    S02P: 'קומבינציה מלאה ויחידת סל',
    S06: 'קומבינציה והשלמה בתשלום',
    S11: 'קומבינציה על חלק ושירותי בנייה על השאר',
    S14: 'קומבינציה והשכרה',
    S03: 'שירותי בנייה',
    S07: 'שירותי בנייה ומכירת דירה במסירה',
    S08: 'שירותי בנייה והשכרה',
  };
  const [type, n] = id.split('-');
  return `${labels[type] ?? type}${n && /^\d+$/.test(n) ? ` (${n} דירות)` : ''}`;
}
