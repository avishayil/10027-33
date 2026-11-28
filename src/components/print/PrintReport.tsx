/**
 * The concise personal report (V1 Milestone C6, spec §3.7) — printed only, from the exact calculation snapshot: the
 * direction and alternatives, taxes and who pays them, contractual dependencies, terms to request, questions and the
 * key assumptions with their source dates. Never mixes old results with new inputs (it reads the snapshot only).
 */
import { useMemo } from 'react';
import { COMMERCIAL } from '../../data/commercial';
import { FINANCING, MARKET } from '../../data/market';
import { REGULATION } from '../../data/regulation';
import type { DataPoint } from '../../domain/types';
import type { AnalysisSnapshot } from '../../hooks/useDecisionEngine';
import { CONDITION_TEXT, GOAL_LABELS, strategyTitle } from '../../optimizer/explain';
import { goalGuidance } from '../../optimizer/guidance';
import { termsToRequest } from '../../optimizer/negotiation';
import { checkOffer, type ActualOffer } from '../../optimizer/offer';
import { formatCompactCurrency, formatCurrency } from '../../utils/format';

const TAXES: [string, string][] = [
  ['betterment_levy', 'היטל השבחה'],
  ['capital_gains_tax', 'מס שבח (רזרבה)'],
  ['services_vat', 'מע״מ על שירותי בנייה'],
  ['purchase_tax', 'מס רכישה'],
];

function keyAssumptions(): DataPoint<number | string>[] {
  const pick = (o: object, k: string) => (o as Record<string, DataPoint<number | string>>)[k];
  return [
    pick(MARKET, 'apartmentValuePerSqm'),
    pick(MARKET, 'monthlyRentPerApartment'),
    pick(FINANCING, 'realDiscountRate'),
    pick(FINANCING, 'inflation'),
    pick(REGULATION, 'bettermentLevyRate'),
    pick(REGULATION, 'vatRate'),
    pick(COMMERCIAL, 'constructionCostPerSqm'),
  ].filter(Boolean);
}

export function PrintReport({ analysis, offer }: { analysis: AnalysisSnapshot; offer: ActualOffer }) {
  const { result, profile, terms, config } = analysis;
  const g = goalGuidance(result, profile.goal);
  const ask = useMemo(() => termsToRequest(result, profile, terms, config), [result, profile, terms, config]);
  const check = useMemo(() => checkOffer(profile, config, terms, offer), [profile, config, terms, offer]);
  const offerEntered = check.terms.entered.length > 0;
  const r = g.direction ?? g.alternatives[0]?.r ?? null;
  const taxBy = (payer: 'owner' | 'developer', cat: string) =>
    r ? r.ledger.filter((e) => e.payer === payer && e.direction === 'out' && e.category === cat && !e.deferred).reduce((s, e) => s + e.amount, 0) : 0;
  const questions = check.terms.entered.length ? check.questions : ['האם יש הצעה כתובה? כל התנאים כאן משוערים.', ...ask.items.map((x) => `לבקש: ${x.ask}`)];
  return (
    <section className="print-only print-report">
      <h3>הכיוון לפי מה שחשוב לכם — {GOAL_LABELS[profile.goal]}</h3>
      {g.direction ? (
        <p>
          <strong>{strategyTitle(g.direction)}</strong>
          {g.kind === 'conditional' ? ' — בתנאי שיושגו תנאים נוספים' : ''} · {g.measure.label}: {g.measure.text}
        </p>
      ) : (
        <p>
          <strong>אף מסלול לא מתאים עכשיו.</strong> מה חוסם: {g.reasons.join(' · ')}
        </p>
      )}
      {g.alternatives.length > 0 && <p>חלופות: {g.alternatives.map((a) => strategyTitle(a.r)).join(' · ')}</p>}
      {g.saleThreshold !== null && <p>מכירה: לבקש לפחות {formatCurrency(g.saleThreshold)} למ״ר קרקע (שווי מכירה עדכני לא ידוע).</p>}
      {r && (
        <>
          <h3>מסים ומי משלם ({strategyTitle(r)})</h3>
          <table className="kv-table">
            <tbody>
              {TAXES.map(([cat, label]) => {
                const o = taxBy('owner', cat);
                const dv = taxBy('developer', cat);
                if (o < 1 && dv < 1) return null;
                return (
                  <tr key={cat}>
                    <th>{label}</th>
                    <td>
                      אתם: {formatCompactCurrency(o)} · היזם: {formatCompactCurrency(dv)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p>
            בחתימה {formatCompactCurrency(r.cashAtSigning)} · כסף מכיסכם {formatCompactCurrency(r.personalCapitalRequired)} · הלוואות {formatCompactCurrency(r.mortgageRequired)} · מצב
            נטו במסירה {formatCompactCurrency(r.delivery.netPosition)} (מחירי היום)
          </p>
          {r.requiredConditions.length > 0 && (
            <>
              <h3>תלוי בתנאי חוזה ומימון</h3>
              <ul>
                {[...new Set(r.requiredConditions)].map((c) => (
                  <li key={c}>{CONDITION_TEXT[c]}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {offerEntered && check.offerRoute && (
        <>
          <h3>ההצעה בפועל מול התנאים המשוערים</h3>
          <ul>
            {check.diff
              .filter((d) => d.delta !== null && Math.abs(d.delta) >= 1)
              .map((d) => (
                <li key={d.id}>
                  {d.label}: {d.delta! > 0 ? '+' : '−'}
                  {d.id === 'margin' ? `${(Math.abs(d.delta!) * 100).toFixed(1)} נק׳` : d.id === 'apartments' ? Math.abs(d.delta!) : formatCompactCurrency(Math.abs(d.delta!))}
                </li>
              ))}
          </ul>
        </>
      )}
      <h3>שאלות ליזם וליועצים</h3>
      <ol>
        {questions.slice(0, 14).map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
      <h3>הנחות עיקריות ותאריכי המקור</h3>
      <ul>
        {keyAssumptions().map((d) => (
          <li key={d.label}>
            {d.label}: {typeof d.value === 'number' && d.value > 0 && d.value < 1 ? `${(d.value * 100).toFixed(1)}%` : typeof d.value === 'number' ? formatCurrency(d.value) : d.value} ·{' '}
            {d.sourceName ?? d.sourceType} · נאסף {d.retrievedAt}
          </li>
        ))}
      </ul>
    </section>
  );
}
