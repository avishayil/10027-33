import { Tooltip } from '../Tooltip';
import { TOOLTIPS } from '../../content/tooltips';
import { OFFERS_LOTS_NOTE } from '../../content/sourcesAndDisclaimer';
import { formatArea, formatCurrency, formatNumber } from '../../utils/format';

function Row({ label, value, tone, tip, className }) {
  return (
    <tr className={className}>
      <th scope="row">
        {label} {tip && <Tooltip content={tip} />}
      </th>
      <td className={tone}>{value}</td>
    </tr>
  );
}

const minus = (v) => `−${formatCurrency(v)}`;

function TrackCard({ title, tip, sub, children, notes }) {
  return (
    <section className="card track-card">
      <h2>
        {title} <Tooltip content={tip} />
      </h2>
      <p className="card-sub">{sub}</p>
      <table className="kv-table">
        <tbody>{children}</tbody>
      </table>
      {notes && <div className="track-notes">{notes}</div>}
    </section>
  );
}

export function TrackCards({ tracks, config, landArea, versionId }) {
  const { combination, costPlus, revenueSharing, cashExit, units, marketValuePerApartment } = tracks;
  const soldPct = Math.round(combination.soldPortion * 100);
  const offersNote = versionId === 'v2' && (
    <p className="warn-hint">
      <strong>שימו לב:</strong> {OFFERS_LOTS_NOTE}
    </p>
  );

  return (
    <div className="tracks-grid">
      <TrackCard
        title={`קומבינציה (${config.combinationPct}%)`}
        tip={TOOLTIPS.combination}
        sub={`${config.combinationPct}% מ-${formatNumber(units, 2)} יח״ד כדירות מוגמרות · דירה ${formatCurrency(marketValuePerApartment)}`}
        notes={
          <>
            {offersNote}
            {combination.hasMushaProblem && (
              <p className="warn-hint">
                <strong>מושע:</strong>{' '}
                {combination.wholeUnits > 0
                  ? `${formatNumber(combination.wholeUnits, 0)} דירות שלמות + שותפות של ${formatNumber(combination.fractionalPart * 100, 0)}% בדירה נוספת.`
                  : `אין דירה שלמה — בעלות של ${formatNumber(combination.fractionalPart * 100, 0)}% בדירה אחת, במשותף עם בעלים אחרים.`}{' '}
                <Tooltip content={TOOLTIPS.musha} />
              </p>
            )}
          </>
        }
      >
        <Row label="דירות מוגמרות" value={formatNumber(combination.finishedUnits, 2)} />
        <Row label="שווי הדירות" value={formatCurrency(combination.totalValue)} tone="pos" />
        <Row
          label={`זכויות שנמכרות ליזם (${soldPct}%)`}
          value={`${formatNumber(combination.soldUnits, 2)} יח״ד`}
        />
        <Row
          label={`מס שבח (${config.capitalGainsTax}%)`}
          tip={`על החלק שנמכר: ${soldPct}% × ${formatArea(landArea)} מ״ר × ${formatCurrency(config.landValuePerSqm)} = ${formatCurrency(combination.soldValue)}`}
          value={minus(combination.capitalGainsTax)}
          tone="neg"
        />
        <Row
          label="היטל השבחה"
          tip={TOOLTIPS.bettermentLevy}
          value={`${formatCurrency(combination.bettermentLevyCovered)} — ע״י היזם`}
        />
        <Row label="שווי נטו" value={formatCurrency(combination.profit)} className="row-total" />
      </TrackCard>

      <TrackCard
        title="שירותי בנייה (עלות+)"
        tip={TOOLTIPS.costPlus}
        sub={`בונים ${formatNumber(units, 2)} יח״ד · ${formatCurrency(config.costPerSqm)} למ״ר לפני מע״מ · עמלה ${config.entrepreneurMarkup}%`}
        notes={
          <>
            <p className="owner-hint">
              <strong>נקודת איזון:</strong> מחיר מכירה מינימלי {formatCurrency(costPlus.breakEvenPriceSqm)}{' '}
              למ״ר <Tooltip content={TOOLTIPS.breakEven} />
            </p>
            <p className="warn-hint">
              הסכום מחושב לפי מספר הזכויות כולל שברים. בפועל לרוב בונים דירות שלמות ומוכרים את השבר.
              מיקום הדירה בבניין נקבע בהגרלה בין בעלי המגרש.
            </p>
          </>
        }
      >
        <tr className="kv-group">
          <th colSpan={2}>עלות ליח״ד ({config.apartmentSizeSqm} מ״ר)</th>
        </tr>
        <Row className="kv-indent" label="בנייה" value={formatCurrency(costPlus.constructionCostPerApartment)} />
        <Row className="kv-indent" label={`עמלת יזם (${config.entrepreneurMarkup}%)`} value={formatCurrency(costPlus.entrepreneurFee)} />
        <Row className="kv-indent" label={`מע״מ (${config.vatRate}%)`} value={formatCurrency(costPlus.vat)} />
        <Row className="kv-indent" label="חלק יחסי בהיטל ההשבחה" value={formatCurrency(costPlus.levyPerUnit)} />
        <Row className="kv-indent" label="סה״כ ליח״ד" value={formatCurrency(costPlus.costPerUnit)} />
        <Row label="השקעה כוללת" value={minus(costPlus.totalEquityRequired)} tone="neg" />
        <Row
          label={`מתוכה הון עצמי (${config.requiredEquityPct}%)`}
          value={formatCurrency(costPlus.equityBarrier)}
        />
        <Row label="שווי שוק של הדירות" value={formatCurrency(costPlus.totalMarketValue)} tone="pos" />
        <Row label="רווח נטו" value={formatCurrency(costPlus.profit)} className="row-total" />
      </TrackCard>

      <TrackCard
        title={`תמורות (${config.revenueSharePct}%)`}
        tip={TOOLTIPS.revenueSharing}
        sub={`${config.revenueSharePct}% מהכנסות ${formatNumber(units, 2)} יח״ד · ללא הון עצמי`}
        notes={offersNote}
      >
        <Row label="יח״ד על הזכויות שלכם" value={formatNumber(revenueSharing.finishedUnits, 2)} />
        <Row label="שווי מכירה כולל" value={formatCurrency(revenueSharing.totalMarketValue)} />
        <Row label={`החלק שלכם (${config.revenueSharePct}%)`} value={formatCurrency(revenueSharing.yourShare)} tone="pos" />
        <Row label="הון עצמי נדרש" value={formatCurrency(0)} />
        <Row label="תמורה נטו" value={formatCurrency(revenueSharing.profit)} className="row-total" />
      </TrackCard>

      <TrackCard
        title="מכירה במזומן"
        tip={TOOLTIPS.cashExit}
        sub={`${formatArea(landArea)} מ״ר × ${formatCurrency(config.landValuePerSqm)} למ״ר קרקע`}
      >
        <Row label="שווי קרקע ברוטו" value={formatCurrency(cashExit.grossLandValue)} tip={TOOLTIPS.landValuePerSqm} />
        <Row label="היטל השבחה" value={minus(cashExit.bettermentLevy)} tone="neg" tip={TOOLTIPS.bettermentLevy} />
        <Row
          label={`רווח יזמי (${config.entrepreneurProfitMargin}%)`}
          value={minus(cashExit.entrepreneurProfit)}
          tone="neg"
          tip={TOOLTIPS.entrepreneurialProfit}
        />
        <Row label="לפני מס" value={formatCurrency(cashExit.amountBeforeTax)} />
        <Row
          label={`מס שבח (${config.capitalGainsTax}%)`}
          value={minus(cashExit.capitalGainsTax)}
          tone="neg"
          tip={TOOLTIPS.capitalGainsTax}
        />
        <Row label="מזומן נטו" value={formatCurrency(cashExit.netCashAmount)} className="row-total" />
      </TrackCard>
    </div>
  );
}
