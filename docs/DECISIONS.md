# Decisions

1. **Inverse simulator.** Besides forward evaluation, the engine solves for the terms that would make a blocked strategy fit.
2. **Separate land prices.** Immediate sale (null — no current valuation), historical reference, and developer scenario (₪6,900, unconfirmed) are distinct values.
3. **2.25 is a simulation unit**, kept separate from the official table (~2.4 units per 167 m²).
4. **Contingency vs overrun** use `max()`, never sum.
5. **Whole retained apartments earn net rent (or rent saved)** in the wealth comparison, so selling and keeping compare fairly; fractional shares earn nothing (iteration 2). S08 differs only in that rent counts toward repayment capacity; when its build-and-hold twin is eligible the duplicate is hidden from ranking.
6. **Combination capital-gains tax is paid by the owner** at signing (conservative; flagged as negotiable).
7. **Developer purchases are assumed post-approval** (seller pays the levy). Open-market sales now are pre-approval (levy priced in for the buyer).
8. **Unknown inputs never become zero silently**: unknown capital → “חסר מידע”, unknown repayment → conditional. Reverse targets treat unknowns as zero and say so.
9. ~~Whole-unit targets make a strategy conditional~~ — superseded in iteration 2 by the three-part assessment: commercial dependencies affect *commercial certainty*, not affordability.
10. **No Web Worker** — analysis is fast enough.
11. **CSP only in production builds** — Vite dev needs inline scripts and a websocket.
12. **Finding:** under the base assumptions, ₪6,900/m² for surplus rights is below what the land yields in a 35% combination, so hybrid “sell surplus + build” strategies rank below combination unless the developer pays substantially more (the app computes the minimum price per user).

## Iteration 2 (review of 925bdcf)

13. **₪202K was a reporting error.** It came from the e2e test inputs (₪350K, ₪6K/month, 40%). The moderate
    fixture needs ₪515,041 (₪3,011/month); a golden fixture now reconciles every line from first principles.
14. **Taxes, levy and transaction costs are never financed.** They create unfunded obligations, which are infeasible.
15. **Financing is staged** (bridge / construction / mortgage) with stage-specific collateral; sold rights excluded.
16. **Fractional entitlements are unresolved assets** (no rent, 20% illiquidity discount) unless a settlement is modelled.
17. **S11 added** with the analytical split. In the base case it is within ~3% of paid completion (S06); S06 still
    edges it because completion is priced at today’s value with no contingency or indexation, while construction
    carries both. That is sensitive to how the completion price is actually set.
18. **Developer economics is informational.** Under the user’s own assumptions (₪11,000/m² direct, ₪25,000/m²
    value) a 35% combination leaves the developer ≈ −3%, consistent with a cash price of ≈ ₪11,760/m²; ₪6,900
    leaves ≈ 16%. Either the assumed costs overstate a developer’s costs, or ₪6,900 understates the land. Real 35%
    offers existed, so the engine flags “מוטל בספק” instead of excluding combination strategies.
19. **Waiting is valued independently** of the developer price (post-approval market reference ₪7,100/m²).
20. **Stable normalisation** with fixed reference scales; explicit goal constraints.
21. **Follow-up questions are sensitivity-driven**: asked only if plausible answers change the recommendation
    (capital is always asked when missing).
22. New assumptions (all documented as planning assumptions): approval in 2 years, post-approval land value,
    20% fraction discount, 80% fraction cash settlement, developer soft costs 12%, target margin 15%,
    revenue-share tax at signing.
