import { formatCurrency, formatNumber } from '../utils/format';

/** השוואת המסלולים בטבלה אחת (מחליפה את הגרף). */
export function TracksCompare({ tracks }) {
  const { combination, costPlus, revenueSharing, cashExit } = tracks;
  const rows = [
    { name: 'קומבינציה', flats: combination.finishedUnits, equity: combination.equityRequired, net: combination.profit, equityNote: 'מס שבח' },
    { name: 'שירותי בנייה', flats: costPlus.finishedUnits, equity: costPlus.totalEquityRequired, net: costPlus.profit, equityNote: 'עלות כוללת' },
    { name: 'תמורות', flats: null, equity: 0, net: revenueSharing.profit },
    { name: 'מזומן', flats: null, equity: 0, net: cashExit.netCashAmount },
  ];
  const best = rows.reduce((a, b) => (b.net > a.net ? b : a));

  return (
    <div className="card">
      <h2>השוואת המסלולים</h2>
      <table className="results-table">
        <thead>
          <tr>
            <th>מסלול</th>
            <th>דירות שמתקבלות</th>
            <th>תשלום מצדכם</th>
            <th>שווי / תמורה נטו</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className={r === best ? 'row-subtotal' : undefined}>
              <td data-label="מסלול">{r.name}</td>
              <td data-label="דירות שמתקבלות">{r.flats == null ? '— (כסף)' : formatNumber(r.flats, 2)}</td>
              <td data-label="תשלום מצדכם">
                {r.equity > 0 ? `${formatCurrency(r.equity)} (${r.equityNote})` : formatCurrency(0)}
              </td>
              <td data-label="שווי / תמורה נטו">{formatCurrency(r.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="compare-note">
        השורה המודגשת היא בעלת השווי הנטו הגבוה ביותר לפי ההנחות — בלי להתחשב בסיכון, בזמן עד המסירה
        ובצורך בהון עצמי. בקומבינציה ובשירותי בנייה השווי הוא שווי הדירות; בתמורות ובמזומן — כסף.
      </p>
    </div>
  );
}
