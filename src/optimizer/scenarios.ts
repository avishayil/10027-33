import { applyScenario } from '../data/scenarios';
import type { Candidate, ProjectConfig, ScenarioId } from '../domain/types';
import { evaluateCandidate, type EngineContext, type Evaluation } from './evaluate';

export type ScenarioEvaluations = Record<ScenarioId, Evaluation>;

/** Re-evaluates a candidate under the favourable, base and adverse scenario sets. */
export function evaluateScenarios(candidate: Candidate, ctx: EngineContext, config: ProjectConfig): ScenarioEvaluations {
  return {
    favorable: evaluateCandidate(candidate, ctx, applyScenario(config, 'favorable')),
    base: evaluateCandidate(candidate, ctx, config),
    adverse: evaluateCandidate(candidate, ctx, applyScenario(config, 'adverse')),
  };
}
