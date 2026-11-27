/**
 * Optional local persistence of the user's answers — only after explicit consent in the wizard.
 * Data stays in this browser's localStorage; it is never sent anywhere. Every access is guarded,
 * because storage can be unavailable (private mode, blocked site data).
 */
import { PROJECT_CONFIG } from '../data/config';
import type { Goal, TaxArrangement } from '../domain/types';

export const STORAGE_KEY = 'mimush-chacham:answers:v1';

export interface SavedInputs {
  version: 1;
  areaMode: 'sqm' | 'fraction';
  areaText: string;
  fractionText: string;
  lotId: string;
  capitalText: string;
  repaymentMode: 'amount' | 'none' | 'unknown';
  repaymentText: string;
  goal: Goal;
  combinationPct: number;
  developerMarkup: number;
  basisText: string;
  deadlineYears: number;
  /** Set on load when a retired goal was mapped to a current one (never saved). */
  migratedGoalFrom?: Goal;
  /** Added in iteration 3; older saved answers without it are migrated to 'unknown'. */
  soleHome?: 'unknown' | 'yes' | 'no' | 'replacement';
  /** What the developer pays at the offered combination %. Older saves without it load as 'mixed'. */
  taxArrangement?: TaxArrangement;
  /** Optional actual-offer terms and borrowing on another property (iteration 6). Older saves: empty / false. */
  levyCapText?: string;
  developerPaysInterest?: boolean;
  otherPropertyLimitText?: string;
}

const GOALS: Goal[] = ['balanced', 'maximize_apartments', 'passive_income', 'immediate_cash', 'minimize_risk'];

function isValid(x: unknown): x is SavedInputs {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  const str = (k: string) => typeof o[k] === 'string';
  const num = (k: string) => typeof o[k] === 'number' && Number.isFinite(o[k] as number);
  return (
    o.version === 1 &&
    (o.areaMode === 'sqm' || o.areaMode === 'fraction') &&
    ['areaText', 'fractionText', 'lotId', 'capitalText', 'repaymentText', 'basisText'].every(str) &&
    (o.repaymentMode === 'amount' || o.repaymentMode === 'none' || o.repaymentMode === 'unknown') &&
    GOALS.includes(o.goal as Goal) &&
    ['combinationPct', 'developerMarkup', 'deadlineYears'].every(num) &&
    (o.soleHome === undefined || o.soleHome === 'unknown' || o.soleHome === 'yes' || o.soleHome === 'no' || o.soleHome === 'replacement') &&
    (o.taxArrangement === undefined || o.taxArrangement === 'gross' || o.taxArrangement === 'mixed' || o.taxArrangement === 'net') &&
    (o.levyCapText === undefined || typeof o.levyCapText === 'string') &&
    (o.otherPropertyLimitText === undefined || typeof o.otherPropertyLimitText === 'string') &&
    (o.developerPaysInterest === undefined || typeof o.developerPaysInterest === 'boolean')
  );
}

export function loadInputs(): SavedInputs | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) return null;
    // The wizard now offers three goals; the two retired ones map to their nearest successor — and the app says so once.
    const goal: Goal =
      parsed.goal === 'passive_income' ? 'maximize_apartments' : parsed.goal === 'immediate_cash' ? 'minimize_risk' : parsed.goal;
    const migratedGoalFrom = goal !== parsed.goal ? parsed.goal : undefined;
    // A saved lot the current tables no longer have is dropped (the default lot is then assumed and flagged).
    const lotId = PROJECT_CONFIG.rights.lotIds.includes(parsed.lotId) ? parsed.lotId : '';
    return { soleHome: 'unknown', taxArrangement: 'mixed', levyCapText: '', developerPaysInterest: false, otherPropertyLimitText: '', ...parsed, goal, lotId, migratedGoalFrom };
  } catch {
    return null;
  }
}

export function saveInputs(inputs: SavedInputs): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    return true;
  } catch {
    return false;
  }
}

export function clearInputs(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
