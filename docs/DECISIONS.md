# Decisions

1. **Inverse simulator.** Besides forward evaluation, the engine solves for the terms that would make a blocked strategy fit.
2. **Separate land prices.** Immediate sale (null — no current valuation), historical reference, and developer scenario (₪6,900, unconfirmed) are distinct values.
3. **2.25 is a simulation unit**, kept separate from the official table (~2.4 units per 167 m²).
4. **Contingency vs overrun** use `max()`, never sum.
5. **Retained apartments earn net rent (or rent saved)** in the wealth comparison, so selling and keeping compare fairly. S08 differs only in that rent counts toward repayment capacity; when its build-and-hold twin is eligible the duplicate is hidden from ranking.
6. **Combination capital-gains tax is paid by the owner** at signing (conservative; flagged as negotiable).
7. **Developer purchases are assumed post-approval** (seller pays the levy). Open-market sales now are pre-approval (levy priced in for the buyer).
8. **Unknown inputs never become zero silently**: unknown capital → “חסר מידע”, unknown repayment → conditional. Reverse targets treat unknowns as zero and say so.
9. **Whole-unit targets are conditional** on the legal allocation, and any mortgage on lender confirmation — so “מתאים לפי האומדן” is rare by design.
10. **No Web Worker** — analysis is fast enough.
11. **CSP only in production builds** — Vite dev needs inline scripts and a websocket.
12. **Finding:** under the base assumptions, ₪6,900/m² for surplus rights is below what the land yields in a 35% combination, so hybrid “sell surplus + build” strategies rank below combination unless the developer pays substantially more (the app computes the minimum price per user).
