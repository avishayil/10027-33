/** Input building blocks shared by the onboarding wizard and the main screen. */
import { useId } from 'react';
import { PROJECT_CONFIG } from '../../data/config';
import { mortgageCapacity } from '../../domain/mortgage';
import type { Goal } from '../../domain/types';
import type { DecisionEngine } from '../../hooks/useDecisionEngine';
import { GOAL_LABELS } from '../../optimizer/explain';
import { formatCurrency, formatNumber } from '../../utils/format';

/**
 * The three questions a landowner actually asks: what pays best, do I end up with an apartment, can I avoid debt.
 * "Most apartments" became "a whole apartment" — the developer releases at most one apartment per owner, so for
 * almost everyone "more apartments" means one whole apartment. Rental income follows from keeping that apartment,
 * and "cash soon" is what the no-debt route already favours (combination or selling, no loans). The engine still
 * understands the two retired goals so older saved answers keep working (they are migrated on load).
 */
export const GOALS: Goal[] = ['balanced', 'maximize_apartments', 'minimize_risk'];

export const GOAL_HINTS: Record<Goal, string> = {
  balanced: 'מה שמשאיר לכם הכי הרבה ערך בסוף, בלי להסתכן יותר מדי. מתאים לרוב האנשים.',
  maximize_apartments: 'לגור בה או להשכיר אותה. גם אם צריך להשלים תשלום ליזם או לקחת משכנתא.',
  passive_income: 'העדיפות היא הכנסה חודשית קבועה אחרי החזרי המשכנתא.',
  immediate_cash: 'העדיפות היא לקבל כסף ביד בתוך זמן קצר.',
  minimize_risk: 'בלי משכנתא ובלי התחייבויות. גם אם זה פחות רווחי, או אומר למכור.',
};

/** Presets chosen from the engine's own thresholds for 167 m² (2.25 rights) — see DECISIONS #53. */
export const CAPITAL_PRESETS = [0, 250_000, 500_000, 750_000, 1_000_000];
export const REPAYMENT_PRESETS = [2_500, 4_000, 6_000, 8_000, 10_000];
/** Common holdings in the original parcel (m²). */
export const AREA_PRESETS = [167, 334, 500];

const pct = (x: number) => `${formatNumber(x * 100, (x * 100) % 1 === 0 ? 0 : 1)}%`;

/** Digits only, shown with thousands separators. Empty stays empty (= not answered). */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  label,
  invalid,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  label?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const digits = value.replace(/[^\d]/g, '');
  const shown = digits === '' ? '' : new Intl.NumberFormat('he-IL').format(Number(digits));
  return (
    <div className="money-input">
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
      />
      <span className="money-suffix" aria-hidden="true">
        ₪
      </span>
    </div>
  );
}

export function LandFields({ engine }: { engine: DecisionEngine }) {
  const { inputs: i, errors, result } = engine;
  const ids = { area: useId(), err: useId(), lot: useId() };
  const rights = result?.rights.apartmentEquivalents ?? 0;
  return (
    <div className="fields">
      <div className="rights-row">
        <div className="field">
          <label htmlFor={ids.area}>כמה מ״ר קרקע בבעלותכם בחלקה המקורית?</label>
          <input
            id={ids.area}
            className="input-large"
            inputMode="decimal"
            autoComplete="off"
            value={i.areaText}
            onChange={(e) => i.setAreaText(e.target.value)}
            aria-invalid={!!errors.area || undefined}
            aria-describedby={errors.area ? ids.err : undefined}
          />
          <div className="chip-row" role="group" aria-label="שטחים נפוצים">
            {AREA_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={i.areaText === String(v)}
                className={`btn-chip ${i.areaText === String(v) ? 'active' : ''}`}
                onClick={() => i.setAreaText(String(v))}
              >
                {v} מ״ר
              </button>
            ))}
          </div>
        </div>
        <div className="rights-badge" aria-live="polite">
          <span>זכויות משוערות לדירה</span>
          <strong>{errors.area ? '—' : formatNumber(rights, rights % 1 === 0 ? 0 : 2)}</strong>
        </div>
      </div>
      {errors.area && (
        <p className="field-error" id={ids.err} role="alert">
          {errors.area}
        </p>
      )}
      <p className="field-hint">
        השטח במ״ר הוא החלק שלכם בחלקה המקורית — רק דרך נוחה לתאר אותו. כל החישובים לפי הטבלאות המעודכנות
        (106(ב)): כל {PROJECT_CONFIG.rights.originalAreaSqm} מ״ר ≈ {PROJECT_CONFIG.rights.apartmentEquivalents} זכויות לדירה
        (הנחת הסימולציה; הטבלה מראה כ-2.4 יח״ד).
      </p>
      <div className="field">
        <label htmlFor={ids.lot}>המגרש שהוקצה לכם (לא חובה)</label>
        <select id={ids.lot} value={i.lotId} onChange={(e) => i.setLotId(e.target.value)}>
          <option value="">לא יודע/ת (מחושב לפי מגרש 149)</option>
          {PROJECT_CONFIG.rights.lotIds.map((l) => (
            <option key={l} value={l}>
              מגרש {l}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function CapitalField({ engine }: { engine: DecisionEngine }) {
  const { inputs: i, errors } = engine;
  const ids = { input: useId(), hint: useId() };
  return (
    <div className="fields">
      <div className="field">
        <label htmlFor={ids.input}>כמה כסף פנוי תוכלו להשקיע?</label>
        <MoneyInput
          id={ids.input}
          value={i.capitalText}
          onChange={i.setCapitalText}
          placeholder="למשל 200,000"
          invalid={!!errors.capital}
          describedBy={ids.hint}
        />
      </div>
      <div className="chip-row" role="group" aria-label="סכומים נפוצים">
        {CAPITAL_PRESETS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={i.capitalText === String(v)}
            className={`btn-chip ${i.capitalText === String(v) ? 'active' : ''}`}
            onClick={() => i.setCapitalText(String(v))}
          >
            {v === 0 ? 'אין (0 ₪)' : formatCurrency(v)}
          </button>
        ))}
      </div>
      <p className="field-hint" id={ids.hint}>
        לא כולל כסף שתרצו לשמור בצד למקרי חירום. מסים והיטל השבחה משולמים מכסף פנוי — בנקים לא מממנים אותם.
      </p>
    </div>
  );
}

export function RepaymentFields({ engine }: { engine: DecisionEngine }) {
  const { inputs: i, errors } = engine;
  const ids = { input: useId(), hint: useId() };
  const amount = Number(i.repaymentText.replace(/[^\d]/g, ''));
  const capacity =
    i.repaymentMode === 'amount' && amount > 0
      ? mortgageCapacity(amount, PROJECT_CONFIG.financing.nominalAnnualInterest, PROJECT_CONFIG.financing.durationYears)
      : null;
  return (
    <div className="fields">
      <div className="field">
        <label htmlFor={ids.input}>כמה תוכלו להחזיר בחודש על משכנתא חדשה?</label>
        <MoneyInput
          id={ids.input}
          value={i.repaymentMode === 'amount' ? i.repaymentText : ''}
          onChange={(v) => {
            i.setRepaymentMode('amount');
            i.setRepaymentText(v);
          }}
          placeholder="למשל 4,000"
          invalid={!!errors.repayment}
          describedBy={ids.hint}
        />
      </div>
      <div className="chip-row" role="group" aria-label="סכומים נפוצים">
        {REPAYMENT_PRESETS.map((v) => {
          const on = i.repaymentMode === 'amount' && i.repaymentText === String(v);
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              className={`btn-chip ${on ? 'active' : ''}`}
              onClick={() => {
                i.setRepaymentMode('amount');
                i.setRepaymentText(String(v));
              }}
            >
              {formatCurrency(v)}
            </button>
          );
        })}
      </div>
      <div className="chip-row" role="group" aria-label="תשובות אחרות">
        <button
          type="button"
          aria-pressed={i.repaymentMode === 'none'}
          className={`btn-chip ${i.repaymentMode === 'none' ? 'active' : ''}`}
          onClick={() => i.setRepaymentMode('none')}
        >
          לא אקח משכנתא
        </button>
        <button
          type="button"
          aria-pressed={i.repaymentMode === 'unknown'}
          className={`btn-chip ${i.repaymentMode === 'unknown' ? 'active' : ''}`}
          onClick={() => i.setRepaymentMode('unknown')}
        >
          עוד לא יודע/ת
        </button>
      </div>
      <p className="field-hint" id={ids.hint}>
        {capacity !== null
          ? `זה מספיק בערך למשכנתא של ${formatCurrency(capacity)} (25 שנה, ריבית 5%). אישור בפועל — רק מהבנק.`
          : i.repaymentMode === 'unknown'
            ? 'נסמן מסלולים שדורשים משכנתא כ״מתאים עם מימון״ ונסביר כמה החזר הם צריכים.'
            : 'כלל אצבע: ההחזר החודשי לא יעלה על כ-30% מההכנסה הפנויה של משק הבית.'}
      </p>
    </div>
  );
}

export function GoalFields({ engine, name = 'goal' }: { engine: DecisionEngine; name?: string }) {
  const { inputs: i } = engine;
  return (
    <fieldset className="fields goal-list">
      <legend className="sr-only">מה חשוב לי</legend>
      {GOALS.map((g) => (
        <label key={g} className={`goal-option ${i.goal === g ? 'active' : ''}`}>
          <input type="radio" name={name} checked={i.goal === g} onChange={() => i.setGoal(g)} />
          <span>
            <strong>{GOAL_LABELS[g]}</strong>
            <span className="goal-hint">{GOAL_HINTS[g]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function RangeField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  marks,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  marks: number[];
}) {
  const id = useId();
  return (
    <div className="range-field">
      <label className="range-head" htmlFor={id}>
        <span>{label}</span>
        <strong>{pct(value)}</strong>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={0.005}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={pct(value)}
      />
      <span className="range-scale" aria-hidden="true">
        {marks.map((m) => (
          <span key={m}>{pct(m)}</span>
        ))}
      </span>
      <p className="field-hint">{hint}</p>
    </div>
  );
}

export function TermsFields({ engine }: { engine: DecisionEngine }) {
  const { inputs: i, result } = engine;
  const c = PROJECT_CONFIG.commercial;
  const R = result?.rights.apartmentEquivalents ?? 0;
  return (
    <div className="fields terms-fields">
      <RangeField
        label="אחוז קומבינציה"
        hint={`איזה חלק מהזכויות חוזר אליכם כדירות גמורות. ב-${pct(i.combinationPct)}: ${formatNumber(R * i.combinationPct, 2)} דירות מתוך ${formatNumber(R, 2)} הזכויות שלכם. זו הנחה לבדיקה — לא הצעה מאושרת.`}
        value={i.combinationPct}
        min={c.combination.min}
        max={c.combination.max}
        onChange={i.setCombinationPct}
        marks={[c.combination.min, c.combination.default, c.combination.max]}
      />
      <RangeField
        label="רווח יזמי בשירותי בנייה"
        hint="התוספת שהיזם גובה מעל עלות הבנייה כשאתם משלמים על הבנייה בעצמכם. הנחה — לא הצעה מאושרת."
        value={i.developerMarkup}
        min={c.developerMarkup.min}
        max={c.developerMarkup.max}
        onChange={i.setDeveloperMarkup}
        marks={[c.developerMarkup.min, c.developerMarkup.max]}
      />
    </div>
  );
}

export function BasisField({ engine, open = false }: { engine: DecisionEngine; open?: boolean }) {
  const { inputs: i, errors } = engine;
  const id = useId();
  const homeId = useId();
  return (
    <details className="optional-inputs" open={open}>
      <summary>פרטים נוספים שמשפרים את אומדן המסים (לא חובה)</summary>
      <div className="field">
        <label htmlFor={homeId}>אם תקבלו דירה — האם היא תהיה הדירה היחידה שלכם?</label>
        <select id={homeId} value={i.soleHome} onChange={(e) => i.setSoleHome(e.target.value as 'unknown' | 'yes' | 'no')}>
          <option value="unknown">לא יודע/ת</option>
          <option value="yes">כן, דירה יחידה</option>
          <option value="no">לא, יש לנו דירה נוספת</option>
        </select>
      </div>
      <p className="field-hint">משפיע על מס הרכישה אם תשלמו ליזם על השלמה לדירה שלמה (0% לדירה יחידה, עד כ-8% לנוספת).</p>
      <div className="field">
        <label htmlFor={id}>כמה שולם על הקרקע כשנרכשה (₪, סה״כ)?</label>
        <MoneyInput id={id} value={i.basisText} onChange={i.setBasisText} placeholder="ריק = לא ידוע" invalid={!!errors.basis} />
      </div>
      <p className="field-hint">בלי הנתון הזה מס השבח מחושב בהנחה השמרנית (עלות רכישה אפס).</p>
    </details>
  );
}

/** One-line descriptions of the current answers, for the wizard summary and the main screen. */
export function describeAnswers(engine: DecisionEngine) {
  const { inputs: i, landArea, result } = engine;
  const money = (t: string) => (t === '' ? 'לא הוזן' : t === '0' ? 'אין' : formatCurrency(Number(t)));
  return {
    land:
      landArea === null
        ? 'לא הוזן'
        : `${formatNumber(landArea, landArea % 1 === 0 ? 0 : 2)} מ״ר · ${formatNumber(result?.rights.apartmentEquivalents ?? 0, 2)} זכויות${i.lotId ? ` · מגרש ${i.lotId}` : ''}`,
    capital: money(i.capitalText),
    repayment:
      i.repaymentMode === 'none'
        ? 'ללא משכנתא'
        : i.repaymentMode === 'unknown'
          ? 'עוד לא ידוע'
          : i.repaymentText === ''
            ? 'לא הוזן'
            : `עד ${formatCurrency(Number(i.repaymentText))} בחודש`,
    goal: GOAL_LABELS[i.goal],
    terms: `קומבינציה ${pct(i.combinationPct)} · רווח יזמי ${pct(i.developerMarkup)}`,
  };
}
