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
`25% × max(0, consideration − costs − levy − basis share)`. Unknown basis → range: high = zero basis (used),
low = table incoming value. Combination consideration = construction services received (without markup, incl. VAT).
Sale of a completed apartment: gain over its allocated construction cost + levy.
Purchase tax 6% on complementary rights and completion purchases. Rent: 10% maintenance/vacancy + 10% tax reserve.

## Cash-flow simulation (`domain/cashflow.ts`)
Uses are paid from cash; shortfalls are drawn as mortgage. Sale proceeds first repay debt. Interest-only until
completion, then amortising over 25 years. Payments come from income and are carried as a future-valued outflow.
Net rent (or rent saved) arrives only after completion. Cash earns 4% net.

## Comparable outcome
`Net wealth(10y) = cash + apartments (₪25,000/m², +2%/y) + held land − debt − FV(mortgage payments) − deferred liabilities`.
`Value created = Net wealth − starting capital × 1.04^10` — the comparison metric.

## Feasibility
Fails: debt with “no mortgage”; peak personal monthly payment (after rent for S08) above the stated maximum;
debt above 75% of retained collateral. Missing: debt needed but capital unknown; immediate price unknown.
Conditions: unverified developer price/revenue share, partial purchase, completion price, complementary seller,
lender confirmation, unknown repayment, LTV above 50%, whole-unit allocation.
Status: infeasible > חסר מידע > fragile (fails adverse) > conditional > estimated feasible.

## Ranking
Pareto filter on (value created, resilience, whole apartments, liquidity, simplicity, monthly income, −debt),
then goal weights. Balanced: 40 / 30 / 15 / 10 / 5. Resilience = adverse value ÷ base value if the adverse case is
feasible, else 0. Product preferences, not empirical rules.

## Reverse optimisation
Bisection on base-scenario financial feasibility: minimum surplus-rights price, latest acceptable developer
payment month, maximum construction cost per apartment, maximum markup, maximum completion payment, required
additional capital; plus mortgage capacity `L = P(1 − (1+r)^−n)/r` and the combination % for the next whole apartment (`n / R`).

## Intentional changes from the legacy simulator
* No 18% “developer profit” deducted from the land price — a developer price already includes it.
* Capital gains on the gain only, never on gross; developer-paid levy counted in consideration.
* Units from the 2.25 assumption, not the table’s ~2.4.
