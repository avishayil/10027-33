import { useEffect, useMemo, useState } from 'react';
import { PROJECT_CONFIG } from './data/config';
import { withArrangement } from './domain/arrangements';
import { Assumptions } from './components/assumptions/Assumptions';
import {
  AllocationTable,
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
import { JointSearch } from './components/comparisons/JointSearch';
import { ConcessionsCard, concessionRoute } from './components/comparisons/Concessions';
import { ContingentCard, GroupPlanner } from './components/comparisons/PhaseF';
import { AnswersBar, TermsCard } from './components/inputs/AnswersBar';
import { Wizard, type WizardStep } from './components/inputs/Wizard';
import { PrintHeader } from './components/print/PrintHeader';
import { PrintReport } from './components/print/PrintReport';
import { OfferCheck } from './components/offer/OfferCheck';
import { TermsToRequestCard } from './components/comparisons/TermsToRequest';
import { EMPTY_OFFER, type ActualOffer } from './optimizer/offer';
import { FollowUps } from './components/verdict/FollowUps';
import { TopPriorities } from './components/verdict/TopPriorities';
import { Alternatives, Verdict } from './components/verdict/Verdict';
import { DISCLAIMER_SHORT } from './content/sourcesAndDisclaimer';
import { MAVAT_URL } from './data/parcel33';
import { useDecisionEngine } from './hooks/useDecisionEngine';
import { clearInputs, loadInputs, saveInputs } from './hooks/storage';


const ADVANCED_KEY = 'mimush-chacham:advanced-view';
const readAdvanced = () => {
  try {
    return window.localStorage.getItem(ADVANCED_KEY) === '1';
  } catch {
    return false;
  }
};

export default function App() {
  const [saved] = useState(() => loadInputs());
  const engine = useDecisionEngine(saved);
  const { result, profile, terms, values } = engine;
  const [view, setView] = useState<'wizard' | 'main'>(saved ? 'main' : 'wizard');
  const [wizardStart, setWizardStart] = useState<WizardStep>('welcome');
  const [onboarded, setOnboarded] = useState(saved !== null);
  const [remember, setRemember] = useState(saved !== null);
  // Simple view by default: only the three priorities. Advanced view shows every detail (a display preference, not
  // personal data, so it is remembered in this browser).
  const [advanced, setAdvancedState] = useState(readAdvanced);
  // An actual developer offer: this visit only — never saved, never sent (V1 / MH-10).
  const [offer, setOffer] = useState<ActualOffer>(EMPTY_OFFER);
  const setAdvanced = (on: boolean) => {
    setAdvancedState(on);
    try {
      window.localStorage.setItem(ADVANCED_KEY, on ? '1' : '0');
    } catch {
      /* storage unavailable — the choice lasts for this visit only */
    }
  };
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
    setOffer(EMPTY_OFFER);
    setRemember(false);
  };

  const focus = result?.recommendation ?? result?.ranked[0] ?? null;
  // The configuration the analysis ran with (tax arrangement and offer terms), for the advanced cards.
  const analysisConfig = useMemo(() => {
    const base = withArrangement(PROJECT_CONFIG, engine.inputs.taxArrangement);
    const levyCap = engine.inputs.levyCapText === '' ? null : Number(engine.inputs.levyCapText) || null;
    return { ...base, commercial: { ...base.commercial, offer: { levyCap, developerPaysTaxLoanInterest: engine.inputs.developerPaysInterest } } };
  }, [engine.inputs.taxArrangement, engine.inputs.levyCapText, engine.inputs.developerPaysInterest]);
  const inWizard = view === 'wizard';

  return (
    <div className={`app ${inWizard ? 'app-wizard' : ''}`}>
      <a className="skip-link" href="#content">
        דילוג לתוכן
      </a>
      <header className="app-header">
        <h1>מתחם 13 – סימולציית עסקאות</h1>
        <p className="subtitle">גלו מהי הדרך הנכונה לממש את זכויות הקרקע שלכם</p>
        <p className="subtitle subtitle-small">חדרה · גוש 10027 חלקה 33</p>
      </header>

      <div id="content">
        {view === 'wizard' ? (
          <Wizard
            key={wizardStart + String(onboarded)}
            engine={engine}
            startAt={wizardStart}
            editing={onboarded}
            initialRemember={onboarded ? remember : false}
            onFinish={finish}
          />
        ) : (
          <main className={`main-view ${engine.updating ? 'results-updating' : ''}`} aria-busy={engine.updating || undefined}>
            {engine.analysis && <PrintHeader analysis={engine.analysis} updating={engine.updating} build={__BUILD_VERSION__} />}
            {engine.analysis && <PrintReport analysis={engine.analysis} offer={offer} />}
            {result && profile && <TopPriorities result={result} goal={profile.goal} combinationPct={terms.combinationPct} availableCapital={profile.availableCapital} basisKnown={typeof profile.acquisitionBasis === 'number'} />}
            <AnswersBar
              engine={engine}
              saved={remember}
              onEdit={edit}
              onForget={forget}
            />
            <label className="advanced-toggle no-print">
              <input type="checkbox" role="switch" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
              <span>
                <strong>תצוגה מתקדמת</strong>
                <span className="field-hint">כל הפירוט: מסים, מימון, תרחישים, תנאים מול היזם והנחות</span>
              </span>
            </label>
            {result && advanced ? (
              <>
                <h2 className="section-title section-divider">פירוט מלא</h2>
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
                {focus && <CostLedger result={result} initial={focus} />}
                <AllocationTable result={result} />
                {focus && <Financing result={result} r={focus} />}
                <ScenarioComparison result={result} />
                {engine.analysis && (
                  <TermsToRequestCard result={engine.analysis.result} profile={engine.analysis.profile} terms={engine.analysis.terms} config={engine.analysis.config} />
                )}
                <NegotiationPanel result={result} />
                <DeveloperPanel result={result} combinationPct={terms.combinationPct} />
                {engine.analysis && (
                  <OfferCheck offer={offer} onChange={setOffer} profile={engine.analysis.profile} terms={engine.analysis.terms} config={engine.analysis.config} />
                )}
                {engine.analysis && (
                  <ContingentCard
                    result={engine.analysis.result}
                    profile={engine.analysis.profile}
                    terms={engine.analysis.terms}
                    config={engine.analysis.config}
                    optionTermsKnown={offer.option.fee !== null}
                  />
                )}
                {engine.analysis && concessionRoute(engine.analysis.result) && (
                  <ConcessionsCard
                    route={concessionRoute(engine.analysis.result)!}
                    profile={engine.analysis.profile}
                    terms={engine.analysis.terms}
                    config={engine.analysis.config}
                  />
                )}
                <GroupPlanner terms={terms} config={analysisConfig} lotId={profile?.lotId || PROJECT_CONFIG.rights.defaultLotId} />
                {profile && (
                  <JointSearch
                    profile={profile}
                    terms={terms}
                    offer={{ levyCap: engine.inputs.levyCapText === '' ? null : Number(engine.inputs.levyCapText) || null, developerPaysTaxLoanInterest: engine.inputs.developerPaysInterest }}
                  />
                )}
                <LandReferences result={result} />
                <ProjectionSection result={result} />
                <Assumptions />
                <div className="no-print print-actions">
                  <button type="button" className="btn-primary" onClick={() => window.print()} disabled={engine.updating} title={engine.updating ? 'מחשב את הנתונים החדשים…' : undefined}>
                    הדפסת סיכום לפגישה
                  </button>
                  <span className="field-hint">החישוב נעשה כולו בדפדפן שלכם. שום נתון לא נשלח לשרת.</span>
                </div>
              </>
            ) : result ? (
              <div className="no-print print-actions">
                <button type="button" className="btn-primary" onClick={() => window.print()} disabled={engine.updating} title={engine.updating ? 'מחשב את הנתונים החדשים…' : undefined}>
                  הדפסת סיכום לפגישה
                </button>
              </div>
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
      <p className="build-version" dir="ltr">
        {`build ${__BUILD_VERSION__}`}
      </p>
    </div>
  );
}
