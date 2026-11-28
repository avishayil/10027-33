/**
 * Bilateral events and financing facilities of a contract (V1 Milestone B1, MH-01 / MH-05; docs/ECONOMIC-CONTRACT.md).
 *
 * The household's ledger records each amount once, with the party that pays it and the direction from the owner's
 * side. Here every amount becomes a transfer between two parties — source → destination — with the party legally
 * liable kept apart from the contractual payer (a levy the developer pays under a net deal is still the owner's
 * liability). Facilities become their own events (draws, interest, repayments, transfers between facilities) and a
 * record per facility that reconciles to its terminal balance. Internal reserves are not transfers and are left out,
 * and so are zero amounts.
 */
import type { Candidate, FacilityId, LedgerCategory, LedgerEntry, PriceBasis, SimulationResult, TransactionPlan } from '../domain/types';

export type PartyId =
  | 'owner'
  | 'developer'
  | 'bank'
  | 'other_property_lender'
  | 'tax_authority'
  | 'municipality'
  | 'buyer'
  | 'seller'
  | 'service_providers';

export interface BilateralEvent {
  id: string;
  kind: 'transfer' | 'loan_draw' | 'loan_interest' | 'loan_repayment' | 'loan_transfer';
  category: LedgerCategory | 'financing';
  source: PartyId;
  destination: PartyId;
  /** Who is liable by law (estimate, not a formal assessment) vs who pays under the contract. */
  liable: PartyId;
  payer: PartyId;
  month: number;
  amount: number;
  basis: PriceBasis;
  facilityId?: FacilityId;
  conditions: string[];
}

export interface FinancingFacility {
  id: FacilityId;
  borrower: 'owner';
  lender: 'bank' | 'developer' | 'other_property_lender';
  /** No facility is approved by the software: every one depends on the lender. */
  approval: 'assumed' | 'conditional';
  drawn: number;
  interest: number;
  interestCapitalised: boolean;
  repayment: number;
  transferIn: number;
  transferOut: number;
  terminal: number;
  annualRate: number | null;
  maturityMonth: number | null;
  collateral: string;
  repaymentSource: string;
}

const OUT_TO: Partial<Record<LedgerCategory, PartyId>> = {
  betterment_levy: 'municipality',
  capital_gains_tax: 'tax_authority',
  services_vat: 'tax_authority',
  purchase_tax: 'tax_authority',
  construction: 'developer',
  completion_payment: 'developer',
  rights_purchase: 'seller',
  transaction_costs: 'service_providers',
};
const INTERNAL = new Set<LedgerCategory>(['contingency_reserve', 'contingency_release']);
const LENDER: Record<FacilityId, FinancingFacility['lender']> = { mortgage: 'bank', secured: 'other_property_lender', tax_loan: 'developer' };

/** Who pays an amount the owner receives, from the category and the route's legs. */
function sourceOf(e: LedgerEntry, plan: TransactionPlan, route: Candidate): PartyId {
  switch (e.category) {
    case 'apartment_sale':
      return 'buyer';
    case 'revenue_share':
      return 'developer';
    case 'fraction_settlement':
      return plan.fractionSettled?.mode === 'cash' ? 'developer' : 'buyer';
    case 'sale_proceeds': {
      const sale = route.legs.find((l) => l.kind === 'sell_rights');
      return sale && sale.kind === 'sell_rights' && sale.market === 'developer' ? 'developer' : 'buyer';
    }
    default:
      return 'developer';
  }
}

const party = (p: LedgerEntry['payer']): PartyId => p;

/** The ledger's transfers as bilateral events (reserves excluded). */
export function ledgerEvents(plan: TransactionPlan, route: Candidate): BilateralEvent[] {
  const out: BilateralEvent[] = [];
  plan.ledger.forEach((e, i) => {
    if (INTERNAL.has(e.category) || !(e.amount > 1e-9)) return;
    const conditions = [...(e.deferred ? ['NOT_PAID_IN_HORIZON'] : []), ...(e.taxLoanEligible ? ['TAX_LOAN_ELIGIBLE'] : [])];
    if (e.direction === 'in') {
      const source = sourceOf(e, plan, route);
      out.push({ id: `L${i}`, kind: 'transfer', category: e.category, source, destination: 'owner', liable: source, payer: source, month: e.month, amount: e.amount, basis: e.priceBasis, conditions });
      return;
    }
    const payer = party(e.payer);
    const destination = OUT_TO[e.category] ?? 'developer';
    // Levy and capital-gains tax are the landowner's liability whoever pays them under the contract.
    const liable: PartyId = e.category === 'betterment_levy' || e.category === 'capital_gains_tax' ? 'owner' : payer;
    out.push({ id: `L${i}`, kind: 'transfer', category: e.category, source: payer, destination, liable, payer, month: e.month, amount: e.amount, basis: e.priceBasis, conditions });
  });
  return out;
}

/** Facility draws, interest, repayments and transfers as events (nominal shekels). */
export function facilityEvents(sim: SimulationResult): BilateralEvent[] {
  const out: BilateralEvent[] = [];
  sim.facilityFlows.forEach((f, i) => {
    const lender: PartyId = LENDER[f.facility];
    const at = { id: `F${i}`, category: 'financing' as const, month: f.month, amount: f.amount, basis: 'nominal' as const, facilityId: f.facility };
    const owner: PartyId = 'owner';
    if (f.kind === 'draw') out.push({ ...at, kind: 'loan_draw', source: lender, destination: owner, liable: lender, payer: lender, conditions: ['LENDER_APPROVAL'] });
    else if (f.kind === 'interest')
      out.push({
        ...at,
        kind: 'loan_interest',
        source: owner,
        destination: lender,
        liable: owner,
        payer: owner,
        conditions: sim.facilityAccounts[f.facility].interestCapitalised ? ['CAPITALISED', 'LENDER_APPROVAL'] : ['LENDER_APPROVAL'],
      });
    else if (f.kind === 'repayment') out.push({ ...at, kind: 'loan_repayment', source: owner, destination: lender, liable: owner, payer: owner, conditions: ['LENDER_APPROVAL'] });
    // The bank pays off the tax loan by refinancing it into the mortgage: a transfer between lenders (the matching
    // transfer_in is the same money and is not a second event).
    else if (f.kind === 'transfer_out') out.push({ ...at, kind: 'loan_transfer', source: 'bank', destination: lender, liable: owner, payer: 'bank', conditions: ['REFINANCE_APPROVAL'] });
  });
  return out;
}

/** The facilities a snapshot uses, each reconciled (drawn + in (+ capitalised interest) − repaid − out = terminal). */
export function facilitiesOf(sim: SimulationResult, plan: TransactionPlan): FinancingFacility[] {
  const rate = (t: string) => sim.facilities.find((f) => f.type === t)?.annualRate ?? null;
  const meta: Record<FacilityId, Pick<FinancingFacility, 'annualRate' | 'maturityMonth' | 'collateral' | 'repaymentSource'>> = {
    mortgage: { annualRate: rate('project_loan') ?? rate('tax_loan_refinance'), maturityMonth: null, collateral: 'הקרקע לפני המסירה, הדירה אחריה', repaymentSource: 'החזר חודשי (ושכירות אם מוכרת)' },
    secured: { annualRate: rate('secured_other_property'), maturityMonth: null, collateral: 'הנכס האחר', repaymentSource: 'החזר חודשי' },
    tax_loan: { annualRate: rate('tax_loan'), maturityMonth: plan.completionMonth, collateral: 'זכויות הדירה (אצל היזם)', repaymentSource: 'כסף במסירה, ואם אין — מיחזור מותנה למשכנתא' },
  };
  return (Object.keys(sim.facilityAccounts) as FacilityId[])
    .filter((id) => sim.facilityAccounts[id].drawn + sim.facilityAccounts[id].transferIn > 0.5)
    .map((id) => ({ id, borrower: 'owner', lender: LENDER[id], approval: 'conditional', ...sim.facilityAccounts[id], ...meta[id] }));
}
