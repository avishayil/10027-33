import { lazy, Suspense, useEffect, useState } from 'react';
import { Assumptions } from './components/assumptions/Assumptions';
import {
  CostLedger,
  DeveloperPanel,
  Financing,
  NegotiationPanel,
  ScenarioComparison,
  StrategyComparison,
  WhyFits,
} from './components/comparisons/DetailSections';
import { ProfileForm } from './components/inputs/ProfileForm';
import { PrintHeader } from './components/print/PrintHeader';
import { SegmentedToggle } from './components/SegmentedToggle';
import { FollowUps } from './components/verdict/FollowUps';
import { Alternatives, Verdict } from './components/verdict/Verdict';
import { DISCLAIMER_SHORT } from './content/sourcesAndDisclaimer';
import { MAVAT_URL } from './data/parcel33';
import { useDecisionEngine } from './hooks/useDecisionEngine';

const LegacySimulator = lazy(() => import('./components/legacy/LegacySimulator'));

type Tab = 'smart' | 'advanced';

export default function App() {
  const [tab, setTab] = useState<Tab>('smart');
  const engine = useDecisionEngine();
  const { result, profile, terms } = engine;
  const base = import.meta.env.BASE_URL;

  // Printing should include every collapsible section.
  useEffect(() => {
    const open = () => document.querySelectorAll('details').forEach((d) => (d.open = true));
    window.addEventListener('beforeprint', open);
    return () => window.removeEventListener('beforeprint', open);
  }, []);

  const focus = result?.recommendation ?? result?.ranked[0] ?? null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>מימוש חכם</h1>
        <p className="subtitle">גלו מהי הדרך הנכונה לממש את זכויות הקרקע שלכם</p>
        <p className="subtitle subtitle-small">מתחם 13 · חדרה · תכנית 302-1306018 · גוש 10027 חלקה 33</p>
      </header>

      <nav className="tabs no-print">
        <SegmentedToggle
          large
          options={[
            { value: 'smart', label: 'מימוש חכם' },
            { value: 'advanced', label: 'השוואה מתקדמת' },
          ]}
          value={tab}
          onChange={setTab}
          label="מצב תצוגה"
        />
      </nav>

      {tab === 'smart' ? (
        <main className="smart-layout">
          <ProfileForm engine={engine} />
          <div className="results">
            {profile && <PrintHeader profile={profile} terms={terms} />}
            {result ? (
              <>
                <Verdict
                  result={result}
                  goal={profile!.goal}
                  combinationPct={terms.combinationPct}
                  developerMarkup={terms.developerMarkup}
                />
                <FollowUps questions={result.followUpQuestions} />
                <Alternatives result={result} />
                <WhyFits result={result} goal={profile!.goal} />
                <StrategyComparison result={result} />
                {focus && <CostLedger r={focus} />}
                {focus && <Financing result={result} r={focus} />}
                <ScenarioComparison result={result} />
                <NegotiationPanel result={result} />
                <DeveloperPanel result={result} combinationPct={terms.combinationPct} />
                <Assumptions />
                <div className="no-print print-actions">
                  <button type="button" className="btn-primary" onClick={() => window.print()}>
                    הדפסת סיכום לפגישה
                  </button>
                  <span className="field-hint">
                    החישוב נעשה כולו בדפדפן שלכם. שום נתון לא נשלח לשרת ולא נשמר.
                  </span>
                </div>
              </>
            ) : (
              <section className="card">
                <p>הזינו את שטח הקרקע כדי לראות את המסלולים.</p>
              </section>
            )}
          </div>
        </main>
      ) : (
        <Suspense fallback={<p className="card">טוען…</p>}>
          <LegacySimulator />
        </Suspense>
      )}

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
    </div>
  );
}
