/**
 * Optional local persistence of the user's answers — only after explicit consent in the wizard.
 * Data stays in this browser's localStorage; it is never sent anywhere. Every access is guarded,
 * because storage can be unavailable (private mode, blocked site data).
 */
import type { Goal } from '../domain/types';

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
    ['combinationPct', 'developerMarkup', 'deadlineYears'].every(num)
  );
}

export function loadInputs(): SavedInputs | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
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
