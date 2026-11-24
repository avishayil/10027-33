import { VERSIONS, getVersion } from '../data/parcel33';
import { computeSimulationTracks, computeTableRights } from '../utils/simulationMath';
import { formatArea, formatCurrency, formatNumber } from '../utils/format';

/** מהגרסה הקודמת לעדכנית, כדי שהשינוי (Δ) ייקרא לפי סדר הזמן. */
const ORDER = ['v1', 'v2'];

const METRICS = [
  { label: 'מגרש', value: (r) => r.rights.lot.id, text: true },
  { label: 'זכות רעיונית ליח״ד', value: (r) => r.rights.units, format: (v) => formatNumber(v, 2) },
  { label: 'מ״ר קרקע ליח״ד', value: (r) => r.rights.sqmPerUnit, format: (v) => formatNumber(v, 1), lowerIsBetter: true },
  { label: 'מגורים (מ״ר)', value: (r) => r.rights.residentialArea, format: (v) => formatNumber(v, 1) },
  { label: 'שווי במצב הנכנס', value: (r) => r.rights.incomingValue, format: formatCurrency },
  { label: 'שווי הזכויות', value: (r) => r.rights.allocationValue, format: formatCurrency },
  { label: 'היטל השבחה משוער', value: (r) => r.rights.bettermentLevy, format: formatCurrency, lowerIsBetter: true },
  { label: 'דירות בקומבינציה', value: (r) => r.tracks.combination.finishedUnits, format: (v) => formatNumber(v, 2) },
  { label: 'מזומן נטו', value: (r) => r.tracks.cashExit.netCashAmount, format: formatCurrency },
];

export function VersionCompare({ landArea, versionId, lotId, config }) {
  const results = ORDER.map((v) => {
    const lot = v === versionId ? lotId : getVersion(v).lots[0].id;
    const rights = computeTableRights(landArea, v, lot, config.bettermentLevyPct);
    return { rights, tracks: computeSimulationTracks(landArea, rights, { ...config, sqmPerUnitOverride: null }) };
  });
  const [before, after] = results;

  const delta = (m) => {
    if (m.text) return '—';
    const d = m.value(after) - m.value(before);
    const shown = m.format(Math.abs(d));
    if (shown === m.format(0)) return <span>ללא שינוי</span>;
    const good = m.lowerIsBetter ? d < 0 : d > 0;
    return <span className={good ? 'delta-up' : 'delta-down'}>{`${d > 0 ? '+' : '−'}${shown}`}</span>;
  };

  return (
    <div className="card">
      <h2>מה השתנה בעדכון? ({formatArea(landArea)} מ״ר)</h2>
      <table className="compare-table">
        <thead>
          <tr>
            <th></th>
            {ORDER.map((v) => (
              <th key={v}>{VERSIONS[v].label}</th>
            ))}
            <th>שינוי</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => (
            <tr key={m.label}>
              <td>{m.label}</td>
              {results.map((r, i) => (
                <td key={ORDER[i]}>{m.text ? m.value(r) : m.format(m.value(r))}</td>
              ))}
              <td>{delta(m)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="compare-note">
        בעדכון בעלי חלקה 33 עברו ממגרש 44 (מגורים, מסחר ותעסוקה, 160 יח״ד) למגרשים 149, 150 ו-153
        (מגורים ד׳). מספר היחידות לכל מ״ר קרקע גדל בכ-60%, אבל השמאי העריך כל מ״ר מבונה בפחות (4,100 ₪
        במגורים ד׳ לעומת 4,500 ₪ בגרסה המופקדת) — ולכן שווי הזכויות כמעט לא השתנה.
      </p>
      <p className="compare-note">
        ההשוואה משתמשת באותן הנחות שוק בשתי הגרסאות (ללא דריסת מ״ר ליח״ד). בגרסה שאינה פעילה מוצג המגרש
        הראשון שלה.
      </p>
    </div>
  );
}
