/**
 * UI state for מימוש חכם. Personal inputs live only in memory — nothing is persisted,
 * nothing is put in the URL and nothing is sent over the network.
 */
import { useMemo, useState } from 'react';
import { PROJECT_CONFIG } from '../data/config';
import type { CommercialTerms, DecisionResult, Goal, UserProfile } from '../domain/types';
import { analyzeProfile } from '../optimizer/analyze';
import { parseParcelFraction } from '../utils/simulationMath';

export type AreaMode = 'sqm' | 'fraction';
export type RepaymentMode = 'amount' | 'none' | 'unknown';

/** Parses a user-typed amount. '' → null (unknown); invalid → NaN. Accepts thousands separators. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[,\s₪]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export function useDecisionEngine() {
  const [areaMode, setAreaMode] = useState<AreaMode>('sqm');
  const [areaText, setAreaText] = useState('167');
  const [fractionText, setFractionText] = useState('167/21258');
  const [lotId, setLotId] = useState<string>('');
  const [capitalText, setCapitalText] = useState('');
  const [repaymentMode, setRepaymentMode] = useState<RepaymentMode>('amount');
  const [repaymentText, setRepaymentText] = useState('');
  const [goal, setGoal] = useState<Goal>('balanced');
  const [combinationPct, setCombinationPct] = useState(PROJECT_CONFIG.commercial.combination.default);
  const [developerMarkup, setDeveloperMarkup] = useState(PROJECT_CONFIG.commercial.developerMarkup.default);
  const [basisText, setBasisText] = useState('');
  const [deadlineYears, setDeadlineYears] = useState(PROJECT_CONFIG.analysis.liquidityDeadlineYears);

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

  const errors = {
    area: area.error,
    capital: Number.isNaN(capital) ? 'סכום לא תקין.' : null,
    repayment: repaymentMode === 'amount' && Number.isNaN(repaymentAmount) ? 'סכום לא תקין.' : null,
    basis: Number.isNaN(basis) ? 'סכום לא תקין.' : null,
  };

  const maxMonthlyRepayment =
    repaymentMode === 'none' ? 0 : repaymentMode === 'unknown' ? null : Number.isNaN(repaymentAmount) ? null : repaymentAmount;

  const profile: UserProfile | null =
    area.value === null
      ? null
      : {
          landAreaSqm: area.value,
          availableCapital: Number.isNaN(capital) ? null : capital,
          maxMonthlyRepayment,
          goal,
          lotId: lotId || undefined,
          acquisitionBasis: basis === null || Number.isNaN(basis) ? null : basis,
          liquidityDeadlineYears: deadlineYears,
        };

  const terms: CommercialTerms = { combinationPct, developerMarkup };

  const profileKey = JSON.stringify(profile);
  const result: DecisionResult | null = useMemo(
    () => (profile ? analyzeProfile(profile, terms, PROJECT_CONFIG) : null),
    // profileKey captures every profile field; terms are primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileKey, combinationPct, developerMarkup],
  );

  return {
    inputs: {
      areaMode, setAreaMode, areaText, setAreaText, fractionText, setFractionText,
      lotId, setLotId, capitalText, setCapitalText, repaymentMode, setRepaymentMode,
      repaymentText, setRepaymentText, goal, setGoal, combinationPct, setCombinationPct,
      developerMarkup, setDeveloperMarkup, basisText, setBasisText, deadlineYears, setDeadlineYears,
    },
    landArea: area.value,
    errors,
    profile,
    terms,
    result,
  };
}

export type DecisionEngine = ReturnType<typeof useDecisionEngine>;
