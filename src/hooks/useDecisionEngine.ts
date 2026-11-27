/**
 * UI state for the deal simulation. Personal inputs live only in memory — nothing is persisted,
 * nothing is put in the URL and nothing is sent over the network.
 */
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { withArrangement } from '../domain/arrangements';
import { PROJECT_CONFIG } from '../data/config';
import type { CommercialTerms, DecisionResult, Goal, TaxArrangement, UserProfile } from '../domain/types';
import { analyzeProfile } from '../optimizer/analyze';
import { parseParcelFraction } from '../utils/simulationMath';
import { PARCEL } from '../data/parcel33';
import { maxAreaInLot } from '../domain/validation';
import type { SavedInputs } from './storage';

export type AreaMode = 'sqm' | 'fraction';
export type RepaymentMode = 'amount' | 'none' | 'unknown';

/** Parses a user-typed amount. '' → null (unknown); invalid → NaN. Accepts thousands separators. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[,\s₪]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

const clampTo = (x: number, r: { min: number; max: number; default: number }) =>
  Number.isFinite(x) ? Math.min(r.max, Math.max(r.min, x)) : r.default;

/** The value, once it has not changed for `ms` (the first value is used at once). */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(value, settled)) return;
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, settled, ms]);
  return settled;
}

export function useDecisionEngine(saved: SavedInputs | null = null) {
  const c = PROJECT_CONFIG.commercial;
  // The wizard asks for square metres only; an answer saved as a registry fraction is converted once.
  const [areaMode, setAreaMode] = useState<AreaMode>('sqm');
  const [areaText, setAreaText] = useState(() => {
    if (saved?.areaMode === 'fraction') {
      try {
        // Exact value, not rounded (iteration 9 / D4): up to 6 decimals of m².
        return String(Number(parseParcelFraction(saved.fractionText).toFixed(6)));
      } catch {
        return '167';
      }
    }
    return saved?.areaText ?? '167';
  });
  const [fractionText, setFractionText] = useState(saved?.fractionText ?? '167/21258');
  const [lotId, setLotId] = useState<string>(saved?.lotId ?? '');
  const [capitalText, setCapitalText] = useState(saved?.capitalText ?? '');
  const [repaymentMode, setRepaymentMode] = useState<RepaymentMode>(saved?.repaymentMode ?? 'amount');
  const [repaymentText, setRepaymentText] = useState(saved?.repaymentText ?? '');
  const [goal, setGoal] = useState<Goal>(saved?.goal ?? 'balanced');
  const [combinationPct, setCombinationPct] = useState(saved ? clampTo(saved.combinationPct, c.combination) : c.combination.default);
  const [developerMarkup, setDeveloperMarkup] = useState(saved ? clampTo(saved.developerMarkup, c.developerMarkup) : c.developerMarkup.default);
  const [basisText, setBasisText] = useState(saved?.basisText ?? '');
  const [deadlineYears, setDeadlineYears] = useState(saved?.deadlineYears ?? PROJECT_CONFIG.analysis.liquidityDeadlineYears);
  const [soleHome, setSoleHome] = useState<'unknown' | 'yes' | 'no' | 'replacement'>(saved?.soleHome ?? 'unknown');
  // What the offer at the combination % includes — the headline arrangement; the others are derived from it.
  const [taxArrangement, setTaxArrangement] = useState<TaxArrangement>(saved?.taxArrangement ?? c.taxArrangement);
  // Optional actual-offer terms and borrowing on another property.
  const [levyCapText, setLevyCapText] = useState(saved?.levyCapText ?? '');
  const [developerPaysInterest, setDeveloperPaysInterest] = useState(saved?.developerPaysInterest ?? false);
  const [otherPropertyLimitText, setOtherPropertyLimitText] = useState(saved?.otherPropertyLimitText ?? '');

  const area = useMemo((): { value: number | null; error: string | null } => {
    if (areaMode === 'fraction') {
      try {
        return { value: parseParcelFraction(fractionText), error: null };
      } catch (e) {
        return { value: null, error: (e as Error).message };
      }
    }
    const n = parseAmount(areaText);
    if (n === null) return { value: null, error: 'הזינו את שטח הקרקע במ״ר.' };
    if (Number.isNaN(n) || n <= 0) return { value: null, error: 'השטח חייב להיות מספר חיובי.' };
    return { value: n, error: null };
  }, [areaMode, areaText, fractionText]);

  const capital = parseAmount(capitalText);
  const repaymentAmount = parseAmount(repaymentText);
  const basis = parseAmount(basisText);
  const levyCap = parseAmount(levyCapText);
  const otherPropertyLimit = parseAmount(otherPropertyLimitText);

  // Iteration 9 / D4: the holding must fit inside the parcel and inside one lot (multi-lot holdings are not supported).
  const areaBound =
    area.value === null
      ? null
      : area.value > PARCEL.area
        ? `השטח גדול מכל החלקה (${PARCEL.area.toLocaleString('he-IL')} מ״ר).`
        : area.value > maxAreaInLot(PROJECT_CONFIG, lotId || PROJECT_CONFIG.rights.defaultLotId) + 1e-6
          ? 'השטח גדול מכל המגרש שהוקצה. אחזקות בכמה מגרשים עוד לא נתמכות — הזינו את החלק שבמגרש אחד.'
          : null;

  const errors = {
    area: area.error ?? areaBound,
    capital: Number.isNaN(capital) ? 'סכום לא תקין.' : null,
    repayment: repaymentMode === 'amount' && Number.isNaN(repaymentAmount) ? 'סכום לא תקין.' : null,
    basis: Number.isNaN(basis) ? 'סכום לא תקין.' : null,
    levyCap: Number.isNaN(levyCap) ? 'סכום לא תקין.' : null,
    otherPropertyLimit: Number.isNaN(otherPropertyLimit) ? 'סכום לא תקין.' : null,
  };

  const maxMonthlyRepayment =
    repaymentMode === 'none' ? 0 : repaymentMode === 'unknown' ? null : Number.isNaN(repaymentAmount) ? null : repaymentAmount;

  const profile: UserProfile | null =
    area.value === null || areaBound
      ? null
      : {
          landAreaSqm: area.value,
          availableCapital: Number.isNaN(capital) ? null : capital,
          maxMonthlyRepayment,
          goal,
          lotId: lotId || undefined,
          acquisitionBasis: basis === null || Number.isNaN(basis) ? null : basis,
          liquidityDeadlineYears: deadlineYears,
          // A replacement home (the current one will be sold) counts as the sole home, with a 70% mortgage limit.
          soleHome: soleHome === 'unknown' ? null : soleHome === 'yes' || soleHome === 'replacement',
          replacementHome: soleHome === 'replacement',
          otherPropertyBorrowingLimit: otherPropertyLimit === null || Number.isNaN(otherPropertyLimit) ? null : otherPropertyLimit,
        };

  const terms: CommercialTerms = { combinationPct, developerMarkup };

  // Iteration 9 / D5: the analysis runs on a deferred render, so typing and dragging stay responsive on slower phones
  // (measured ≈ 300 ms per update at a 4× CPU slowdown); the previous result stays on screen until the new one is ready.
  const analysisKey = JSON.stringify({
    profile,
    terms,
    taxArrangement,
    levyCap: levyCap === null || Number.isNaN(levyCap) ? null : levyCap,
    developerPaysInterest,
  });
  // A burst of changes (dragging a slider, typing digits) runs one analysis 250 ms after it settles, on a deferred render.
  const settledKey = useDebounced(analysisKey, 250);
  const deferredKey = useDeferredValue(settledKey);
  const result: DecisionResult | null = useMemo(() => {
    const a = JSON.parse(deferredKey) as {
      profile: UserProfile | null;
      terms: CommercialTerms;
      taxArrangement: TaxArrangement;
      levyCap: number | null;
      developerPaysInterest: boolean;
    };
    if (!a.profile) return null;
    const base = withArrangement(PROJECT_CONFIG, a.taxArrangement);
    const offer = { levyCap: a.levyCap, developerPaysTaxLoanInterest: a.developerPaysInterest };
    return analyzeProfile(a.profile, a.terms, { ...base, commercial: { ...base.commercial, offer } });
  }, [deferredKey]);
  const updating = deferredKey !== analysisKey;

  const values: SavedInputs = {
    version: 1,
    areaMode, areaText, fractionText, lotId, capitalText, repaymentMode, repaymentText,
    goal, combinationPct, developerMarkup, basisText, deadlineYears, soleHome, taxArrangement,
    levyCapText, developerPaysInterest, otherPropertyLimitText,
  };

  return {
    values,
    inputs: {
      areaMode, setAreaMode, areaText, setAreaText, fractionText, setFractionText,
      lotId, setLotId, capitalText, setCapitalText, repaymentMode, setRepaymentMode,
      repaymentText, setRepaymentText, goal, setGoal, combinationPct, setCombinationPct,
      developerMarkup, setDeveloperMarkup, basisText, setBasisText, deadlineYears, setDeadlineYears,
      soleHome, setSoleHome, taxArrangement, setTaxArrangement,
      levyCapText, setLevyCapText, developerPaysInterest, setDeveloperPaysInterest,
      otherPropertyLimitText, setOtherPropertyLimitText,
    },
    landArea: area.value,
    errors,
    profile,
    terms,
    result,
    /** True while a newer analysis is being computed (the shown result is the previous one). */
    updating,
  };
}

export type DecisionEngine = ReturnType<typeof useDecisionEngine>;
