# Financial model

> **Iteration 4:** evidence-first. Price-dependent routes are not ranked (see DECISIONS #42); apartment types are priced
> from comparables; the primary comparison uses today's prices (0% growth/return); rent is cash only when rented; the
> 10-year projection is optional and itemised; the developer P&L includes public-building obligations. Sections below
> describe the mechanics; where they mention 2%/4% growth/return, that now applies only to the projection.

All values nominal ₪; rates as fractions; time in months from signing. Everything is an **estimate**.

> **Iteration 6:** funding for the owner's taxes is conditional (never assumed); per-tax contract terms behind the
> gross / mixed / net templates; explicit milestone timeline; ranking on delivery economics; lot-level developer P&L.
> See the sections at the end and DECISIONS #66–#79.

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
**Combination (iteration 3).** Consideration = market value of the construction services received — direct cost
**plus ordinary contractor profit (17.5%, 15–20%; instruction 23/98)** plus VAT, excluding the developer's
entrepreneurial profit (EA 6672/19) — plus any owner taxes the developer pays (§17(d)). Only the levy share of the
land sold, `L × (1 − c)`, is deducted. Three arrangements are always evaluated:

| Arrangement | Levy | Owner's capital-gains tax | VAT on services received | Engine |
|---|---|---|---|---|
| Gross | owner | owner | owner | all three on the owner's cash flow |
| Mixed (default) | developer | owner | owner | levy becomes consideration |
| Net | developer | developer, grossed up `T = t/(1 − 25%)` | developer | owner pays none |

Services VAT = `received × services value × 18/118`, at the permit. When the owner pays it, the capital-gains
consideration is the services value ex VAT and the developer has no barter-VAT cost (#60). The headline is the
arrangement the user says the offer includes (#63).

### Equivalent % between arrangements (`optimizer/arrangementEquivalence.ts`)
Other arrangements are evaluated at the **developer-equivalent %** — the % with the same developer P&L profit on the
household's full combination (bisection on [0, 80%]). The **owner break-even %** solves
`c·R·apartment − Σ owner-paid combination taxes × (1 + r/12)^(months to delivery)` equal, with `r` the tax-loan rate.
At 35% mixed: 25.7% / 25.0% net, 40.5% / 40.9% gross (developer / owner). Scale-free in the holding size.

### Tax loan (`domain/cashflow.ts`)
Order for a shortfall on a combination tax: cash → loan secured on another property (#49) → tax loan → unfunded.
The tax loan accrues monthly at prime + 2% (6.75%), no payments before delivery; at delivery it is repaid from cash
above the reserve and the rest becomes mortgage-stage debt on the delivered apartment (LTV and repayment checks).
Reported: `taxLoanDrawn`, `taxLoanInterest`; condition `TAX_LOAN` (#62).

The developer's purchase tax (6%) is charged on its full consideration, including taxes it pays. Statutory sale
date: plan approval under §19(3א) / position 06/26 (conditional), otherwise signing. Golden values (levy
simplified, zero basis): services ₪1,201,055.625 → owner tax ₪300,263.90625 → net gross-up ₪400,351.875.
Revenue-sharing deals: reserved at signing (assessed on expected consideration; conservative).
Completed-apartment sales deduct construction cost, levy **and the original land basis** of the right used.

`25% × max(0, consideration − costs − levy − basis share)`. Unknown basis → range: high = zero basis (used),
low = table incoming value. Combination consideration = construction services received (without markup, incl. VAT).
Sale of a completed apartment: gain over its allocated construction cost + levy.
Purchase tax 6% on complementary rights and completion purchases. Rent: 10% maintenance/vacancy + 10% tax reserve.

## Cash-flow simulation and staged financing (`domain/cashflow.ts`)
*Iteration 3:* the reserve is the largest **dated** prefix deficit (a later receipt never funds an earlier tax);
unfunded obligations are reported with date and type and are **not loans** (no interest, no amortisation) — they
remain a liability in wealth; the contingency is a liquidity reserve held from signing and released at completion
(an adverse overrun consumes it); 80% of paid-in amounts count as pre-completion collateral; snapshots are taken at
the end of the stated month (inclusive); later events extend the horizon instead of being clamped; the last
payment is clamped to principal + interest. Developer purchases are conditional on approval: payment, levy and tax
fall at approval.

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

## Apartment value tiers (S13) and balancing pool (S02P)
Entitlements are measured in value (1 = a standard 100 m² apartment at ₪25,000/m²). S13 converts the fractional
entitlement into one whole apartment of an illustrative size (80/90/110 m²): the owner pays the value gap (as a
completion payment) or receives the excess (settlement factor). At 35% and 2.25 rights the gap to 80 m² is
₪31,250 (vs ₪531,250 for 100 m²); at 40% a 90 m² apartment is covered. Rent, value and collateral scale with value.
S02P pools fractions into a balancing unit sold at completion (net of 2% costs). Neither is confirmed inventory or a
project term.

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

## Developer economics (`domain/developer.ts`) — per candidate (iteration 3)
Each candidate gets its own standalone P&L from the same ledger: apartments the developer sells (ex VAT),
completion payments, services fees − building every unit (direct + 12% soft), VAT on barter services, land paid,
revenue share, buy-backs, and every tax the ledger assigns to the developer (levy, grossed-up owner tax, its own
purchase tax). S06 at full market completion is margin-neutral vs S02; S11 earns a services fee; S02C depends on
the buy-back factor. Panel figures (residual land price, consistent cash price, max combination at 15%) are solved
from these P&Ls. A negative margin is a **model warning**, not a statement about a real developer.

## Developer economics — earlier description
Revenue = apartment sales net of VAT. Developer costs: own direct cost ₪11,000/m², 12% soft costs, VAT on
construction services delivered to the owner in a combination, the grossed-up owner tax in a net combination,
the levy where the developer pays it, land plus
6% purchase tax where it buys land. Outputs: implied combination value per original m², developer margin for
combination / land purchase / revenue share, **cash price consistent with the combination offer**, residual land
price and maximum combination % at a 15% target margin. A negative developer margin marks the strategy’s
commercial certainty as “מוטל בספק” — it never changes affordability or hides the strategy.

## Comparable outcome (names clarified in iteration 3)
* **שווי מימוש נטו** (`valueCreated`): pre-liquidation value at the common horizon — whole apartments at market
  value (no exit tax on a kept home), cash, held land — minus debt, mortgage payments (future-valued), deferred
  liabilities and unfunded obligations, minus the starting capital grown at 4%. It does not subtract today's land value.
* **מול מכירה היום** (`gainVsSellingToday`): the same minus the value of selling today at the parcel reference (S01M).
* Owner-occupied apartments: housing benefit net of a 10% maintenance reserve, no rental tax; rented (S08): also
  the 10% rental-tax reserve.

## Comparable outcome — earlier formula
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

## Iteration 6 additions

### Contract terms (`domain/arrangements.ts`)
Each owner-side tax (levy, capital gains, services VAT) has a developer share `s` and an optional cap. The developer pays
`min(s × tax, cap)` of the levy and VAT; of the capital-gains tax it pays `x = s·t₀ / (1 − s·r)` (its payment is itself
consideration; s = 1 is the full gross-up `t₀ / (1 − r)`). The owner pays the rest. Templates: gross 0/0/0, mixed 1/0/0,
net 1/1/1. Actual offer overrides: levy cap, developer bears the tax-loan interest.

### Funding (`domain/cashflow.ts`, `optimizer/analyze.ts`)
Shortfall on a combination tax: cash → loan on another property (only up to a stated limit) → tax loan (only in the
conditional funding run) → unfunded. Tax loan: prime + 2% plus VAT on interest (7.965%), capped at 50% of the
apartment entitlement, interest capitalised to delivery, then repaid from cash or refinanced on the apartment.
Reported: drawn, interest, balance at delivery, refinanced amount, saving if the developer bears the interest,
highest rate that still fits.

### Timeline (`domain/construction.ts`)
`permit = approval + lag`, `delivery = permit + construction`; payments: signing, permit, then fractions of the
construction period. Base 24 / +0 / 36. Favourable 18 / +0 / 30. Adverse 36 / +12 / 48, pool sale +12 months,
tax-loan rate + (stress − base mortgage rate).

### Delivery value (`optimizer/evaluate.ts`)
`netPosition = apartments + fraction (discounted) + owner cash in − owner cash out − interest to delivery (incl. the
capitalised tax-loan interest)`; ranking value = `netPosition − interest after delivery within the horizon`.

### Lot-level developer P&L (`domain/lotDeveloper.ts`)
Lot units U (102 / 96 / 100); services quota 25% × U; combination rights U − quota: owners c, developer 1 − c.
Revenue: developer units × apartment ex VAT (15% presales across construction, rest at delivery) + services fees
(ex VAT) on the owners' schedule. Costs: U × 100 m² × ₪11,000 × 1.12, public buildings 325 m² × ₪8,000, and the
developer-borne taxes per right of this owner's own ledger × combination rights, on their dates. Financing: equity
20% of costs first, then an escort loan at prime + 1.5% on the balance, repaid from revenue. Equivalent % = equal lot
profit; viable % = margin at the 15% target. Route margin = lot − this owner's S02 slice + the route's slice.
