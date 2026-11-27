# Architecture — מתחם 13 – סימולציית עסקאות

Static, local-first, deterministic decision engine. React 19 + Vite, TypeScript for the engine,
Vitest + fast-check for tests, GitHub Pages for hosting. No backend, no runtime API calls, no analytics.

## Flow

```
UserProfile + CommercialTerms ─▶ analyzeProfile()  (src/optimizer/analyze.ts)
   1. calculateRights        domain/rights.ts       R = A / 167 × 2.25 (+ official table values)
   2. generateStrategies     optimizer/generate.ts  S01–S10 candidates, every whole-apartment count
   3. evaluateScenarios      optimizer/scenarios.ts favourable / base / adverse
        └ evaluateCandidate  optimizer/evaluate.ts  legs → ledger + dated cash events → monthly simulation
   4. assess + classify      optimizer/feasibility.ts  unfunded obligations, staged financing, repayment,
                                                       stage-specific LTV → affordability / resilience / commercial
   4b. candidatePnL          domain/developer.ts    per-candidate developer P&L from the same ledger
   5. rankStrategies         optimizer/rank.ts      Pareto frontier, then goal weights (incl. commercial risk)
   5b. arrangements          analyze.ts             gross / mixed / net re-analysis → decision tree + fallback
   6. strategy/global targets optimizer/reverse.ts  bisection for negotiation thresholds
   7. sensitivity            analyze.ts             one-at-a-time adverse flips of each assumption
   8. findMaterialUnknowns   optimizer/questions.ts re-runs coreAnalysis with plausible answers; asks only if the top changes
```

## Layers

| Folder | Responsibility |
| --- | --- |
| `src/data/` | `parcel33.js` (official allocation tables, unchanged), and provenance-tagged `DataPoint`s: `project.ts`, `market.ts` (incl. financing), `regulation.ts`, `commercial.ts`, `scenarios.ts`, `sources.ts`; `config.ts` assembles the flat `ProjectConfig`. |
| `src/domain/` | Pure financial primitives: rights, construction quote and schedule, tax reserves, mortgage formulas, valuation, transaction legs → plan, month-by-month cash-flow simulation with staged financing, developer-side economics (`developer.ts`). |
| `src/optimizer/` | Generate, evaluate, feasibility, scenarios, rank, reverse, questions, Hebrew explanations. |
| `src/hooks/useDecisionEngine.ts` | UI state (optionally hydrated from saved answers); runs `analyzeProfile` in a `useMemo`. |
| `src/hooks/storage.ts` | Validated, consent-based localStorage persistence of the answers. |
| `src/components/inputs/` | `Wizard.tsx` (first-run onboarding, also used to edit), `fields.tsx` (shared inputs), `AnswersBar.tsx` (answers summary + live developer-terms card). |
| `src/components/` | `inputs/`, `verdict/`, `comparisons/`, `assumptions/`, `print/`, and `legacy/` (the original four-track simulator under “השוואה מתקדמת”). |
| `src/utils/simulationMath.js` | Legacy calculator, kept as regression baseline and reused for table rights. |

A full analysis takes ~5–25 ms in Node, so no Web Worker was introduced.

## Privacy

* Personal inputs live in React state. They are written to `localStorage` (`mimush-chacham:answers:v1`) **only** if
  the user keeps the “save in this browser” box checked at the end of the wizard; “מחיקת התשובות השמורות” removes
  them. Never in URLs, never sent anywhere. All storage access is wrapped in try/catch.
* Production builds inject a CSP (`connect-src 'none'`, `script-src 'self'`) and `referrer: no-referrer` (`vite.config.js`).
* `npm run test:e2e` (after `npm run build`) drives Chromium through the inputs and fails on any network request
  caused by input changes, any cross-origin request, console errors or horizontal overflow at 390 px.
* The named allocation tables stay out of git (`to-review/` is ignored).

## UX flow

1. **First visit → wizard** (7 screens): welcome → land → free capital → monthly repayment → goal →
   “important to know” (key assumptions with verification tags + the two developer sliders + an acknowledgement)
   → summary with per-answer edit links and the consent box for saving.
2. **Main screen** (and every later visit when answers are saved): answers summary with “שינוי” per answer →
   recommendation → follow-up questions with “לענות עכשיו” → live developer-terms sliders → alternatives →
   collapsible detail sections → print.
3. The legacy calculator stays under “מחשבון מתקדם”.
