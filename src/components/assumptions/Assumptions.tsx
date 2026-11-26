import { ASSUMPTION_GROUPS, CONFIG_VERSION } from '../../data/config';
import { PARCEL33_TRANSACTIONS } from '../../data/market';
import { SOURCE_REGISTRY } from '../../data/sources';
import type { DataPoint, Verification } from '../../domain/types';
import { formatCurrency, formatNumber } from '../../utils/format';

const VERIFICATION_LABELS: Record<Verification, string> = {
  verified: 'מאומת',
  reported: 'מדווח',
  assumed: 'הנחה',
  unknown: 'לא ידוע',
};

function formatValue(dp: DataPoint<number | string>): string {
  const v = dp.value;
  if (typeof v === 'string') return v;
  if (v > 0 && v < 1) return `${formatNumber(v * 100, v * 100 % 1 === 0 ? 0 : 1)}%`;
  if (v >= 1000) return formatCurrency(v);
  return formatNumber(v, v % 1 === 0 ? 0 : 2);
}

function formatRange(dp: DataPoint<number | string>): string | null {
  if (!dp.range) return null;
  return `${formatValue({ ...dp, value: dp.range.low })} – ${formatValue({ ...dp, value: dp.range.high })}`;
}

export function Assumptions() {
  return (
    <details className="card detail-section assumptions">
      <summary>
        <span>
          הנחות החישוב ומקורות המידע
          <span className="summary-sub">כל מספר עם מקור, תאריך ורמת ודאות · גרסת נתונים {CONFIG_VERSION}</span>
        </span>
      </summary>
      {ASSUMPTION_GROUPS.map((g) => (
        <div key={g.id} className="assumption-group">
          <h3>{g.title}</h3>
          <div className="table-scroll">
            <table className="kv-table assumption-table">
              <tbody>
                {g.items.map((dp) => (
                  <tr key={dp.label}>
                    <th>
                      {dp.label}
                      {dp.notes && <span className="summary-sub">{dp.notes}</span>}
                    </th>
                    <td>
                      <strong>{formatValue(dp)}</strong>
                      {formatRange(dp) && <span className="summary-sub">טווח: {formatRange(dp)}</span>}
                      <span className={`verif verif-${dp.verification}`}>{VERIFICATION_LABELS[dp.verification]}</span>
                      {dp.sourceUrl ? (
                        <a className="summary-sub" href={dp.sourceUrl} target="_blank" rel="noreferrer">
                          {dp.sourceName ?? 'מקור'}
                        </a>
                      ) : (
                        dp.sourceName && <span className="summary-sub">{dp.sourceName}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div className="assumption-group">
        <h3>עסקאות מדווחות בחלקה 33 (167 מ״ר כל אחת, לפני עדכון 106(ב))</h3>
        <table className="compare-table">
          <thead>
            <tr>
              <th>מועד</th>
              <th>מחיר</th>
              <th>למ״ר</th>
            </tr>
          </thead>
          <tbody>
            {PARCEL33_TRANSACTIONS.map((t) => (
              <tr key={t.date}>
                <td>{t.date}</td>
                <td>{formatCurrency(t.price)}</td>
                <td>{formatCurrency(t.price / t.areaSqm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="field-hint">
          מועדים, שלבי תכנון ושיטות הערכה שונים — אין להתייחס לעסקאות האלה, לשווי בטבלת האיזון (₪714,371 ל-167 מ״ר)
          או להנחת ₪6,900 למ״ר כאומדנים חלופיים לשווי השוק היום.
        </p>
      </div>
      <div className="assumption-group">
        <h3>היכן מתעדכן כל נתון</h3>
        <ul className="sources">
          {SOURCE_REGISTRY.map((s) => (
            <li key={s.information}>
              <strong>{s.information}</strong> —{' '}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.source}
                </a>
              ) : (
                s.source
              )}{' '}
              · {s.review}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
