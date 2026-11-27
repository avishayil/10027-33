import { lazy, Suspense, useEffect, useState } from 'react';
import { Assumptions } from './components/assumptions/Assumptions';
import {
  CostLedger,
  DeveloperPanel,
  Financing,
  LandReferences,
  NegotiationPanel,
  PriceConditionalRoutes,
  ProjectionSection,
  ScenarioComparison,
  StrategyComparison,
  WhyFits,
} from './components/comparisons/DetailSections';
import { AnswersBar, TermsCard } from './components/inputs/AnswersBar';
import { Wizard, type WizardStep } from './components/inputs/Wizard';
import { PrintHeader } from './components/print/PrintHeader';
import { SegmentedToggle } from './components/SegmentedToggle';
import { FollowUps } from './components/verdict/FollowUps';
import { Alternatives, Verdict } from './components/verdict/Verdict';
import { DISCLAIMER_SHORT } from './content/sourcesAndDisclaimer';
import { MAVAT_URL } from './data/parcel33';
import { useDecisionEngine } from './hooks/useDecisionEngine';
import { clearInputs, loadInputs, saveInputs } from './hooks/storage';

const LegacySimulator = lazy(() => import('./components/legacy/LegacySimulator'));

type Tab = 'smart' | 'advanced';

export default function App() {
  const [saved] = useState(() => loadInputs());
  const engine = useDecisionEngine(saved);
  const { result, profile, terms, values } = engine;
  const [tab, setTab] = useState<Tab>('smart');
  const [view, setView] = useState<'wizard' | 'main'>(saved ? 'main' : 'wizard');
  const [wizardStart, setWizardStart] = useState<WizardStep>('welcome');
  const [onboarded, setOnboarded] = useState(saved !== null);
  const [remember, setRemember] = useState(saved !== null);
  const base = import.meta.env.BASE_URL;

  // Keep saved answers in sync (only with consent, only once onboarding is complete).
  const valuesKey = JSON.stringify(values);
  useEffect(() => {
    if (remember && onboarded) saveInputs(values);
    // valuesKey captures every saved field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey, remember, onboarded]);

  // Printing should include every collapsible section.
  useEffect(() => {
    const open = () => document.querySelectorAll('details').forEach((d) => (d.open = true));
    window.addEventListener('beforeprint', open);
    return () => window.removeEventListener('beforeprint', open);
  }, []);

  const edit = (step: WizardStep) => {
    setWizardStart(step);
    setView('wizard');
  };
  const finish = (keep: boolean) => {
    setRemember(keep);
    setOnboarded(true);
    if (!keep) clearInputs();
    setView('main');
    window.scrollTo({ top: 0 });
  };
  const forget = () => {
    clearInputs();
    setRemember(false);
  };

  const focus = result?.recommendation ?? result?.ranked[0] ?? null;
  const inWizard = tab === 'smart' && view === 'wizard';

  return (
    <div className={`app ${inWizard ? 'app-wizard' : ''}`}>
      <a className="skip-link" href="#content">
        דילוג לתוכן
      </a>
      <header className="app-header">
        <h1>מימוש חכם</h1>
        <p className="subtitle">גלו מהי הדרך הנכונה לממש את זכויות הקרקע שלכם</p>
        <p className="subtitle subtitle-small">מתחם 13 · חדרה · גוש 10027 חלקה 33</p>
      </header>

      {!inWizard && (
        <nav className="tabs no-print" aria-label="מצב תצוגה">
          <SegmentedToggle
            options={[
              { value: 'smart', label: 'מימוש חכם' },
              { value: 'advanced', label: 'מחשבון מתקדם' },
            ]}
            value={tab}
            onChange={setTab}
            label="מצב תצוגה"
          />
        </nav>
      )}

      <div id="content">
        {tab === 'advanced' ? (
          <Suspense fallback={<p className="card">טוען…</p>}>
            <LegacySimulator />
          </Suspense>
        ) : view === 'wizard' ? (
          <Wizard
            key={wizardStart + String(onboarded)}
            engine={engine}
            startAt={wizardStart}
            editing={onboarded}
            initialRemember={onboarded ? remember : false}
            onFinish={finish}
          />
        ) : (
          <main className="main-view">
            {profile && <PrintHeader profile={profile} terms={terms} />}
            <AnswersBar engine={engine} saved={remember} onEdit={edit} onForget={forget} />
            {result ? (
              <>
                <Verdict
                  result={result}
                  goal={profile!.goal}
                  combinationPct={terms.combinationPct}
                  developerMarkup={terms.developerMarkup}
                />
                <FollowUps questions={result.followUpQuestions} onAnswer={edit} />
                <TermsCard engine={engine} />
                <Alternatives result={result} />
                <PriceConditionalRoutes result={result} />
                <h2 className="section-title section-divider">פירוט ובדיקה</h2>
                <WhyFits result={result} goal={profile!.goal} />
                <StrategyComparison result={result} />
                {focus && <CostLedger r={focus} />}
                {focus && <Financing result={result} r={focus} />}
                <ScenarioComparison result={result} />
                <NegotiationPanel result={result} />
                <DeveloperPanel result={result} combinationPct={terms.combinationPct} />
                <LandReferences result={result} />
                <ProjectionSection result={result} />
                <Assumptions />
                <div className="no-print print-actions">
                  <button type="button" className="btn-primary" onClick={() => window.print()}>
                    הדפסת סיכום לפגישה
                  </button>
                  <span className="field-hint">החישוב נעשה כולו בדפדפן שלכם. שום נתון לא נשלח לשרת.</span>
                </div>
              </>
            ) : (
              <section className="card">
                <p>חסר שטח קרקע תקין.</p>
                <button type="button" className="btn-primary" onClick={() => edit('land')}>
                  הזנת שטח הקרקע
                </button>
              </section>
            )}
          </main>
        )}
      </div>

      {inWizard ? (
        <footer className="disclaimer disclaimer-short">
          <p>{DISCLAIMER_SHORT}</p>
        </footer>
      ) : (
        <footer className="disclaimer">
          <p>{DISCLAIMER_SHORT}</p>
          <p>
            הזכויות בתכנית עדיין מוצעות (עדכון לפי סעיף 106(ב)) ואינן מאושרות סופית. מחיר הקרקע של ₪6,900 למ״ר הוא תרחיש
            לא מאומת, לא הצעה קיימת.
          </p>
          <ul className="sources">
            <li>
              <a href={MAVAT_URL} target="_blank" rel="noreferrer">
                אתר התכנית במבא״ת
              </a>
            </li>
            <li>
              תשריט מצב מוצע (106(ב)):{' '}
              <a href={`${base}maps/proposed-1.pdf`} target="_blank" rel="noreferrer">
                גיליון 1
              </a>{' '}
              |{' '}
              <a href={`${base}maps/proposed-2.pdf`} target="_blank" rel="noreferrer">
                גיליון 2
              </a>
            </li>
          </ul>
          <p>
            הטבלאות המלאות כוללות שמות ומספרי זהות ולכן אינן מפורסמות כאן — רק נתוני המגרשים והשברים של חלקה 33.
          </p>
        </footer>
      )}
    </div>
  );
}
