# Financial model

All values nominal ₪; rates as fractions; time in months from signing. Everything is an **estimate**.

## Rights
`R = A / 167 × 2.25`. One apartment-equivalent = 74.2 original m². The official allocation table
(`parcel33.js`, lot 149/150/153) is computed separately and used only for the betterment-levy proxy.

## Construction services
Quote per apartment `= 100 m² × ₪11,000 × (1 + markup) × 1.18` (₪1,492,700 / ₪1,525,150 / ₪1,557,600 at 15 / 17.5 / 20%).
Paid by milestone (10% signing, 15% permit at 40% of the period, 20/20/20%, 15% at completion), each installment
indexed at `(1 + 3%)^(t)` and uplifted by `max(contingency 10%, realised overrun)` — reserve and overrun never stack.

## Betterment levy (proxy)
`50% × (allocation value − incoming value)` from the table → ₪256,940 per 167 m² (lot 149).
Allocated per apartment-equivalent and assigned to exactly one payer:
* sold to developer → owner pays at sale; sold on open market before approval → buyer (priced in, ₪0 to owner);
* combination / revenue share → developer (added to taxable consideration and deducted — net zero, not ignored);
* built → owner at permit; held land → deferred liability at the horizon;
* purchased complementary rights → the seller.

## Capital-gains reserve
Revenue-sharing deals: reserved at signing (assessed on expected consideration; conservative).
Completed-apartment sales deduct construction cost, levy **and the original land basis** of the right used.

`25% × max(0, consideration − costs − levy − basis share)`. Unknown basis → range: high = zero basis (used),
low = table incoming value. Combination consideration = construction services received (without markup, incl. VAT).
Sale of a completed apartment: gain over its allocated construction cost + levy.
Purchase tax 6% on complementary rights and completion purchases. Rent: 10% maintenance/vacancy + 10% tax reserve.

## Cash-flow simulation and staged financing (`domain/cashflow.ts`)
* Sources go to cash. Each month, **non-financeable** obligations (capital-gains tax, purchase tax, betterment
  levy, transaction costs) are paid first from cash. A shortfall there is an **unfunded obligation** — a strategy
  with any unfunded amount is infeasible (or “חסר מידע” if capital is unknown). Lenders do not finance taxes.
* Cash above a reserve (future non-financeable uses not covered by future sources) pays financeable uses; the
  rest is borrowed by stage: **bridge** (before the permit, conditional), **construction financing** (permit →
  completion, staged, conditional), **completed-property mortgage** (from completion).
* Surplus cash above the reserve repays debt. Interest-only until completion, then amortising over 25 years.
* Collateral is stage-specific: before completion, the land the owner still holds (built share, the share
  retained in a combination, purchased rights) at the developer price **plus amounts already paid into the
  asset**; from completion, whole retained apartments. Sold rights are never collateral. LTV > 75% fails,
  > 50% is a financing condition.
* Snapshots “at completion” are taken after the completion month’s transactions.

## Fractional entitlements
Only whole apartments are rentable. An unresolved fractional share (e.g. 0.7875 from a 35% combination) earns no
rent and is valued at a 20% illiquidity discount. Settlement mechanisms are separate strategies: cash settlement
by the developer at 80% of market value (S02C), paid completion to a whole apartment (S06), or a mixed structure
that targets whole apartments exactly (S11).

## S11 — combination plus construction services
To end with N whole apartments from R rights at combination rate c, keep `R_build = (N − cR)/(1 − c)` rights for
construction services and put the rest into combination. For 2.25 rights at 35%, N = 1: 0.326923 built,
1.923077 in combination (→ 0.673077), proportional construction quote ₪498,607 before contingency and
indexation. The owner pays the levy on the built share; the developer on the combination share.

## Developer policy for construction services (`domain/policy.ts`)
A lot has about 100 units (149: 102, 150: 96, 153: 100). Full combination is the developer’s most profitable
structure, so it is expected to release only **20–30% (default 25%) of the lot’s units for construction services**
and to ration them so every owner can reach one apartment:
* **R × c ≥ 1** (≈ 2.86 rights at 35%, i.e. about 3 rights): full combination already yields a whole apartment →
  no construction services offered.
* Otherwise at most **one apartment per owner** in construction services (an S11 partial apartment uses one slot).
Strategies outside the policy are kept in the comparison as “לא צפוי שיוצע” but never ranked or recommended.
Lot capacity (≈ 25 slots in lot 149) is compared with an estimate of demand (lot’s parcel area ÷ 167 m² ≈ 42
owners if holdings are typical); allowed construction-services strategies carry a “slots are limited” condition.

Examples (35% / 17.5%):

| Rights | Construction services | Typical outcome |
| --- | --- | --- |
| 4 | none offered | full combination; with means, paid completion to a 2nd apartment |
| 3 | none offered | full combination (1.05 → one whole apartment) if the household can fund the combination tax |
| 1–2.86 | one apartment | depends on finances and goal: sale, combination (+completion), S11, or one apartment in services |

## Developer economics (`domain/developer.ts`)
Revenue = apartment sales net of VAT. Developer costs: own direct cost ₪11,000/m², 12% soft costs, VAT on
construction services delivered to the owner in a combination, the levy where the developer pays it, land plus
6% purchase tax where it buys land. Outputs: implied combination value per original m², developer margin for
combination / land purchase / revenue share, **cash price consistent with the combination offer**, residual land
price and maximum combination % at a 15% target margin. A negative developer margin marks the strategy’s
commercial certainty as “מוטל בספק” — it never changes affordability or hides the strategy.

## Comparable outcome
`Net wealth(10y) = cash + whole apartments (₪25,000/m², +2%/y) + fractional share × (1 − 20%) − debt − FV(mortgage payments)`.
`Value created = Net wealth − starting capital × 1.04^10`.

## Three assessments
* **Affordability** — fits / fits with financing / does not fit / unknown (unfunded obligations, repayment, LTV).
* **Resilience** — robust / fragile (fails the adverse scenario).
* **Commercial certainty** — not developer-dependent / unverified / questionable (negative developer margin).
The legacy single status is still derived for ranking: financing conditions make it “conditional”; commercial
dependencies no longer do.

## Ranking
Pareto filter, then goal weights on **fixed reference scales** (entitlement value R × apartment value, land value,
ceil(R) apartments, their net rent), so a candidate’s score never depends on which other candidates exist.
Explicit constraints: minimise-risk prefers debt-free, immediate-cash prefers positive near-term cash,
passive-income prefers positive income — whenever such an eligible strategy exists.

## Reverse optimisation
Three different questions for the price of surplus rights, reported separately:
* **מחיר מינימלי למימון** — lowest price at which the hybrid is affordable (base scenario).
* **מחיר איזון כלכלי** — price at which the hybrid creates as much value as the best combination-family strategy.
* **מחיר מומלץ** — price at which it is still at least as good under the adverse scenario (with the negotiated
  price itself fixed) and affordable.
Also: the open-market price today at which selling now matches the best alternative. Other bisections on base-scenario financial feasibility: minimum surplus-rights price, latest acceptable developer
payment month, maximum construction cost per apartment, maximum markup, maximum completion payment, required
additional capital; plus mortgage capacity `L = P(1 − (1+r)^−n)/r` and the combination % for the next whole apartment (`n / R`).

## Waiting (S09) and selling now (S01M)
Waiting sells on the open market two years from now at a post-approval land value (₪7,100/m² block reference;
−25% / +10% in the scenarios), independent of developer offers. Selling now uses the parcel’s own transactions
(₪1,916 base, ₪1,647 adverse, ₪2,739 favourable = table value net of levy); before approval the levy stays with
the buyer.

## Intentional changes from the legacy simulator
* No 18% “developer profit” deducted from the land price — a developer price already includes it.
* Capital gains on the gain only, never on gross; developer-paid levy counted in consideration.
* Units from the 2.25 assumption, not the table’s ~2.4.
