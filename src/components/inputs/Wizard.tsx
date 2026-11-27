/**
 * First-run onboarding: one question per step, so every user sees the important assumptions
 * before the first recommendation. Re-opened from the main screen to edit an answer.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { PROJECT_CONFIG } from '../../data/config';
import type { DecisionEngine } from '../../hooks/useDecisionEngine';
import { formatCurrency } from '../../utils/format';
import { BasisField, CapitalField, describeAnswers, GoalFields, LandFields, RepaymentFields, TermsFields } from './fields';

export const WIZARD_STEPS = ['welcome', 'land', 'capital', 'repayment', 'goal', 'terms', 'summary'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

interface Props {
  engine: DecisionEngine;
  startAt?: WizardStep;
  /** True when re-opened from the main screen (answers already given). */
  editing: boolean;
  initialRemember: boolean;
  onFinish: (remember: boolean) => void;
}

function KeyAssumptions() {
  const m = PROJECT_CONFIG.market;
  const items: { text: ReactNode; tag: string; tagClass: string }[] = [
    { text: <>כל 167 מ״ר בחלקה ≈ <strong>2.25 זכויות לדירה</strong></>, tag: 'הנחה', tagClass: 'verif-assumed' },
    { text: <>שווי דירה חדשה בחדרה: <strong>{formatCurrency(m.apartmentValuePerSqm)} למ״ר</strong> (דירה של 100 מ״ר)</>, tag: 'מדווח', tagClass: 'verif-reported' },
    { text: <>עלות בנייה: <strong>{formatCurrency(PROJECT_CONFIG.construction.costPerSqm)} למ״ר</strong> לפני מע״מ ורווח יזמי</>, tag: 'הנחה', tagClass: 'verif-assumed' },
    { text: <>מחיר שיזם ישלם על זכויות: <strong>{formatCurrency(m.developerRightsSaleScenario.pricePerOriginalSqm)} למ״ר</strong> — תרחיש, לא הצעה קיימת</>, tag: 'לא מאומת', tagClass: 'verif-assumed' },
    { text: <>היטל השבחה: <strong>50%</strong> מעליית השווי בטבלת האיזון; מס שבח: רזרבה של <strong>25% מהרווח</strong></>, tag: 'חוק / אומדן', tagClass: 'verif-verified' },
    { text: <>בקומבינציה מניחים עסקת <strong>״נטו״</strong> — היזם משלם את מס השבח וההיטל שלכם, כמקובל בעסקאות רבות. חובה לוודא בחוזה</>, tag: 'מקובל', tagClass: 'verif-reported' },
    { text: <>ריבית משכנתא: <strong>5%</strong>, ובתרחיש השמרני 7%</>, tag: 'מדווח', tagClass: 'verif-reported' },
    { text: <>יזם צפוי להקצות לשירותי בנייה רק <strong>20%–30% מהדירות במגרש</strong> (כ-100 יח״ד), <strong>דירה אחת לכל היותר</strong> לבעלים — ומי שהקומבינציה כבר נותנת לו דירה שלמה (כ-3 זכויות ומעלה) צפוי לקבל קומבינציה מלאה</>, tag: 'הנחה', tagClass: 'verif-assumed' },
    { text: <>התכנית (עדכון 106(ב)) <strong>טרם אושרה סופית</strong> — הזכויות עדיין מוצעות</>, tag: 'סטטוס', tagClass: 'verif-reported' },
  ];
  return (
    <ul className="key-assumptions">
      {items.map((it, idx) => (
        <li key={idx}>
          <span>{it.text}</span>
          <span className={`verif ${it.tagClass}`}>{it.tag}</span>
        </li>
      ))}
    </ul>
  );
}

export function Wizard({ engine, startAt = 'welcome', editing, initialRemember, onFinish }: Props) {
  const [step, setStep] = useState<WizardStep>(startAt);
  const [acknowledged, setAcknowledged] = useState(editing);
  const [remember, setRemember] = useState(initialRemember);
  const [showErrors, setShowErrors] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const index = WIZARD_STEPS.indexOf(step);
  const { errors, inputs: i, landArea } = engine;

  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  const valid: Record<WizardStep, boolean> = {
    welcome: true,
    land: landArea !== null && !errors.area,
    capital: i.capitalText !== '' && !errors.capital,
    repayment: i.repaymentMode !== 'amount' || (i.repaymentText !== '' && !errors.repayment),
    goal: true,
    terms: acknowledged,
    summary: true,
  };
  const blockingMessage: Partial<Record<WizardStep, string>> = {
    land: 'הזינו שטח או שבר תקין כדי להמשיך.',
    capital: 'הזינו סכום — גם 0 היא תשובה. בלי זה אי אפשר לדעת מה אפשרי עבורכם.',
    repayment: 'הזינו סכום, או בחרו ״לא אקח משכנתא״ / ״עוד לא יודע/ת״.',
    terms: 'סמנו שקראתם את ההנחות כדי להמשיך.',
  };
  const firstInvalid = WIZARD_STEPS.find((s) => !valid[s]);

  const go = (to: WizardStep) => {
    setShowErrors(false);
    setStep(to);
  };
  const next = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid[step]) {
      setShowErrors(true);
      return;
    }
    if (step === 'summary') {
      if (firstInvalid) return go(firstInvalid);
      onFinish(remember);
      return;
    }
    go(WIZARD_STEPS[index + 1]);
  };
  const back = () => index > 0 && go(WIZARD_STEPS[index - 1]);

  const answers = describeAnswers(engine);
  const titles: Record<WizardStep, string> = {
    welcome: 'ברוכים הבאים',
    land: 'כמה קרקע יש לכם?',
    capital: 'כמה כסף פנוי יש לכם?',
    repayment: 'כמה תוכלו להחזיר בחודש?',
    goal: 'מה הכי חשוב לכם?',
    terms: 'חשוב לדעת לפני התוצאות',
    summary: 'בדקו את התשובות',
  };
  const whys: Partial<Record<WizardStep, string>> = {
    land: 'מזה נגזר כמה זכויות לדירה יש לכם — הבסיס לכל החישוב.',
    capital: 'כדי לפסול מסלולים שדורשים כסף שאין לכם. אנחנו לא מניחים שיש לכם כסף.',
    repayment: 'כדי לדעת אם משכנתא היא אפשרות עבורכם, ובאיזה גודל.',
    goal: 'אותם מספרים — המלצה אחרת לפי מה שחשוב לכם.',
    terms: 'אלה ההנחות שהכי משפיעות על התוצאה. אפשר לשנות את תנאי היזם גם אחר כך.',
  };

  const rows: { step: WizardStep; label: string; value: string }[] = [
    { step: 'land', label: 'הזכויות שלי', value: answers.land },
    { step: 'capital', label: 'כסף פנוי', value: answers.capital },
    { step: 'repayment', label: 'החזר חודשי', value: answers.repayment },
    { step: 'goal', label: 'מה חשוב לי', value: answers.goal },
    { step: 'terms', label: 'תנאים מול היזם', value: answers.terms },
  ];

  return (
    <main className="wizard">
      <div className="wizard-progress" aria-hidden={step === 'welcome'}>
        {step !== 'welcome' && (
          <>
            <span className="wizard-count">
              שלב {index} מתוך {WIZARD_STEPS.length - 1}
            </span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${(index / (WIZARD_STEPS.length - 1)) * 100}%` }} />
            </div>
          </>
        )}
      </div>

      <form className="card wizard-card" onSubmit={next} noValidate>
        <h2 ref={headingRef} tabIndex={-1} className="wizard-title">
          {titles[step]}
        </h2>
        {whys[step] && <p className="wizard-why">{whys[step]}</p>}

        {step === 'welcome' && (
          <div className="welcome">
            <p>
              בעזרת 4 שאלות קצרות נבדוק את כל הדרכים לממש את הזכויות שלכם במתחם 13 — מכירה, קומבינציה, שירותי בנייה
              ושילובים ביניהם — ונמליץ על המסלול שמתאים ליכולת הכלכלית שלכם.
            </p>
            <ul className="welcome-points">
              <li>⏱️ לוקח כדקה.</li>
              <li>🔒 הכול מחושב בדפדפן שלכם. שום נתון לא נשלח לשום מקום.</li>
              <li>📐 התוצאות הן אומדנים — לא שומה, ייעוץ משפטי, מס או אישור בנק.</li>
            </ul>
          </div>
        )}
        {step === 'land' && <LandFields engine={engine} />}
        {step === 'capital' && <CapitalField engine={engine} />}
        {step === 'repayment' && <RepaymentFields engine={engine} />}
        {step === 'goal' && <GoalFields engine={engine} name="wizard-goal" />}
        {step === 'terms' && (
          <>
            <KeyAssumptions />
            <h3 className="wizard-subtitle">התנאים שאתם מניחים מול היזם</h3>
            <TermsFields engine={engine} />
            <label className="ack">
              <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
              <span>הבנתי שאלה אומדנים והנחות, ושההחלטה דורשת בדיקה מול אנשי מקצוע.</span>
            </label>
          </>
        )}
        {step === 'summary' && (
          <>
            <dl className="summary-list">
              {rows.map((r) => (
                <div key={r.step} className={valid[r.step] ? '' : 'summary-invalid'}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                  <button type="button" className="link-btn" onClick={() => go(r.step)} aria-label={`שינוי: ${r.label}`}>
                    שינוי
                  </button>
                </div>
              ))}
            </dl>
            <BasisField engine={engine} />
            <label className="ack">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>
                לשמור את התשובות <strong>בדפדפן הזה בלבד</strong>, כדי שבפעם הבאה תגיעו ישר לתוצאות. הן לא נשלחות לשום מקום,
                ואפשר למחוק אותן בכל רגע.
              </span>
            </label>
          </>
        )}

        {showErrors && !valid[step] && (
          <p className="field-error" role="alert">
            {blockingMessage[step]}
          </p>
        )}

        <div className="wizard-actions">
          <button type="submit" className="btn-primary btn-large">
            {step === 'welcome' ? 'בואו נתחיל' : step === 'summary' ? 'הצגת המסלול המתאים לי' : 'המשך'}
          </button>
          {index > 0 && (
            <button type="button" className="btn-secondary" onClick={back}>
              חזרה
            </button>
          )}
          {editing && step !== 'summary' && (
            <button type="button" className="link-btn wizard-skip" onClick={() => go('summary')}>
              לסיכום התשובות
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
