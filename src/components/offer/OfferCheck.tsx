/**
 * V1 Milestone C1 (MH-10): check an actual developer offer. Every field is optional; empty = unknown (the model's
 * scenario is used and the term becomes a question). Compared with the base terms on the same basis and date, as
 * line-by-line changes. Session-only: nothing here is saved or sent. The form is hidden in print; the comparison and
 * the questions are printed.
 */
import { useMemo, type ReactNode } from 'react';
import type { CommercialTerms, ProjectConfig, UserProfile } from '../../domain/types';
import { strategyTitle } from '../../optimizer/explain';
import { checkOffer, type ActualOffer, type Side } from '../../optimizer/offer';
import { formatCurrency, formatNumber } from '../../utils/format';
import { OfferDelta, RightsFlow } from '../charts/outputs';
import { calculateRights } from '../../domain/rights';

type Props = { offer: ActualOffer; onChange: (o: ActualOffer) => void; profile: UserProfile; terms: CommercialTerms; config: ProjectConfig };

const num = (v: string): number | null => {
  const t = v.replace(/[^\d.-]/g, '');
  return t === '' ? null : Number(t);
};
const pctIn = (v: string) => {
  const n = num(v);
  return n === null ? null : n / 100;
};
const pctOut = (x: number | null) => (x === null ? '' : String(Math.round(x * 10000) / 100));
const side = (v: string): Side | null => (v === 'owner' || v === 'developer' ? v : null);
const tri = (v: string): boolean | null => (v === 'yes' ? true : v === 'no' ? false : null);
const triOut = (b: boolean | null) => (b === null ? '' : b ? 'yes' : 'no');

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="offer-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SideSelect({ label, value, onChange }: { label: string; value: Side | null; onChange: (s: Side | null) => void }) {
  return (
    <Field label={label}>
      <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(side(e.target.value))}>
        <option value="">לא צוין</option>
        <option value="owner">אתם</option>
        <option value="developer">היזם</option>
      </select>
    </Field>
  );
}

export function OfferCheck({ offer: o, onChange, profile, terms, config }: Props) {
  const set = (patch: Partial<ActualOffer>) => onChange({ ...o, ...patch });
  const res = useMemo(() => checkOffer(profile, config, terms, o), [profile, config, terms, o]);
  const anyEntered = res.terms.entered.length > 0;
  const money = (x: number | null, id: string) => (x === null ? '—' : id === 'margin' ? `${formatNumber(x * 100, 1)}%` : id === 'apartments' ? formatNumber(x, 0) : formatCurrency(x));
  const deltaClass = (d: { delta: number | null; higherIsBetter: boolean | null }) =>
    d.delta === null || d.higherIsBetter === null || Math.abs(d.delta) < 1 ? '' : (d.delta > 0) === d.higherIsBetter ? 'cell-ok' : 'cell-fail';
  const STATUS: Record<string, string> = { valid: 'בתוקף בתאריך ההשוואה', expired: 'פג תוקף', not_yet_valid: 'עוד לא בתוקף', undated: 'בלי תאריך תוקף' };
  return (
    <section className="card detail-section" aria-labelledby="offer-title">
      <h2 id="offer-title">בדיקת הצעה בפועל מהיזם</h2>
      <p className="card-sub">
        הזינו רק מה שכתוב בהצעה. שדה ריק = לא ידוע: נחשב לפי ההנחות שלנו ונציג אותו כשאלה ליזם או ליועץ. ההשוואה באותו בסיס ובאותו תאריך כמו
        ההמלצה. הנתונים לא נשמרים ולא נשלחים.
      </p>
      <div className="offer-grid no-print">
        <Field label="תאריך ההצעה">
          <input type="date" value={o.offerDate ?? ''} onChange={(e) => set({ offerDate: e.target.value || null })} />
        </Field>
        <Field label="בתוקף עד">
          <input type="date" value={o.validUntil ?? ''} onChange={(e) => set({ validUntil: e.target.value || null })} />
        </Field>
        <Field label="מגרש בהצעה">
          <select value={o.lotId ?? ''} onChange={(e) => set({ lotId: e.target.value || null })}>
            <option value="">לא צוין</option>
            {config.rights.lotIds.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="אחוז קומבינציה (%)">
          <input inputMode="decimal" value={pctOut(o.combinationPct)} onChange={(e) => set({ combinationPct: pctIn(e.target.value) })} />
        </Field>
        <Field label="רווח יזמי על שירותי בנייה (%)">
          <input inputMode="decimal" value={pctOut(o.markup)} onChange={(e) => set({ markup: pctIn(e.target.value) })} />
        </Field>
        <Field label="מחיר שירותי בנייה למ״ר (₪, לפני רווח ומע״מ)">
          <input inputMode="numeric" value={o.construction.pricePerSqm ?? ''} onChange={(e) => set({ construction: { ...o.construction, pricePerSqm: num(e.target.value) } })} />
        </Field>
        <Field label="המחיר מחושב על שטח">
          <select
            value={o.construction.areaBasis ?? ''}
            onChange={(e) => set({ construction: { ...o.construction, areaBasis: e.target.value === 'licensed' || e.target.value === 'door_to_door' ? e.target.value : null } })}
          >
            <option value="">לא צוין</option>
            <option value="licensed">רישוי (ברוטו)</option>
            <option value="door_to_door">דירה (מקיר לקיר)</option>
          </select>
        </Field>
        <Field label="מחיר השלמה לדירה שלמה (₪ למ״ר)">
          <input inputMode="numeric" value={o.completion.pricePerSqm ?? ''} onChange={(e) => set({ completion: { pricePerSqm: num(e.target.value) } })} />
        </Field>
        <SideSelect label="היטל השבחה — משלם" value={o.taxes.levy} onChange={(levy) => set({ taxes: { ...o.taxes, levy } })} />
        <Field label="תקרת ההיטל שהיזם משלם (₪)">
          <input inputMode="numeric" value={o.taxes.levyCap ?? ''} onChange={(e) => set({ taxes: { ...o.taxes, levyCap: num(e.target.value) } })} />
        </Field>
        <SideSelect label="מס שבח — משלם" value={o.taxes.capitalGains} onChange={(capitalGains) => set({ taxes: { ...o.taxes, capitalGains } })} />
        <SideSelect label="מע״מ על שירותי הבנייה — משלם" value={o.taxes.vat} onChange={(vat) => set({ taxes: { ...o.taxes, vat } })} />
        {(['signing', 'permit', 'construction', 'delivery'] as const).map((k) => (
          <Field key={k} label={`תשלום ליזם — ${{ signing: 'בחתימה', permit: 'בהיתר', construction: 'במהלך הבנייה', delivery: 'במסירה' }[k]} (%)`}>
            <input inputMode="decimal" value={pctOut(o.schedule[k])} onChange={(e) => set({ schedule: { ...o.schedule, [k]: pctIn(e.target.value) } })} />
          </Field>
        ))}
        <Field label="הלוואת מסים מהיזם">
          <select value={triOut(o.taxLoan.offered)} onChange={(e) => set({ taxLoan: { ...o.taxLoan, offered: tri(e.target.value) } })}>
            <option value="">לא צוין</option>
            <option value="yes">מוצעת</option>
            <option value="no">לא מוצעת</option>
          </select>
        </Field>
        {o.taxLoan.offered && (
          <>
            <Field label="סכום מרבי (₪)">
              <input inputMode="numeric" value={o.taxLoan.amountCap ?? ''} onChange={(e) => set({ taxLoan: { ...o.taxLoan, amountCap: num(e.target.value) } })} />
            </Field>
            <Field label="ריבית שנתית (%)">
              <input inputMode="decimal" value={pctOut(o.taxLoan.annualRate)} onChange={(e) => set({ taxLoan: { ...o.taxLoan, annualRate: pctIn(e.target.value) } })} />
            </Field>
            <SideSelect label="הריבית על חשבון" value={o.taxLoan.interestPaidBy} onChange={(interestPaidBy) => set({ taxLoan: { ...o.taxLoan, interestPaidBy } })} />
          </>
        )}
        <Field label="ערבות על התשלומים">
          <select value={o.guarantee ?? ''} onChange={(e) => set({ guarantee: e.target.value === 'sale_law' || e.target.value === 'none' ? e.target.value : null })}>
            <option value="">לא צוין</option>
            <option value="sale_law">ערבות חוק המכר / נאמנות</option>
            <option value="none">אין ערבות</option>
          </select>
        </Field>
        <Field label="הדירה שתקבלו מוגדרת בהצעה">
          <select value={triOut(o.inventory.confirmed)} onChange={(e) => set({ inventory: { ...o.inventory, confirmed: tri(e.target.value) } })}>
            <option value="">לא צוין</option>
            <option value="yes">כן (גודל וקומה מוגדרים)</option>
            <option value="no">לא</option>
          </select>
        </Field>
        <Field label="דמי אופציה למעבר מסלול (₪, אם מוצעת)">
          <input inputMode="numeric" value={o.option.fee ?? ''} onChange={(e) => set({ option: { ...o.option, fee: num(e.target.value) } })} />
        </Field>
      </div>
      {res.terms.errors.length > 0 && (
        <ul className="field-error" role="alert">
          {res.terms.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {anyEntered && res.offerRoute && (
        <>
          <p>
            <strong>{STATUS[res.terms.status]}</strong> · השוואה בערך נוכחי במחירי היום נכון ל-{res.comparisonDate} · המסלול בהצעה: {strategyTitle(res.offerRoute.result)}
            {res.offerRoute.owner.accepts ? '' : ` (לא מתאים לכם: ${res.offerRoute.owner.reason ?? '—'})`}
          </p>
          {res.terms.warnings.length > 0 && (
            <ul className="callout">
              {res.terms.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <OfferDelta diff={res.diff} />
          <RightsFlow r={res.offerRoute.result} entitlement={calculateRights(profile.landAreaSqm, res.terms.config, profile.lotId).apartmentEquivalents} title="לאן הולכות הזכויות לפי ההצעה" />
          <div className="table-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th />
                  <th>לפי התנאים המשוערים</th>
                  <th>לפי ההצעה</th>
                  <th>שינוי</th>
                </tr>
              </thead>
              <tbody>
                {res.diff.map((d) => (
                  <tr key={d.id}>
                    <th>{d.label}</th>
                    <td>{money(d.base, d.id)}</td>
                    <td>{money(d.offer, d.id)}</td>
                    <td className={deltaClass(d)}>{d.delta === null ? '—' : `${d.delta > 0 ? '+' : d.delta < 0 ? '−' : ''}${money(Math.abs(d.delta), d.id)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field-hint">
            הוזנו {res.terms.entered.length} תנאים; {res.terms.missing.length} חסרים וחושבו לפי ההנחות שלנו. ״רווח היזם״ — לפי המודל, לא נתון של היזם.
          </p>
        </>
      )}
      {anyEntered && (
        <>
          <h3>שאלות ליזם וליועצים</h3>
          <ol className="offer-questions">
            {res.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
