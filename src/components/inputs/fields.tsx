/** Input building blocks shared by the onboarding wizard and the main screen. */
import { useId } from 'react';
import { PROJECT_CONFIG } from '../../data/config';
import { mortgageCapacity } from '../../domain/mortgage';
import type { Goal } from '../../domain/types';
import type { DecisionEngine } from '../../hooks/useDecisionEngine';
import { GOAL_LABELS } from '../../optimizer/explain';
import { formatCurrency, formatNumber } from '../../utils/format';
import { SegmentedToggle } from '../SegmentedToggle';

export const GOALS: Goal[] = ['balanced', 'maximize_apartments', 'passive_income', 'immediate_cash', 'minimize_risk'];

export const GOAL_HINTS: Record<Goal, string> = {
  balanced: 'מאזנים בין רווח, ביטחון ופשטות. מתאים לרוב האנשים.',
  maximize_apartments: 'העדיפות היא לסיים עם כמה שיותר דירות שלמות — גם אם זה דורש משכנתא.',
  passive_income: 'העדיפות היא הכנסה חודשית קבועה אחרי החזרי המשכנתא.',
  immediate_cash: 'העדיפות היא לקבל כסף ביד בתוך זמן קצר.',
  minimize_risk: 'העדיפות היא בלי חובות ובלי הימורים על מחירים או ריביות.',
};

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
      <SegmentedToggle
        options={[
          { value: 'sqm', label: 'לפי מ״ר' },
          { value: 'fraction', label: 'לפי שבר בטאבו' },
        ]}
        value={i.areaMode}
        onChange={i.setAreaMode}
        label="אופן הזנת הזכויות"
      />
      <div className="rights-row">
        <div className="field">
          <label htmlFor={ids.area}>
            {i.areaMode === 'sqm' ? 'כמה מ״ר קרקע בבעלותכם בחלקה המקורית?' : 'השבר שלכם בחלקה (מהנסח או מהטבלה)'}
          </label>
          {i.areaMode === 'sqm' ? (
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
          ) : (
            <input
              id={ids.area}
              className="input-large"
              dir="ltr"
              autoComplete="off"
              value={i.fractionText}
              onChange={(e) => i.setFractionText(e.target.value)}
              placeholder="167/21258"
              aria-invalid={!!errors.area || undefined}
              aria-describedby={errors.area ? ids.err : undefined}
            />
          )}
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
        כל {PROJECT_CONFIG.rights.originalAreaSqm} מ״ר ≈ {PROJECT_CONFIG.rights.apartmentEquivalents} זכויות לדירה. זו הנחת
        הסימולציה — הטבלה הרשמית מראה מעט יותר.
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
      <div className="chip-row">
        <button type="button" className={`btn-chip ${i.capitalText === '0' ? 'active' : ''}`} onClick={() => i.setCapitalText('0')}>
          אין לי כסף פנוי (0)
        </button>
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
      {i.goal === 'immediate_cash' && (
        <label className="field">
          <span>תוך כמה זמן אתם צריכים את הכסף?</span>
          <select value={i.deadlineYears} onChange={(e) => i.setDeadlineYears(Number(e.target.value))}>
            {[1, 2, 3, 5].map((y) => (
              <option key={y} value={y}>
                {y === 1 ? 'שנה' : `${y} שנים`}
              </option>
            ))}
          </select>
        </label>
      )}
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
        hint={`איזה חלק מהזכויות חוזר אליכם כדירות גמורות. ב-${pct(i.combinationPct)}: ${formatNumber(R * i.combinationPct, 2)} דירות מתוך ${formatNumber(R, 2)} הזכויות שלכם.`}
        value={i.combinationPct}
        min={c.combination.min}
        max={c.combination.max}
        onChange={i.setCombinationPct}
        marks={[c.combination.min, c.combination.default, c.combination.max]}
      />
      <RangeField
        label="רווח יזמי בשירותי בנייה"
        hint="התוספת שהיזם גובה מעל עלות הבנייה כשאתם משלמים על הבנייה בעצמכם."
        value={i.developerMarkup}
        min={c.developerMarkup.min}
        max={c.developerMarkup.max}
        onChange={i.setDeveloperMarkup}
        marks={[c.developerMarkup.min, c.developerMarkup.max]}
      />
    </div>
  );
}

export function BasisField({ engine }: { engine: DecisionEngine }) {
  const { inputs: i, errors } = engine;
  const id = useId();
  return (
    <details className="optional-inputs">
      <summary>פרט נוסף שמשפר את אומדן מס השבח (לא חובה)</summary>
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
