import type { FollowUpQuestion } from '../../domain/types';
import type { WizardStep } from '../inputs/Wizard';

const STEP_FOR: Record<string, WizardStep> = {
  capital: 'capital',
  repayment: 'repayment',
  basis: 'summary',
  lot: 'land',
};

export function FollowUps({ questions, onAnswer }: { questions: FollowUpQuestion[]; onAnswer: (step: WizardStep) => void }) {
  if (!questions.length) return null;
  return (
    <section className="card followups no-print" aria-labelledby="followups-title">
      <h2 id="followups-title">תשובה אחת נוספת יכולה לשנות את ההמלצה</h2>
      <ul>
        {questions.map((q) => (
          <li key={q.id}>
            <strong>{q.question}</strong>
            <span className="summary-sub">{q.why}</span>
            <button type="button" className="btn-chip" onClick={() => onAnswer(STEP_FOR[q.id] ?? 'summary')}>
              לענות עכשיו
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
