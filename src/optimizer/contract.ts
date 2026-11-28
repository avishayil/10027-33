/**
 * Iteration 10 (review of c689d0b, §A/§F): one executable contract, evaluated once, read by both sides.
 *
 * A contract is the commercial terms (combination %, tax arrangement, markup, offer overrides) plus the funding the
 * household relies on, applied to one route. `evaluateContract` runs the route once (all scenarios, the household's
 * ledger and cash flow, and the lot-level developer P&L with this route's delta, services slots and tax subsidy) and
 * returns a snapshot. The owner's view and the developer's view both come from that snapshot, so they always concern
 * exactly the same deal — never the household's best route against a generic developer baseline.
 */
import { withArrangement } from '../domain/arrangements';
import { calculateRights } from '../domain/rights';
import type { Candidate, CommercialTerms, ConsiderationReconciliation, Goal, ProjectConfig, StrategyResult, TaxArrangement, UserProfile } from '../domain/types';
import { buildResult } from './analyze';
import type { EngineContext } from './evaluate';
import { generateStrategies } from './generate';
import { evaluateScenarios } from './scenarios';

export type ContractFunding = 'none' | 'developer_loan' | 'other_property';
export type ContractStatus = 'infeasible' | 'modeled_conditional' | 'terms_confirmed';
export type OwnerReason = 'unfunded' | 'missing_info' | 'price' | 'inventory' | 'policy' | 'goal';

export interface ContractTerms {
  arrangement: TaxArrangement;
  combinationPct: number;
  markup: number;
  offer: { levyCap: number | null; developerPaysTaxLoanInterest: boolean };
  funding: ContractFunding;
}

export interface ContractSnapshot {
  /** Stable id of (lot, terms, funding, route) — the same id on both sides and in every branch. */
  id: string;
  /** Fingerprint of the household inputs and configuration it was computed from. */
  inputHash: string;
  lotId: string;
  contract: ContractTerms;
  routeId: string;
  route: Candidate;
  owner: {
    value: number;
    transactionValue: number;
    accepts: boolean;
    /** Why the owner does not accept (hard constraint, evidence or goal), or null. */
    reason: string | null;
    reasonCode: OwnerReason | null;
    /** Hard constraints that fail (cash, repayment, collateral, missing information). */
    hard: string[];
    wholeApartments: number;
    borrowing: number;
  };
  developer: { margin: number | null; profit: number | null; hurdle: number; ok: boolean };
  consideration: ConsiderationReconciliation | null;
  /** Everything the result still depends on: lender, contract terms, evidence, outside options. */
  conditions: string[];
  status: ContractStatus;
  result: StrategyResult;
}

/** Stable fingerprint (FNV-1a over a key-sorted JSON). */
export function fingerprint(x: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])])) : v;
  const s = JSON.stringify(stable(x));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The configuration a contract runs on: arrangement, offer overrides and only the funding the contract names. */
export function contractConfig(base: ProjectConfig, k: ContractTerms): ProjectConfig {
  const cfg = withArrangement(base, k.arrangement);
  return {
    ...cfg,
    commercial: { ...cfg.commercial, offer: { ...k.offer } },
    financing: {
      ...cfg.financing,
      taxLoan: { ...cfg.financing.taxLoan, available: k.funding === 'developer_loan', considerAsAlternative: false },
      otherPropertyLoanAssumed: k.funding === 'other_property',
    },
  };
}

/** Routes whose outcome needs actual apartment inventory (a tier or a mix of sizes) — by capability, not by id. */
export function needsInventory(c: Candidate): boolean {
  return c.legs.some((l) => l.kind === 'tier_apartment' || l.kind === 'apartment_mix');
}

/** Every route of a contract, each evaluated once (owner and route-specific developer side together). */
export function evaluateRoutes(profile: UserProfile, k: ContractTerms, base: ProjectConfig): StrategyResult[] {
  const config = contractConfig(base, k);
  const info = calculateRights(profile.landAreaSqm, config, profile.lotId);
  const terms: CommercialTerms = { combinationPct: k.combinationPct, developerMarkup: k.markup };
  const ctx: EngineContext = { info, profile, terms };
  return generateStrategies(info, terms, config).map((c) => buildResult(c, evaluateScenarios(c, ctx, config), ctx, config));
}

const hardOk = (r: StrategyResult) => r.assessment.affordability === 'fits' || r.assessment.affordability === 'fits_with_financing';

/**
 * Goal-specific acceptance on top of the hard constraints (review A2): the whole-apartment goal needs the most whole
 * apartments any fundable route reaches on these terms (not merely one); no-risk needs no borrowing; cash-soon needs
 * cash before the deadline; income needs a positive net income.
 */
export function goalReason(goal: Goal, r: StrategyResult, peers: StrategyResult[]): string | null {
  switch (goal) {
    case 'maximize_apartments': {
      const best = Math.max(0, ...peers.filter(hardOk).map((p) => p.metrics.wholeApartments));
      if (r.metrics.wholeApartments < Math.max(1, best)) return `פחות דירות שלמות מהאפשרי בתנאים האלה (${best})`;
      return null;
    }
    case 'minimize_risk':
      return r.simulation.totalDrawn > 1 ? 'דורש הלוואה' : null;
    case 'immediate_cash':
      return r.metrics.liquidity > 0 ? null : 'אין כסף עד המועד שהגדרתם';
    case 'passive_income':
      return r.metrics.sustainableMonthlyIncome > 0 ? null : 'אין הכנסה חודשית נטו';
    default:
      return null;
  }
}

/** Snapshots of every route of a contract, with acceptance on both sides and the status of the result. */
export function snapshotsFor(profile: UserProfile, k: ContractTerms, base: ProjectConfig): ContractSnapshot[] {
  const results = evaluateRoutes(profile, k, base);
  const lotId = profile.lotId || base.rights.defaultLotId;
  const inputHash = fingerprint({ profile, base: base.version, lotId });
  const hurdle = base.developer.targetMarginOnRevenue;
  return results.map((r) => {
    const baseFails = r.scenarioResults.find((s) => s.scenarioId === 'base')?.fails ?? [];
    const hard = [...new Set([...baseFails, ...r.reasonCodes.filter((c) => c === 'CAPITAL_UNKNOWN')])];
    let code: OwnerReason | null = null;
    let reason: string | null = null;
    if (!hardOk(r)) [code, reason] = r.assessment.affordability === 'unknown' ? ['missing_info', 'חסר מידע (הון / החזר)'] : ['unfunded', 'לא ניתן לממן'];
    else if (r.priceDependency) [code, reason] = ['price', 'תלוי במחיר שלא ידוע'];
    else if (needsInventory(r.candidate)) [code, reason] = ['inventory', 'תלוי במלאי דירות שלא אושר'];
    else if (r.assessment.commercial === 'negotiable') [code, reason] = ['policy', 'היזם לא צפוי להציע (מדיניות שירותי בנייה)'];
    else {
      reason = goalReason(profile.goal, r, results);
      code = reason ? 'goal' : null;
    }
    const margin = r.developerLot?.margin ?? r.developerMargin ?? null;
    const developerOk = margin !== null && margin >= hurdle - 1e-9;
    const conditions = [
      ...r.requiredConditions,
      // Neither side's outside option is known: the owner's no-agreement value (no current land price) and whether
      // the developer's hurdle is its actual requirement.
      'OUTSIDE_OPTION_UNKNOWN',
      'DEVELOPER_HURDLE_ASSUMED',
      ...(r.developerLot?.consideration.material ? ['CONSIDERATION_MISMATCH'] : []),
    ];
    const accepts = reason === null;
    const status: ContractStatus = !accepts || !developerOk ? 'infeasible' : conditions.length ? 'modeled_conditional' : 'terms_confirmed';
    return {
      id: fingerprint({ lotId, contract: k, route: r.candidate }),
      inputHash,
      lotId,
      contract: k,
      routeId: r.id,
      route: r.candidate,
      owner: {
        value: r.comparisonValue,
        transactionValue: r.transactionValue,
        accepts,
        reason,
        reasonCode: code,
        hard,
        wholeApartments: r.metrics.wholeApartments,
        borrowing: r.simulation.totalDrawn,
      },
      developer: { margin, profit: r.developerLot?.profit ?? null, hurdle, ok: developerOk },
      consideration: r.developerLot?.consideration ?? null,
      conditions: [...new Set(conditions)],
      status,
      result: r,
    };
  });
}
