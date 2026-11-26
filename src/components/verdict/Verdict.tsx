import type { DecisionResult, Goal, StrategyResult } from '../../domain/types';
import { apartmentValueToday } from '../../domain/valuation';
import { constructionQuotePerApartment } from '../../domain/construction';
import { PROJECT_CONFIG } from '../../data/config';
import {
  CONDITION_TEXT,
  FEASIBILITY_HINTS,
  FEASIBILITY_LABELS,
  REASON_TEXT,
  STRATEGY_DESCRIPTIONS,
  explainWhy,
  formatRights,
  strategyTitle,
} from '../../optimizer/explain';
import { formatCurrency } from '../../utils/format';

export function StatusBadge({ r }: { r: StrategyResult }) {
  return (
    <span className={`status status-${r.feasibility}`} title={FEASIBILITY_HINTS[r.feasibility]}>
      {FEASIBILITY_LABELS[r.feasibility]}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface Props {
  result: DecisionResult;
  goal: Goal;
  combinationPct: number;
  developerMarkup: number;
}

export function Verdict({ result, goal, combinationPct, developerMarkup }: Props) {
  const rec = result.recommendation;
  const R = result.rights.apartmentEquivalents;

  if (!rec) {
    return (
      <section className="card verdict verdict-empty">
        <p className="verdict-kicker">אין עדיין המלצה</p>
        <h2>לא נמצא מסלול שמתאים לנתונים שהזנתם</h2>
        <p>
          כל המסלולים חורגים מהיכולת הכלכלית או שחסר מידע כדי להעריך אותם. בדקו את השאלות למטה ואת ״מה לבקש
          מהיזם״ — שם מחושב מה צריך להשתנות כדי שמסלול יתאים.
        </p>
      </section>
    );
  }

  const conditions = rec.requiredConditions.map((c) => CONDITION_TEXT[c]);
  const why = explainWhy(rec, goal, result.ranked);
  const kept = R - rec.rightsSold;

  return (
    <section className="card verdict" aria-live="polite">
      <p className="verdict-kicker">
        המסלול המומלץ לבדיקה · {formatRights(result.rights.landAreaSqm)} מ״ר · {formatRights(R)} זכויות
      </p>
      <h2>{strategyTitle(rec)}</h2>
      <StatusBadge r={rec} />
      <p className="verdict-desc">{STRATEGY_DESCRIPTIONS[rec.strategyType]}</p>

      <div className="verdict-numbers">
        <div className="big-num">
          <strong>{formatRights(Math.max(0, kept))}</strong>
          <span>זכויות לשמירה</span>
        </div>
        <div className="big-num">
          <strong>{formatRights(rec.rightsSold)}</strong>
          <span>זכויות שעוברות ליזם / נמכרות</span>
        </div>
        <div className="big-num">
          <strong>{rec.metrics.wholeApartments}</strong>
          <span>דירות שלמות בסוף</span>
        </div>
      </div>

      <div className="stats-grid">
        <Stat label="שווי דירה צפוי (היום)" value={formatCurrency(apartmentValueToday(PROJECT_CONFIG))} />
        <Stat label="עלות שירותי בנייה בסיסית לדירה" value={formatCurrency(constructionQuotePerApartment(PROJECT_CONFIG, developerMarkup))} />
        <Stat label="מימון נדרש (משכנתא)" value={rec.mortgageRequired > 1 ? formatCurrency(rec.mortgageRequired) : 'לא נדרש'} />
        <Stat label="החזר חודשי מקסימלי" value={rec.monthlyRepayment > 1 ? formatCurrency(rec.monthlyRepayment) : '—'} />
        <Stat label={`זכויות בקומבינציה של ${formatRights(combinationPct * 100)}%`} value={formatRights(R * combinationPct)} />
        <Stat label="שווי נטו שנוצר בעוד 10 שנים" value={formatCurrency(rec.metrics.valueCreated)} />
      </div>

      <div className="verdict-cols">
        <div>
          <h3>למה כדאי לבדוק את המסלול?</h3>
          <ul>
            {why.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>מה צריך לברר?</h3>
          {conditions.length ? (
            <ul>
              {conditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <p>אין תלות בתנאים חיצוניים לפי האומדן — עדיין מומלץ לאמת מול אנשי מקצוע.</p>
          )}
        </div>
      </div>
      <p className="verdict-note">
        זהו כיוון לבדיקה, לא אישור שהעסקה אפשרית עבור משק הבית שלכם. אינו שומה, ייעוץ משפטי, מס או אישור בנק.
      </p>
    </section>
  );
}

export function Alternatives({ result }: { result: DecisionResult }) {
  if (!result.alternatives.length) return null;
  return (
    <section className="alternatives">
      <h2 className="section-title">חלופות שכדאי להכיר</h2>
      <div className="alt-grid">
        {result.alternatives.map((r) => (
          <article key={r.id} className="card alt-card">
            <h3>{strategyTitle(r)}</h3>
            <StatusBadge r={r} />
            <p>{STRATEGY_DESCRIPTIONS[r.strategyType]}</p>
            <dl className="alt-dl">
              <div>
                <dt>דירות שלמות</dt>
                <dd>{r.metrics.wholeApartments}</dd>
              </div>
              <div>
                <dt>משכנתא</dt>
                <dd>{r.mortgageRequired > 1 ? formatCurrency(r.mortgageRequired) : 'ללא'}</dd>
              </div>
              <div>
                <dt>שווי נטו שנוצר</dt>
                <dd>{formatCurrency(r.metrics.valueCreated)}</dd>
              </div>
            </dl>
            {r.reasonCodes.includes('FRACTIONAL_UNIT') && <p className="muted">{REASON_TEXT.FRACTIONAL_UNIT}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
