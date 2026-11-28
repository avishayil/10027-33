/** V1 Milestone C4: one list of terms to request, each with its value to you, its cost to the developer and plausibility. */
import { useMemo } from 'react';
import type { CommercialTerms, DecisionResult, ProjectConfig, UserProfile } from '../../domain/types';
import { strategyTitle } from '../../optimizer/explain';
import { termsToRequest, requestRoute } from '../../optimizer/negotiation';
import { formatCompactCurrency } from '../../utils/format';
import { GainVsCost, requestRows } from '../charts/outputs';

const PLAUSIBLE: Record<string, { label: string; cls: string }> = {
  plausible: { label: 'סביר ליזם לפי המודל', cls: 'status-estimated_feasible' },
  unlikely: { label: 'קשה ליזם לפי המודל', cls: 'status-infeasible' },
  unknown: { label: 'לא ידוע', cls: 'status-unknown' },
};

export function TermsToRequestCard({ result, profile, terms, config }: { result: DecisionResult; profile: UserProfile; terms: CommercialTerms; config: ProjectConfig }) {
  const t = useMemo(() => termsToRequest(result, profile, terms, config), [result, profile, terms, config]);
  const route = requestRoute(result);
  if (!t.items.length || !route) return null;
  return (
    <section className="card detail-section" aria-labelledby="ask-title">
      <h2 id="ask-title">מה לבקש — ומה זה עולה ליזם</h2>
      <p className="card-sub">למסלול {strategyTitle(route)}. {t.note}</p>
      <GainVsCost rows={requestRows(t.items)} />
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th>לבקש</th>
              <th>שווה לכם</th>
              <th>עולה ליזם</th>
              <th>לפי המודל</th>
            </tr>
          </thead>
          <tbody>
            {t.items.map((x) => (
              <tr key={x.id}>
                <th>{x.ask}</th>
                <td>{x.ownerGain === null ? '—' : formatCompactCurrency(x.ownerGain)}</td>
                <td>{x.developerCost === null ? '—' : formatCompactCurrency(x.developerCost)}</td>
                <td>
                  <span className={`status ${PLAUSIBLE[x.plausibility].cls}`}>{PLAUSIBLE[x.plausibility].label}</span>
                  <span className="sub">{x.why}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
