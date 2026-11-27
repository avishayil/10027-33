import { ASSUMPTION_GROUPS, CONFIG_VERSION, PROJECT_CONFIG } from '../../data/config';
import { APARTMENT_COMPARABLES, APPRAISAL_FIGURES, APPRAISAL_SOURCE, LAND_TRANSACTIONS, OFFICIAL_FACTS, TRANSACTION_SOURCES } from '../../data/evidence';
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
        <h3>עסקאות קרקע מדווחות במתחם 13</h3>
        <div className="table-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th>חלקה</th>
                <th>מועד</th>
                <th>שטח</th>
                <th>תמורה</th>
                <th>למ״ר</th>
              </tr>
            </thead>
            <tbody>
              {LAND_TRANSACTIONS.map((t, idx) => (
                <tr key={idx}>
                  <td>{t.parcel}</td>
                  <td>{t.date}</td>
                  <td>{t.areaSqm}</td>
                  <td>{formatCurrency(t.price)}</td>
                  <td>{formatCurrency(t.price / t.areaSqm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint">
          מדווחות ולא אומתו מול רשות המסים. כולן לפני עדכון הטבלאות (23.11.2026) — לא נמצאה עסקה מאומתת בחלקה 33
          אחריו. חלקות שכנות שונות בזכויות ובתכנון — השוואה לפי מ״ר מקורי עלולה להטעות. הוצאו עד לאימות: עסקה מ-08.07.2025
          בלי שטח אמין, ושתי שורות של ₪235,000 (02.08.2024 / 02.08.2026, ייתכן כפילות).{' '}
          {TRANSACTION_SOURCES.map((s, i) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
              {i ? ' · ' : ''}
              {s.name}
            </a>
          ))}
        </p>
      </div>
      <div className="assumption-group">
        <h3>דירות בפרויקטי השוואה (שמאות הפרויקט)</h3>
        <div className="table-scroll">
          <table className="compare-table">
            <thead>
              <tr>
                <th>חדרים</th>
                <th>שטח</th>
                <th>ממוצע</th>
                <th>למ״ר</th>
                <th>עסקאות</th>
                <th>עמ׳</th>
              </tr>
            </thead>
            <tbody>
              {APARTMENT_COMPARABLES.map((c, idx) => (
                <tr key={idx}>
                  <td>{c.rooms}</td>
                  <td>{c.areaSqm}</td>
                  <td>{formatCurrency(c.averagePrice)}</td>
                  <td>{formatCurrency(c.averagePrice / c.areaSqm)}</td>
                  <td>{c.count}</td>
                  <td>{c.page}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint">
          ממוצעי פרויקטים להשוואה — לא דירות במתחם 13. דירות קטנות יקרות יותר למ״ר, ולכן שווי דירת 3 חד׳ מחושב כ-
          {formatNumber((PROJECT_CONFIG.market.apartmentTypes.find((t) => t.rooms === 3)?.relativeValue ?? 0) * 100, 1)}% משווי
          דירת 4 חד׳ (לא לפי שטח). שווי דירת 4 חד׳ (₪2.5 מיליון) נשאר תרחיש. {APPRAISAL_SOURCE.name}, {APPRAISAL_SOURCE.date} —{' '}
          {APPRAISAL_SOURCE.note}
        </p>
      </div>
      <div className="assumption-group">
        <h3>נתונים נוספים מהשמאות ומקורות רשמיים</h3>
        <table className="kv-table">
          <tbody>
            {Object.values(APPRAISAL_FIGURES).map((f) => (
              <tr key={f.unit}>
                <th>{f.unit}</th>
                <td>
                  {formatNumber(f.value, 0)}
                  {f.page ? <span className="summary-sub">עמ׳ {f.page}</span> : null}
                </td>
              </tr>
            ))}
            {OFFICIAL_FACTS.map((f) => (
              <tr key={f.label}>
                <th>
                  <a href={f.url} target="_blank" rel="noreferrer">
                    {f.label}
                  </a>
                </th>
                <td>
                  {f.value}
                  <span className="summary-sub">{f.note}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
