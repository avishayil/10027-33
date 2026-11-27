# Implementation status

| Phase | Status |
| --- | --- |
| 0 Baseline, config registry, provenance | Done — legacy tests unchanged and passing |
| 1 Domain engine | Done — rights, construction, tax reserves, mortgage, cash-flow, legs, ledger |
| 2 Hybrid optimisation | Done — S01–S10 (S01M as open-market reference) |
| 3 Feasibility & recommendation | Done — 5 statuses, 3 scenarios, Pareto + goal ranking, sensitivity, Hebrew explanations |
| 4 UI | Done — 4 personal inputs, 2 sliders, verdict, alternatives, 7 collapsible sections, legacy tab |
| 5 Negotiation intelligence | Done — thresholds by bisection, print summary |
| 6 Validation & deployment | Partly — automated tests, privacy/e2e browser check, CSP. **Professional review of the fixtures is still required.** |
| Iteration 2 | Done — golden fixture, staged financing & unfunded obligations, stage collateral, fractional entitlements (S02C), S11, developer economics, three thresholds, three-part assessment, stable ranking, sensitivity-driven questions, tax timing/basis fixes |
| Iteration 3 | Done — P0 tax valuation & arrangements, dated cash flow, per-candidate developer P&L, policy scenarios; P1 apartment tiers, balancing pool, metrics, decision tree UX. See VALIDATION-REPORT §8 for what remains. |
| 7 Advanced (P1) | Not started — S12 family consolidation, developer-offer comparison, alternative apartment sizes, detailed tax profiles, optional encrypted local save, offline cache, `scripts/update-market-snapshot.mjs` |

## Commands
```
npm run typecheck && npm run lint && npm test
npm run build && npm run test:e2e
```
