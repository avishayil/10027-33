import { Tooltip } from './Tooltip';
import { TOOLTIPS } from '../content/tooltips';
import { formatArea, formatCurrency, formatNumber, formatPercent } from '../utils/format';

/** "זכויותיך לפי טבלת האיזון" — טבלה בסגנון טבלת התוצאות של compound-13-tables. */
export function TableRights({ rights, version, tracks }) {
  const { lot } = rights;
  const cells = [
    { label: 'מגרש', value: lot.id },
    { label: 'ייעוד', value: lot.use },
    { label: 'חלק במגרש', value: formatPercent(rights.lotShare, 3), tip: TOOLTIPS.lotShare },
    { label: 'זכות רעיונית ליח״ד', value: formatNumber(rights.units, 2), tip: TOOLTIPS.units },
    { label: 'מ״ר קרקע ליח״ד', value: formatNumber(rights.sqmPerUnit, 1) },
    { label: 'מגורים (מ״ר פלדלת)', value: formatNumber(rights.residentialArea, 1) },
    { label: 'שווי במצב הנכנס', value: formatCurrency(rights.incomingValue), tip: TOOLTIPS.incomingValue },
    { label: 'שווי הזכויות (מצב יוצא)', value: formatCurrency(rights.allocationValue), tip: TOOLTIPS.allocationValue },
    { label: `היטל השבחה משוער (${rights.bettermentLevyPct}%)`, value: formatCurrency(rights.bettermentLevy), tip: TOOLTIPS.bettermentLevy },
  ];

  return (
    <div className="card">
      <h2>הזכויות שלכם לפי טבלת האיזון</h2>
      <p className="card-sub">
        {version.label} · {formatArea(rights.landArea)} מ״ר בחלקה (
        {formatPercent(rights.parcelShare, 3)} מהחלקה)
      </p>
      <table className="results-table">
        <thead>
          <tr>
            {cells.map((c) => (
              <th key={c.label} className={c.label === 'מגרש' ? 'col-lot' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {cells.map((c) => (
              <td key={c.label} data-label={c.label} className={c.label === 'ייעוד' ? 'col-zoning' : undefined}>
                {c.value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {tracks.isOverridden && (
        <p className="warn-hint" style={{ marginTop: 14 }}>
          בהגדרות המתקדמות הוזנה דריסה של {formatNumber(tracks.sqmPerUnit, 1)} מ״ר ליח״ד — המסלולים
          למטה מחושבים לפי {formatNumber(tracks.units, 2)} יח״ד ולא לפי הטבלה.
        </p>
      )}

      <dl className="results-legend">
        {cells
          .filter((c) => c.tip)
          .map((c) => (
            <div key={c.label}>
              <dt>{c.label}</dt>
              <dd>{c.tip}</dd>
            </div>
          ))}
        <div>
          <dt>שווי במגרש {lot.id}</dt>
          <dd>
            {formatNumber(lot.units, 0)} יח״ד, {formatNumber(lot.residentialArea, 0)} מ״ר מגורים,
            שווי מגרש {formatCurrency(lot.value)}. לכל 167 מ״ר בחלקה: {lot.shareLabel} מהמגרש.
          </dd>
        </div>
      </dl>
      <p className="compare-note">מקור: {version.sourceNote}</p>
    </div>
  );
}
