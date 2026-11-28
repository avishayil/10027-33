# Professional review — V1.0 (Milestone D)

The software cannot certify itself. Until the three reviews below are signed, the app, the printed report and the
docs state **"not professionally validated"**, and no output is a recommendation to rely on commercially. Lender terms
always require an actual approval. Each packet lists representative fixtures with independently calculated expected
numbers, the assumptions behind them, and explicit questions.

| Packet | Reviewer | Scope | Status | Signed (name / date / version reviewed) |
|---|---|---|---|---|
| [appraiser.md](appraiser.md) | Real-estate appraiser (שמאי מקרקעין) | entitlement and allocation share, levy proxy, apartment and land values, construction cost basis and area definitions, developer budget | **open** | — |
| [tax-adviser.md](tax-adviser.md) | Tax adviser (יועץ מס / רו״ח) | capital-gains reserve, sale date, VAT on construction services, purchase tax, who is liable vs who pays, tax-loan treatment | **open** | — |
| [lawyer.md](lawyer.md) | Real-estate lawyer (עו״ד מקרקעין) | contract terms, guarantees, approval and cancellation, pools and fractions, options, group agreements | **open** | — |

Version under review: the data version and kernel version printed on every report (`CONFIG_VERSION`,
`KERNEL_VERSION`), the pack `hadera-c13-10027-33`.

## Source refresh (2026-11-28)

| Source | Used for | Result |
|---|---|---|
| Real-estate appraisers' association, construction cost survey, June 2026 ([page](https://landvalue.org.il/index2.php?id=20313), PDF linked there) | direct construction cost (Sharon: high-rise, underground ₪3,400, balconies 30–50%) | re-read 2026-11-28: underground ₪3,400, balconies 30–50%, excl. VAT, ±10%, per licensed m², direct costs only — match the model. The Sharon above-ground figures are ₪6,200 / ₪6,300 / ₪6,600 for the three building types; the text extraction does not preserve the column order, the model's ₪6,600 = high-rise follows the regional pattern — **appraiser to confirm visually** |
| Bank of Israel, Proper Conduct of Banking Business Directive 329 ([page](https://www.boi.org.il/roles/supervisionregulation/nbt/nbt329/)) | LTV limits 75% / 70% / 50% | **not re-verified**: the site blocks automated access (bot check). Last verified in iteration 6 — a human check is required |
| VAT rate 18% | services VAT | reported by secondary sources for 2026 (2026-11-28); official Tax Authority confirmation by the tax adviser |
| Rothstein periodic report 2024 ([TASE](https://mayafiles.tase.co.il/rpdf/1653001-1654000/P1653109-00.pdf)) | tax-loan example (prime + 2% + VAT on interest) | reachable (275 pages); the page locator of the clause to be confirmed |
| Allocation tables 106(ב), 23.11.2026; allocation appraisal | lots, shares, values | local documents (not in git — personal data); unchanged since iteration 8 |

## Open data questions (disclosed, unresolved)

1. Saleable (door-to-door) area 11,209 m² (lot 149) vs the statutory/service areas the survey prices — same definition?
2. Whether the 325 m² public buildings overlap the plan's above-ground area.
3. Whether a developer can reclaim input VAT on public buildings handed to the municipality.
4. Indirect costs (12% soft cost), development levies, permit fees, infrastructure connections — not certified (no דוח אפס).
5. Actual apartment inventory and unit types per lot — unknown.
6. Any current developer offer or professionally approved benchmark — none; commercial outputs are modelled only.
