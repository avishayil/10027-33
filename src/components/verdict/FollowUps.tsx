import type { FollowUpQuestion } from '../../domain/types';

export function FollowUps({ questions }: { questions: FollowUpQuestion[] }) {
  if (!questions.length) return null;
  return (
    <section className="card followups no-print">
      <h2>שאלות שישפרו את התשובה</h2>
      <ul>
        {questions.map((q) => (
          <li key={q.id}>
            <strong>{q.question}</strong>
            <span className="summary-sub">{q.why}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
