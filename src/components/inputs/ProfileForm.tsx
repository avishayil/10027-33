import { PROJECT_CONFIG } from '../../data/config';
import type { Goal } from '../../domain/types';
import type { DecisionEngine } from '../../hooks/useDecisionEngine';
import { mortgageCapacity } from '../../domain/mortgage';
import { GOAL_LABELS } from '../../optimizer/explain';
import { formatCurrency, formatNumber } from '../../utils/format';
import { SegmentedToggle } from '../SegmentedToggle';

const GOALS: Goal[] = ['balanced', 'maximize_apartments', 'passive_income', 'immediate_cash', 'minimize_risk'];

const pct = (x: number) => `${formatNumber(x * 100, x * 100 % 1 === 0 ? 0 : 1)}%`;

interface Props {
  engine: DecisionEngine;
}

export function ProfileForm({ engine }: Props) {
  const { inputs: i, errors, result } = engine;
  const c = PROJECT_CONFIG.commercial;
  const rights = result?.rights.apartmentEquivalents ?? 0;
  const repaymentAmount = Number(i.repaymentText.replace(/[,\s₪]/g, ''));
  const capacity =
    i.repaymentMode === 'amount' && repaymentAmount > 0
      ? mortgageCapacity(repaymentAmount, PROJECT_CONFIG.financing.nominalAnnualInterest, PROJECT_CONFIG.financing.durationYears)
      : null;

  return (
    <div className="profile-form no-print">
      <section className="card step-card">
        <h2>
          <span className="step-num">1</span> הזכויות שלי
        </h2>
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
          {i.areaMode === 'sqm' ? (
            <label className="field">
              <span>כמה מ״ר קרקע בבעלותכם בחלקה המקורית?</span>
              <input
                className="input-large"
                inputMode="decimal"
                value={i.areaText}
                onChange={(e) => i.setAreaText(e.target.value)}
                aria-invalid={!!errors.area}
              />
            </label>
          ) : (
            <label className="field">
              <span>השבר שלכם בחלקה (כפי שמופיע בנסח או בטבלה)</span>
              <input
                className="input-large"
                dir="ltr"
                value={i.fractionText}
                onChange={(e) => i.setFractionText(e.target.value)}
                placeholder="167/21258"
                aria-invalid={!!errors.area}
              />
            </label>
          )}
          <div className="rights-badge" aria-live="polite">
            <span>זכויות משוערות לדירה</span>
            <strong>{errors.area ? '—' : formatNumber(rights, rights % 1 === 0 ? 0 : 2)}</strong>
          </div>
        </div>
        {errors.area && <p className="field-error">{errors.area}</p>}
        <p className="field-hint">
          כל 167 מ״ר ≈ {PROJECT_CONFIG.rights.apartmentEquivalents} זכויות לדירה (הנחת הסימולציה).
        </p>
        <label className="field field-inline">
          <span>המגרש שהוקצה לכם (לא חובה)</span>
          <select value={i.lotId} onChange={(e) => i.setLotId(e.target.value)}>
            <option value="">לא יודע/ת (מגרש 149)</option>
            {PROJECT_CONFIG.rights.lotIds.map((l) => (
              <option key={l} value={l}>
                מגרש {l}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card step-card">
        <h2>
          <span className="step-num">2</span> היכולת הכלכלית שלי
        </h2>
        <label className="field">
          <span>כמה כסף פנוי תוכלו להשקיע?</span>
          <input
            inputMode="numeric"
            placeholder="למשל 200,000 — או 0"
            value={i.capitalText}
            onChange={(e) => i.setCapitalText(e.target.value)}
            aria-invalid={!!errors.capital}
          />
        </label>
        <p className="field-hint">לא כולל כסף שתרצו לשמור בצד למקרי חירום. אפשר להזין 0.</p>
        {errors.capital && <p className="field-error">{errors.capital}</p>}

        <div className="field">
          <span>כמה תוכלו להחזיר בחודש על משכנתא חדשה?</span>
          <div className="repay-row">
            <input
              inputMode="numeric"
              placeholder="למשל 4,000"
              value={i.repaymentMode === 'amount' ? i.repaymentText : ''}
              onChange={(e) => {
                i.setRepaymentMode('amount');
                i.setRepaymentText(e.target.value);
              }}
              aria-label="החזר חודשי מקסימלי"
              aria-invalid={!!errors.repayment}
            />
            <button
              type="button"
              className={`btn-chip ${i.repaymentMode === 'none' ? 'active' : ''}`}
              onClick={() => i.setRepaymentMode('none')}
            >
              ללא משכנתא
            </button>
            <button
              type="button"
              className={`btn-chip ${i.repaymentMode === 'unknown' ? 'active' : ''}`}
              onClick={() => i.setRepaymentMode('unknown')}
            >
              לא יודע/ת
            </button>
          </div>
        </div>
        {errors.repayment && <p className="field-error">{errors.repayment}</p>}
        <p className="field-hint">
          {capacity !== null
            ? `בערך משכנתא של ${formatCurrency(capacity)} (25 שנה, ריבית 5%). אישור בפועל — רק מהבנק.`
            : 'מומלץ שההחזר לא יעלה על כ-30% מההכנסה הפנויה של משק הבית.'}
        </p>
      </section>

      <section className="card step-card">
        <h2>
          <span className="step-num">3</span> מה חשוב לי?
        </h2>
        <div className="goal-list" role="radiogroup" aria-label="מה חשוב לי">
          {GOALS.map((g) => (
            <label key={g} className={`goal-option ${i.goal === g ? 'active' : ''}`}>
              <input type="radio" name="goal" checked={i.goal === g} onChange={() => i.setGoal(g)} />
              {GOAL_LABELS[g]}
            </label>
          ))}
        </div>
        {i.goal === 'immediate_cash' && (
          <label className="field field-inline">
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
      </section>

      <section className="card step-card">
        <h2>
          <span className="step-num">4</span> תנאים משוערים מול היזם
        </h2>
        <label className="range-field">
          <span className="range-head">
            אחוז קומבינציה <strong>{pct(i.combinationPct)}</strong>
          </span>
          <input
            type="range"
            min={c.combination.min}
            max={c.combination.max}
            step={0.005}
            value={i.combinationPct}
            onChange={(e) => i.setCombinationPct(Number(e.target.value))}
            aria-label="אחוז קומבינציה"
          />
          <span className="range-scale">
            <span>{pct(c.combination.min)}</span>
            <span>{pct(c.combination.default)}</span>
            <span>{pct(c.combination.max)}</span>
          </span>
        </label>
        <label className="range-field">
          <span className="range-head">
            רווח יזמי בשירותי בנייה <strong>{pct(i.developerMarkup)}</strong>
          </span>
          <input
            type="range"
            min={c.developerMarkup.min}
            max={c.developerMarkup.max}
            step={0.005}
            value={i.developerMarkup}
            onChange={(e) => i.setDeveloperMarkup(Number(e.target.value))}
            aria-label="רווח יזמי"
          />
          <span className="range-scale">
            <span>{pct(c.developerMarkup.min)}</span>
            <span>{pct(c.developerMarkup.max)}</span>
          </span>
        </label>
        <details className="optional-inputs">
          <summary>פרט נוסף שמשפר את אומדן המס (לא חובה)</summary>
          <label className="field">
            <span>כמה שולם על הקרקע כשנרכשה (₪, סה״כ)?</span>
            <input
              inputMode="numeric"
              placeholder="ריק = לא ידוע"
              value={i.basisText}
              onChange={(e) => i.setBasisText(e.target.value)}
            />
          </label>
          <p className="field-hint">בלי הנתון הזה מס השבח מחושב בהנחה השמרנית (עלות רכישה אפס).</p>
          {errors.basis && <p className="field-error">{errors.basis}</p>}
        </details>
      </section>
    </div>
  );
}
