# Architecture — מימוש חכם

Static, local-first, deterministic decision engine. React 19 + Vite, TypeScript for the engine,
Vitest + fast-check for tests, GitHub Pages for hosting. No backend, no runtime API calls, no analytics.

## Flow

```
UserProfile + CommercialTerms ─▶ analyzeProfile()  (src/optimizer/analyze.ts)
   1. calculateRights        domain/rights.ts       R = A / 167 × 2.25 (+ official table values)
   2. generateStrategies     optimizer/generate.ts  S01–S10 candidates, every whole-apartment count
   3. evaluateScenarios      optimizer/scenarios.ts favourable / base / adverse
        └ evaluateCandidate  optimizer/evaluate.ts  legs → ledger + dated cash events → monthly simulation
   4. assess + classify      optimizer/feasibility.ts  cash, repayment, LTV; conditions; status
   5. rankStrategies         optimizer/rank.ts      Pareto frontier, then goal weights
   6. strategy/global targets optimizer/reverse.ts  bisection for negotiation thresholds
   7. sensitivity            analyze.ts             one-at-a-time adverse flips of each assumption
   8. findMaterialUnknowns   optimizer/questions.ts follow-up questions with a reason
```

## Layers

| Folder | Responsibility |
| --- | --- |
| `src/data/` | `parcel33.js` (official allocation tables, unchanged), and provenance-tagged `DataPoint`s: `project.ts`, `market.ts` (incl. financing), `regulation.ts`, `commercial.ts`, `scenarios.ts`, `sources.ts`; `config.ts` assembles the flat `ProjectConfig`. |
| `src/domain/` | Pure financial primitives: rights, construction quote and schedule, tax reserves, mortgage formulas, valuation, transaction legs → plan, month-by-month cash-flow simulation. |
| `src/optimizer/` | Generate, evaluate, feasibility, scenarios, rank, reverse, questions, Hebrew explanations. |
| `src/hooks/useDecisionEngine.ts` | In-memory UI state; runs `analyzeProfile` in a `useMemo`. |
| `src/components/` | `inputs/`, `verdict/`, `comparisons/`, `assumptions/`, `print/`, and `legacy/` (the original four-track simulator under “השוואה מתקדמת”). |
| `src/utils/simulationMath.js` | Legacy calculator, kept as regression baseline and reused for table rights. |

A full analysis takes ~5–25 ms in Node, so no Web Worker was introduced.

## Privacy

* Personal inputs live only in React state — no storage, no URL parameters.
* Production builds inject a CSP (`connect-src 'none'`, `script-src 'self'`) and `referrer: no-referrer` (`vite.config.js`).
* `npm run test:e2e` (after `npm run build`) drives Chromium through the inputs and fails on any network request
  caused by input changes, any cross-origin request, console errors or horizontal overflow at 390 px.
* The named allocation tables stay out of git (`to-review/` is ignored).
