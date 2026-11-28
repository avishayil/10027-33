import { applyScenario } from '../data/scenarios';
import type { Candidate, ProjectConfig, ScenarioId } from '../domain/types';
import { evaluateCandidate, type EngineContext, type Evaluation, type PlanTransform } from './evaluate';

export type ScenarioEvaluations = Record<ScenarioId, Evaluation>;

/** Re-evaluates a candidate under the favourable, base and adverse scenario sets. */
export function evaluateScenarios(candidate: Candidate, ctx: EngineContext, config: ProjectConfig, transform?: PlanTransform): ScenarioEvaluations {
  return {
    favorable: evaluateCandidate(candidate, ctx, applyScenario(config, 'favorable'), transform),
    base: evaluateCandidate(candidate, ctx, config, transform),
    adverse: evaluateCandidate(candidate, ctx, applyScenario(config, 'adverse'), transform),
  };
}
