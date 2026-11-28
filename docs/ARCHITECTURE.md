# Architecture — מתחם 13 – סימולציית עסקאות

Static, local-first, deterministic decision engine. React 19 + Vite, TypeScript for the engine,
Vitest + fast-check for tests, GitHub Pages for hosting. No backend, no runtime API calls, no analytics.

## Flow

```
UserProfile + CommercialTerms ─▶ analyzeProfile()  (src/optimizer/analyze.ts)
   1. calculateRights        domain/rights.ts       R = official residential share ÷ 100 m² (2.25/167 kept as a pinned simulation basis)
   2. generateStrategies     optimizer/generate.ts  S01–S10 candidates, every whole-apartment count
   3. evaluateScenarios      optimizer/scenarios.ts favourable / base / adverse
        └ evaluateCandidate  optimizer/evaluate.ts  legs → ledger + dated cash events → monthly simulation
   4. assess + classify      optimizer/feasibility.ts  unfunded obligations, staged financing, repayment,
                                                       stage-specific LTV → affordability / resilience / commercial
   4b. candidatePnL          domain/developer.ts    per-candidate developer P&L from the same ledger
   5. rankStrategies         optimizer/rank.ts      Pareto frontier, then goal weights (incl. commercial risk)
   5b. arrangements          analyze.ts             gross / mixed / net re-analysis at the developer-equivalent %
                             optimizer/arrangementEquivalence.ts (payer table: domain/arrangements.ts)
                                                       → decision tree, owner break-even %, fallback
   6. strategy/global targets optimizer/reverse.ts  bisection for negotiation thresholds
   7. sensitivity            analyze.ts             one-at-a-time adverse flips of each assumption
   8. findMaterialUnknowns   optimizer/questions.ts re-runs coreAnalysis with plausible answers; asks only if the top changes
```

## Layers

| Folder | Responsibility |
| --- | --- |
| `src/data/` | `parcel33.js` (official allocation tables, unchanged), and provenance-tagged `DataPoint`s: `project.ts`, `market.ts` (incl. financing), `regulation.ts`, `commercial.ts`, `scenarios.ts`, `sources.ts`; `config.ts` assembles the flat `ProjectConfig`. |
| `src/domain/` | Pure financial primitives: rights, construction quote and schedule, tax reserves, mortgage formulas, valuation, transaction legs → plan, month-by-month cash-flow simulation with staged financing, developer-side economics (`developer.ts`). |
| `src/optimizer/` | Generate, evaluate, feasibility, scenarios, rank, reverse, questions, Hebrew explanations. Iteration 10: `contract.ts` (one executable contract per terms × funding × route, read by both sides), `joint/search.ts`, `concessions.ts`, `contingent.ts`, `group/collective.ts` — all built on contract snapshots. |
| `src/hooks/useDecisionEngine.ts` | UI state (optionally hydrated from saved answers); runs `analyzeProfile` on a debounced, deferred render and returns the result together with the exact inputs it was computed from (`analysis`), so cards that re-run parts of it never mix old results with new inputs. |
| `src/hooks/storage.ts` | Validated, consent-based localStorage persistence of the answers. |
| `src/components/inputs/` | `Wizard.tsx` (first-run onboarding, also used to edit), `fields.tsx` (shared inputs), `AnswersBar.tsx` (answers summary + live developer-terms card). |
| `src/components/` | `inputs/`, `verdict/`, `comparisons/` (incl. the on-demand JointSearch, GroupPlanner, ContingentCard, ConcessionsCard), `assumptions/`, `print/`. The original four-track simulator was removed (DECISIONS #118). |
| `src/utils/simulationMath.js` | Table-rights math (`computeTableRights`) and the legacy calculator kept only as a regression fixture. |

A full analysis takes ~80–130 ms in Node; in the browser at 4× CPU slowdown (V1.0 Milestone E): input paint ≈ 35 ms, recalculation ≈ 650 ms (incl. the 250 ms debounce), joint search ≈ 1.7 s, offer check ≈ 125 ms. On-demand engines (`tests/perf/benchmark.test.ts`): group of 8 ≤ 90 ms;
joint search 0.4–0.5 s for typical holdings, ≈ 2 s for a whole-lot holding; contingent plan and concessions < 25 ms.
They run after a short timeout with an input fingerprint: a run started on inputs that changed meanwhile is dropped and
a result computed on older inputs is hidden. No Web Worker (DECISIONS #134).

## Contract snapshots (iteration 10)

```
ContractTerms (arrangement, %, markup, offer, funding) ─▶ contractConfig ─▶ every route evaluated once (buildResult)
   └ ContractSnapshot { id, inputHash, lotId, route, owner {value, accepts, reason}, developer {route-specific lot
     margin, profit}, consideration, conditions, status: infeasible | modeled_conditional | terms_confirmed }
        ├ joint/search     pairs (contract, route) feasible only when both sides accept the same snapshot
        ├ concessions      the same route under a changed contract, both sides re-evaluated
        ├ contingent       fixed vs option contracts; the switched plan = fallback prefix + target from the exercise date
        └ group/collective one common contract for all members; pool re-evaluated with the units actually sold
```

## Privacy

* Personal inputs live in React state. They are written to `localStorage` (`mimush-chacham:answers:v1`) **only** if
  the user keeps the “save in this browser” box checked at the end of the wizard; “מחיקת התשובות השמורות” removes
  them. Never in URLs, never sent anywhere. All storage access is wrapped in try/catch.
* Production builds inject a CSP (`connect-src 'none'`, `script-src 'self'`) and `referrer: no-referrer` (`vite.config.js`).
* `npm run test:e2e` (after `npm run build`; `E2E_BASE` = the deployed base path) drives Chromium through the inputs and
  the advanced features (joint search, group planner) and fails on any network request caused by them, group inputs in
  localStorage, a stale result shown after an input change, any cross-origin request, console errors or horizontal
  overflow at 390 px. CI runs it on the very build that is deployed.
* `tests/release/publicAssets.test.ts`: the PDFs in `public/` are a reviewed SHA-256 allow-list without author
  metadata or valid Israeli ID numbers in their text.
* The named allocation tables stay out of git (`to-review/` is ignored).

### Privacy limits (V1.0, stated plainly)

* **CSP** (`vite.config.js`): `connect-src 'none'`, `script-src 'self'`, `form-action 'none'`, `object-src 'none'`,
  images only from this origin or `data:`; `referrer: no-referrer`. It blocks the page's own network requests. It does
  not stop the user following a link (the plan site, the maps), printing, taking screenshots, or a browser extension
  reading the page.
* **localStorage**: saved only with consent; plain text in this browser profile; readable by anyone using the same
  device and profile and by extensions with page access; no expiry. "מחיקת התשובות השמורות" removes every key the app
  wrote. The wizard warns about shared devices. The actual offer and the group planner inputs are never stored.
* **No telemetry**, no server, no third-party requests — checked in the browser on the deployed build
  (`tests/e2e/privacy.mjs`, `tests/e2e/release.mjs`).

## UX flow

1. **First visit → wizard** (7 screens): welcome → land → free capital → monthly repayment → goal →
   “important to know” (key assumptions with verification tags + the two developer sliders + an acknowledgement)
   → summary with per-answer edit links and the consent box for saving.
2. **Main screen** (and every later visit when answers are saved): answers summary with “שינוי” per answer →
   recommendation → follow-up questions with “לענות עכשיו” → live developer-terms sliders → alternatives →
   collapsible detail sections → print.
3. The advanced view (toggle) adds the detail sections and the on-demand negotiation tools; print is disabled while a newer analysis is computing.
