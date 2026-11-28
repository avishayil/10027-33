/**
 * Household validation matrix. Prints (and, with WRITE_REPORT=<file>, writes) one line per case:
 * decision, cash needed now, tax reserve, peak debt, repayment, status, developer margin, adverse outcome.
 * Not an assertion of "correct" winners — a traceable before/after record for review.
 */
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { PROJECT_CONFIG as C } from '../../src/data/config';
import type { Goal, ProjectConfig, StrategyResult } from '../../src/domain/types';
import { analyzeProfile } from '../../src/optimizer/analyze';

const fmt = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US'));
const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${(n * 100).toFixed(1)}%`);

function cashNow(r: StrategyResult): number {
  return r.ledger.filter((e) => e.payer === 'owner' && e.direction === 'out' && e.month === 0 && !e.deferred).reduce((s, e) => s + e.amount, 0);
}

const ids = ['S06', 'S11', 'S05'];
function lookup(d: ReturnType<typeof analyzeProfile>, prefix: string) {
  const r = d.results.find((x) => x.strategyType === prefix && x.plan.wholeApartmentsRetained >= 1);
  return r ? `${fmt(r.mortgageRequired)} / ${fmt(r.simulation.postCompletionMonthly)}` : '—';
}

type Case = { area: number; lot: string; cap: number | null; P: number | null; goal: Goal; pct?: number; markup?: number };
/** V1 matrix (RELEASE-CRITERIA): 167 m² profiles, 83.5 m², 1.5 / 3 / 4 simulation rights, unknown inputs, every goal,
 * three lots and the slider extremes. Rows by area — the engine's own entitlement is a column. */
export const CASES: Case[] = [
  { area: 167, lot: '149', cap: 0, P: 0, goal: 'balanced' },
  { area: 167, lot: '149', cap: 300000, P: 5000, goal: 'balanced' },
  { area: 167, lot: '149', cap: 800000, P: 5000, goal: 'balanced' },
  { area: 83.5, lot: '149', cap: 300000, P: 5000, goal: 'balanced' },
  { area: (1.5 / 2.25) * 167, lot: '149', cap: 300000, P: 5000, goal: 'maximize_apartments' },
  { area: (3 / 2.25) * 167, lot: '149', cap: 600000, P: 8000, goal: 'balanced' },
  { area: (4 / 2.25) * 167, lot: '149', cap: 3000000, P: 20000, goal: 'maximize_apartments' },
  { area: 167, lot: '149', cap: null, P: null, goal: 'balanced' },
  { area: 167, lot: '149', cap: 800000, P: 8000, goal: 'maximize_apartments' },
  { area: 167, lot: '149', cap: 300000, P: 5000, goal: 'passive_income' },
  { area: 167, lot: '149', cap: 300000, P: 5000, goal: 'immediate_cash' },
  { area: 167, lot: '149', cap: 300000, P: 5000, goal: 'minimize_risk' },
  { area: 167, lot: '150', cap: 300000, P: 5000, goal: 'balanced' },
  { area: 167, lot: '153', cap: 300000, P: 5000, goal: 'balanced' },
  { area: 167, lot: '149', cap: 300000, P: 5000, goal: 'balanced', pct: 0.25, markup: 0.15 },
  { area: 167, lot: '149', cap: 300000, P: 5000, goal: 'balanced', pct: 0.45, markup: 0.2 },
];

export function matrix(config: ProjectConfig): string {
  const lines = [
    '| m² | Lot | R | Cash | Repay | Goal | % / markup | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |',
    '|---:|---|---:|---:|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---|',
  ];
  for (const k of CASES) {
    const terms = { combinationPct: k.pct ?? 0.35, developerMarkup: k.markup ?? 0.175 };
    const d = analyzeProfile({ landAreaSqm: k.area, availableCapital: k.cap, maxMonthlyRepayment: k.P, goal: k.goal, lotId: k.lot }, terms, config);
    const r = d.recommendation;
    const adv = r?.scenarioResults.find((s) => s.scenarioId === 'adverse');
    // A direction that depends on terms still to obtain (iteration 6: funding is never assumed).
    const c = (d as { conditionalRecommendation?: { result: StrategyResult; kind?: string; method?: string | null; arrangement: string } | null }).conditionalRecommendation;
    const decision = r?.id ?? (c ? `none → ${c.result.id} if ${c.kind === 'funding' ? (c.method ?? 'funding') : c.arrangement}` : 'none');
    lines.push(
      `| ${k.area.toFixed(1)} | ${k.lot} | ${d.rights.apartmentEquivalents.toFixed(3)} | ${k.cap === null ? '?' : fmt(k.cap)} | ${k.P === null ? '?' : fmt(k.P)} | ${k.goal} | ${pct(terms.combinationPct)} / ${pct(terms.developerMarkup)} | ${decision} | ${r ? `${r.feasibility}/${r.assessment.commercial}` : '—'} | ${r ? fmt(cashNow(r)) : '—'} | ${fmt(r?.capitalGainsTaxReserve)} | ${fmt(r?.mortgageRequired)} | ${fmt(r?.monthlyRepayment)} | ${pct(r?.developerMargin)} | ${adv ? `${fmt(adv.valueCreated)}${adv.feasible ? '' : ' (fails)'}` : '—'} | ${ids.map((p) => lookup(d, p)).join(' · ')} |`,
    );
  }
  return lines.join('\n');
}

it('household validation matrix (official entitlement, the default; and the 2.25 simulation convention)', () => {
  const sim: ProjectConfig = { ...C, rights: { ...C.rights, entitlementBasis: 'simulation' } };
  const out = `### Official allocation share (default)\n\n${matrix(C)}\n\n### Simulation convention (2.25 per 167 m²)\n\n${matrix(sim)}`;
  console.log(out);
  if (process.env.WRITE_REPORT) writeFileSync(process.env.WRITE_REPORT, out + '\n');
});
