import type { Goal } from '../../domain/types';
import type { DecisionEngine } from '../../hooks/useDecisionEngine';
import { GOAL_LABELS } from '../../optimizer/explain';
import { ALL_GOALS, describeAnswers, TermsFields } from './fields';
import type { WizardStep } from './Wizard';

interface Props {
  engine: DecisionEngine;
  saved: boolean;
  onEdit: (step: WizardStep) => void;
  onForget: () => void;
}

/** The user's answers at a glance, each editable, plus where they are stored. */
export function AnswersBar({ engine, saved, onEdit, onForget }: Props) {
  const a = describeAnswers(engine);
  const items: { step: WizardStep; label: string; value: string }[] = [
    { step: 'land', label: 'הזכויות שלי', value: a.land },
    { step: 'capital', label: 'כסף פנוי', value: a.capital },
    { step: 'repayment', label: 'החזר חודשי', value: a.repayment },
    { step: 'goal', label: 'מה חשוב לי', value: a.goal },
  ];
  return (
    <section className="card answers-bar no-print" aria-labelledby="answers-title">
      <div className="answers-head">
        <h2 id="answers-title">התשובות שלכם</h2>
        <button type="button" className="btn-secondary btn-small" onClick={() => onEdit('summary')}>
          עריכת התשובות
        </button>
      </div>
      <dl className="answers-grid">
        {items.map((it) => (
          <div key={it.step}>
            <dt>{it.label}</dt>
            <dd>
              <span>{it.value}</span>
              <button type="button" className="link-btn" onClick={() => onEdit(it.step)} aria-label={`שינוי: ${it.label}`}>
                שינוי
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <p className="answers-storage">
        {saved ? (
          <>
            🔒 התשובות שמורות בדפדפן הזה בלבד.{' '}
            <button type="button" className="link-btn" onClick={onForget}>
              מחיקת התשובות השמורות
            </button>
          </>
        ) : (
          '🔒 התשובות לא נשמרות — הן יימחקו כשתסגרו את הדף.'
        )}
      </p>
    </section>
  );
}

export function TermsCard({ engine }: { engine: DecisionEngine }) {
  return (
    <section className="card terms-card no-print" aria-labelledby="terms-title">
      <h2 id="terms-title">תנאים משוערים מול היזם</h2>
      <p className="card-sub">הזיזו כדי לראות מיד איך התנאים משנים את ההמלצה.</p>
      <TermsFields engine={engine} />
      <AllGoals engine={engine} />
    </section>
  );
}

/** Advanced view (V1 / D-2): all five goals; the wizard keeps the three most people ask about. */
function AllGoals({ engine }: { engine: DecisionEngine }) {
  return (
    <label className="inline-field">
      מה חשוב לכם (כל האפשרויות){' '}
      <select aria-label="מה חשוב לכם — כל האפשרויות" value={engine.inputs.goal} onChange={(e) => engine.inputs.setGoal(e.target.value as Goal)}>
        {ALL_GOALS.map((g) => (
          <option key={g} value={g}>
            {GOAL_LABELS[g]}
          </option>
        ))}
      </select>
    </label>
  );
}
