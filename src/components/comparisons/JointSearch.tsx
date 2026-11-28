/**
 * "Terms that work for both sides" — on demand, in the advanced view only (iteration 10 / I3). Each tested contract is
 * evaluated once per route and both sides are read from it: the owner on the route's own funding and goal, the
 * developer on the lot margin with that very route. Results are tied to the inputs they were computed from; when the
 * inputs change the old result is hidden (and a run started on old inputs is discarded), never shown as current.
 */
import { useEffect, useRef, useState } from 'react';
import { PROJECT_CONFIG } from '../../data/config';
import type { CommercialTerms, TaxArrangement, UserProfile } from '../../domain/types';
import { fingerprint, type ContractFunding } from '../../optimizer/contract';
import { jointSearch, type JointPair, type JointResult } from '../../optimizer/joint/search';
import { formatCompactCurrency, formatCurrency, formatNumber } from '../../utils/format';
import { JointRanges } from '../charts/outputs';

const ARR_LABELS: Record<TaxArrangement, string> = {
  gross: 'עסקת ברוטו (אתם משלמים מס שבח והיטל)',
  mixed: 'עסקה מעורבת (היזם משלם את ההיטל)',
  net: 'עסקת נטו (היזם משלם מס שבח והיטל)',
};
const FUNDING_LABELS: Record<ContractFunding, string> = {
  none: 'בלי מימון למסים',
  developer_loan: 'בהלוואת מסים מהיזם',
  other_property: 'בהלוואה על נכס אחר',
};
const pct = (x: number) => `${formatNumber(x * 100, 1)}%`;
const range = (r: [number, number][]) => (r.length ? r.map(([a, b]) => (a === b ? pct(a) : `${pct(a)} עד ${pct(b)}`)).join(', ') : 'לא נמצא בבדיקה');

type Offer = { levyCap: number | null; developerPaysTaxLoanInterest: boolean };

export function JointSearch({ profile, terms, offer }: { profile: UserProfile; terms: CommercialTerms; offer: Offer }) {
  const key = fingerprint({ profile, terms, offer, v: PROJECT_CONFIG.version });
  const [state, setState] = useState<{ key: string; res: JointResult } | { key: string; error: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(key);
  useEffect(() => {
    latest.current = key;
  }, [key]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const run = () => {
    const runKey = key;
    setBusyKey(runKey);
    if (timer.current) clearTimeout(timer.current);
    // Let the button show "מחשב…" before the (synchronous) search runs; drop the run if the inputs changed meanwhile.
    timer.current = setTimeout(() => {
      timer.current = null;
      if (latest.current !== runKey) return setBusyKey(null);
      try {
        const config = { ...PROJECT_CONFIG, commercial: { ...PROJECT_CONFIG.commercial, offer } };
        const res = jointSearch(profile, terms, offer, config);
        if (latest.current === runKey) setState({ key: runKey, res });
      } catch (e) {
        setState({ key: runKey, error: e instanceof Error ? e.message : String(e) });
      }
      setBusyKey(null);
    }, 30);
  };
  const current = state && state.key === key ? state : null;
  const stale = !!state && state.key !== key;
  const busy = busyKey === key;
  const res = current && 'res' in current ? current.res : null;

  return (
    <section className="card detail-section" aria-labelledby="joint-title">
      <h2 id="joint-title">תנאים שמתאימים לשני הצדדים</h2>
      <p className="card-sub">
        לכל אחוז קומבינציה בטווח הסליידר, לכל הסדר מס ולכל אפשרות מימון: כל מסלול מחושב פעם אחת, ושני הצדדים נקראים מאותו
        חישוב — אתם (האם אפשר לממן, בלי מחיר לא ידוע, ומתאים למטרה שלכם) והיזם (רווח המגרש <em>עם המסלול הזה</em> לפחות{' '}
        {pct(PROJECT_CONFIG.developer.targetMarginOnRevenue)} מההכנסות — הנחה, לא כלל). חישוב לפי המודל, לא הצעה.
      </p>
      {stale && <p className="field-hint">הנתונים השתנו מאז החישוב הקודם — התוצאה הוסתרה. חשבו מחדש.</p>}
      {!res && (
        <button type="button" className="btn-secondary" onClick={run} disabled={busy}>
          {busy ? 'מחשב…' : 'חיפוש תנאים'}
        </button>
      )}
      {current && 'error' in current && <p className="callout callout-strong">{current.error}</p>}
      {res && (
        <>
          {res.frontier.length > 0 ? (
            <div className="callout">
              <strong>נמצאו תנאים שמתאימים לשניכם — בכפוף לתנאים:</strong>
              <ul>
                {res.frontier.map((f) => (
                  <li key={f.contractId}>
                    {ARR_LABELS[f.arrangement]}, קומבינציה {pct(f.combinationPct)}, {FUNDING_LABELS[f.funding]} — {routeLabel(f.routeId)}; רווח היזם עם
                    המסלול הזה {pct(f.developerMargin!)}
                  </li>
                ))}
              </ul>
              <span className="sub">
                ״מתאים״ כאן הוא לפי המודל: לא ידוע כמה שווה לכם לא לחתום (אין מחיר קרקע עדכני), ולא ידוע אם יעד הרווח הוא הדרישה
                האמיתית של היזם.
              </span>
            </div>
          ) : (
            <div className="callout callout-strong">
              <strong>לא נמצאו בבדיקה תנאים שמתאימים לשניכם.</strong> מה היה צריך להשתנות — לכל הסדר מס:
            </div>
          )}
          <JointRanges res={res} labels={ARR_LABELS} current={terms.combinationPct} />
          <div className="table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>הסדר מס</th>
                  <th>מתאים לכם</th>
                  <th>מתאים ליזם (במסלול כלשהו)</th>
                  <th>לשניכם, באותו מסלול</th>
                </tr>
              </thead>
              <tbody>
                {res.arrangements.map((a) => (
                  <tr key={a.arrangement}>
                    <th>{ARR_LABELS[a.arrangement]}</th>
                    <td>{range(a.ownerOk)}</td>
                    <td>{range(a.developerOk)}</td>
                    <td className={a.both.length ? '' : 'cell-fail'}>{a.both.length ? range(a.both) : 'לא נמצא'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res.frontier.length === 0 && <GapList res={res} />}
          <p className="field-hint">
            נבדקו {res.contractsEvaluated} חוזים, בצעדים של {formatNumber(res.step * 100, 1)} נקודה במקום שבו התוצאה משתנה ושל עד{' '}
            {formatNumber(res.resolution * 100, 1)} נקודה במקום אחר — טווח צר מזה עלול לא להימצא, ולכן ״לא נמצא״ אינו ״לא קיים״. כל
            מנוף נבדק לבד ומחושב מחדש לשני הצדדים; בפועל אפשר לשלב. מחירים ועלויות כאן הם ספים מחושבים, לא נתוני שוק.
          </p>
          <button type="button" className="link-btn" onClick={() => setState(null)}>
            חישוב מחדש
          </button>
        </>
      )}
    </section>
  );
}

function GapList({ res }: { res: JointResult }) {
  return (
    <ul className="joint-gaps">
      {res.arrangements.map((a) => {
        const g = a.gap;
        if (!g) return null;
        const parts: string[] = [];
        if (g.nearest)
          parts.push(
            `באותו מסלול (${routeLabel(g.nearest.routeId)}, ${FUNDING_LABELS[g.nearest.funding]}) אתם מסכימים מ-${pct(g.nearest.ownerAt)} והיזם עומד ביעד עד ${pct(g.nearest.developerAt)} — פער של ${formatNumber(g.nearest.points * 100, 1)} נקודות`,
          );
        else if (g.ownerMin === null) parts.push('לא נמצא אחוז שבו תוכלו לממן מסלול שמתאים לכם');
        else if (g.developerMax === null) parts.push('היזם לא עומד ביעד הרווח באף מסלול ובאף אחוז שנבדק');
        else parts.push('אין מסלול שבו שני הצדדים מסכימים, גם לא באחוזים שונים');
        const at = (x: { combinationPct: number; routeId: string; funding: ContractFunding }) => `ב-${pct(x.combinationPct)} (${routeLabel(x.routeId)}, ${FUNDING_LABELS[x.funding]})`;
        const owner = (ok: boolean) => (ok ? 'ואתם עדיין מסכימים' : 'אבל אז המסלול כבר לא מתאים לכם');
        if (g.marginLever) {
          const levers = [
            `היזם מסתפק ברווח של ${pct(g.marginLever.margin)} (במקום ${pct(res.targetMargin)})`,
            g.costLever ? `עלות בנייה ליזם עד ${formatCurrency(g.costLever.directCostPerSqm)} למ״ר מכר (עכשיו ${formatCurrency(g.costLever.current)}), ${owner(g.costLever.ownerAccepts)}` : null,
            g.priceLever ? `מחיר דירה של ${formatCurrency(g.priceLever.pricePerSqm)} למ״ר, ${owner(g.priceLever.ownerAccepts)}` : null,
          ].filter(Boolean);
          parts.push(`${at(g.marginLever)} זה יעבוד ליזם אם: ${levers.join('; או ')}`);
        }
        if (g.capitalLever)
          parts.push(
            `${at(g.capitalLever)} זה יעבוד לכם עם עוד כ-${formatCompactCurrency(g.capitalLever.extraCapital)} הון עצמי${g.capitalLever.ownerAccepts && g.capitalLever.developerOk ? '' : ' (בבדיקה חוזרת זה עדיין לא מספיק לשני הצדדים)'}`,
          );
        return (
          <li key={a.arrangement}>
            <strong>{ARR_LABELS[a.arrangement]}:</strong> {parts.join('. ')}.
          </li>
        );
      })}
    </ul>
  );
}

/** A short label from a route id (the search keeps ids, not full results). */
export function routeLabel(id: string | null): string {
  if (!id) return '—';
  const labels: Record<string, string> = {
    S02: 'קומבינציה מלאה',
    S02C: 'קומבינציה מלאה ותשלום על השבר',
    S02P: 'קומבינציה מלאה ויחידת סל',
    S06: 'קומבינציה והשלמה בתשלום',
    S11: 'קומבינציה על חלק ושירותי בנייה על השאר',
    S14: 'קומבינציה והשכרה',
    S03: 'שירותי בנייה',
    S07: 'שירותי בנייה ומכירת דירה במסירה',
    S08: 'שירותי בנייה והשכרה',
  };
  const [type, n] = id.split('-');
  return `${labels[type] ?? type}${n && /^\d+$/.test(n) ? ` (${n} דירות)` : ''}${id.endsWith('-rent') ? ', בהשכרה' : ''}`;
}

export type { JointPair };
