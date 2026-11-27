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

export function matrix(config: ProjectConfig): string {
  const cases: [number, number | null, number | null, Goal][] = [
    [2.25, 300000, 5000, 'balanced'],
    [2.25, 0, 0, 'balanced'],
    [2.25, 800000, 5000, 'balanced'],
    [1.125, 300000, 5000, 'balanced'],
    [1.5, 300000, 5000, 'maximize_apartments'],
    [3, 600000, 8000, 'balanced'],
    [3, 300000, 5000, 'balanced'],
    [4, 3000000, 20000, 'maximize_apartments'],
    [2.25, null, null, 'balanced'],
  ];
  const lines = [
    '| R | Cash | Repay | Goal | Decision | Status | Cash at signing | Tax reserve (owner) | Peak debt | Monthly | Dev. margin | Adverse value | S06 / S11 / S05 peak / monthly |',
    '|---|---:|---:|---|---|---|---:|---:|---:|---:|---:|---:|---|',
  ];
  for (const [R, cap, P, goal] of cases) {
    const d = analyzeProfile({ landAreaSqm: (R / 2.25) * 167, availableCapital: cap, maxMonthlyRepayment: P, goal }, { combinationPct: 0.35, developerMarkup: 0.175 }, config);
    const r = d.recommendation;
    const adv = r?.scenarioResults.find((s) => s.scenarioId === 'adverse');
    // A direction that depends on terms still to obtain (iteration 6: funding is never assumed).
    const c = (d as { conditionalRecommendation?: { result: StrategyResult; kind?: string; method?: string | null; arrangement: string } | null }).conditionalRecommendation;
    const decision = r?.id ?? (c ? `none → ${c.result.id} if ${c.kind === 'funding' ? (c.method ?? 'funding') : c.arrangement}` : 'none');
    lines.push(
      `| ${R} | ${cap === null ? '?' : fmt(cap)} | ${P === null ? '?' : fmt(P)} | ${goal} | ${decision} | ${r ? `${r.feasibility}/${r.assessment.commercial}` : '—'} | ${r ? fmt(cashNow(r)) : '—'} | ${fmt(r?.capitalGainsTaxReserve)} | ${fmt(r?.mortgageRequired)} | ${fmt(r?.monthlyRepayment)} | ${pct(r?.developerMargin)} | ${adv ? `${fmt(adv.valueCreated)}${adv.feasible ? '' : ' (fails)'}` : '—'} | ${ids.map((p) => lookup(d, p)).join(' · ')} |`,
    );
  }
  return lines.join('\n');
}

it('household validation matrix', () => {
  const out = matrix(C);
  console.log(out);
  if (process.env.WRITE_REPORT) writeFileSync(process.env.WRITE_REPORT, out + '\n');
});
