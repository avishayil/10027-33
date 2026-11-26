/**
 * Converts a candidate strategy (a list of transaction legs) into dated cash events,
 * a tax/cost ledger and the resulting asset position.
 *
 * Levy ledger rule: every apartment-equivalent of the owner's original rights has its
 * betterment levy assigned to exactly one payer (owner, developer or a buyer), once.
 */
import {
  completionMonth as completionMonthOf,
  constructionInstallments,
  constructionServiceValuePerApartment,
  permitMonth as permitMonthOf,
} from './construction';
import { capitalGainsReserve, levyPerRight, netMonthlyRentPerApartment } from './taxation';
import type {
  CashEvent,
  Candidate,
  CommercialTerms,
  LedgerEntry,
  ProjectConfig,
  RightsInfo,
  TransactionPlan,
  UserProfile,
} from './types';
import { apartmentValueAt, apartmentValueToday, developerRightsPrice, immediateRightsPrice } from './valuation';

export interface PlanContext {
  info: RightsInfo;
  profile: UserProfile;
  terms: CommercialTerms;
  config: ProjectConfig;
}

export function buildTransactionPlan(candidate: Candidate, ctx: PlanContext): TransactionPlan {
  const { info, profile, terms, config } = ctx;
  const events: CashEvent[] = [];
  const ledger: LedgerEntry[] = [];
  const cgRange = { low: 0, high: 0 };

  const completion = completionMonthOf(config);
  const permit = permitMonthOf(config);
  const horizon = config.analysis.horizonYears * 12;
  const devPayMonth = Math.round(config.commercial.developerPaymentYear * 12);
  const levyUnit = levyPerRight(info, config);
  const costRate = config.taxation.saleTransactionCostRate;
  const aptToday = apartmentValueToday(config);
  const aptAtCompletion = apartmentValueAt(config, completion);

  let rightsSold = 0;
  let rightsPurchased = 0;
  let rightsInCombination = 0;
  let rightsInRevenueShare = 0;
  let rightsBuilt = 0;
  let rightsHeld = 0;
  let retainedEq = 0;
  let apartmentsBuilt = 0;
  let apartmentsSold = 0;
  let constructionCost = 0;
  let rentCountsForRepayment = false;
  let heldLandValueAtHorizon = 0;
  let deferredLiabilities = 0;

  const out = (month: number, amount: number, label: string, category: LedgerEntry['category'], payer: LedgerEntry['payer'] = 'owner', extra: Partial<LedgerEntry> = {}) => {
    if (amount <= 0 && !extra.rightsPortion) return;
    ledger.push({ category, label, amount, direction: 'out', month, payer, ...extra });
    if (payer === 'owner' && !extra.deferred && amount > 0) events.push({ month, amount: -amount, label, category });
  };
  const inflow = (month: number, amount: number, label: string, category: LedgerEntry['category']) => {
    if (amount <= 0) return;
    ledger.push({ category, label, amount, direction: 'in', month, payer: 'owner' });
    events.push({ month, amount, label, category });
  };
  const addCg = (t: { used: number; low: number; high: number }) => {
    cgRange.low += t.low;
    cgRange.high += t.high;
    return t.used;
  };

  for (const leg of candidate.legs) {
    switch (leg.kind) {
      case 'sell_rights': {
        if (leg.rights <= 0) break;
        rightsSold += leg.rights;
        if (leg.market === 'open_market') {
          // Sale before planning approval: no levy has arisen yet — the buyer inherits it (priced in).
          const gross = immediateRightsPrice(leg.rights, info, config);
          inflow(0, gross, 'מכירה מיידית בשוק הפתוח', 'sale_proceeds');
          const costs = gross * costRate;
          out(0, costs, 'עלויות עסקה', 'transaction_costs', 'owner', { saleRelated: true });
          out(0, 0, 'היטל השבחה — עובר לקונה (מכירה לפני אישור)', 'betterment_levy', 'buyer', { rightsPortion: leg.rights, saleRelated: true });
          const tax = capitalGainsReserve({ consideration: gross, deductibleCosts: costs, deductibleLevy: 0, rightsPortion: leg.rights, info, profile, config });
          out(0, addCg(tax), 'מס שבח (רזרבה)', 'capital_gains_tax', 'owner', { range: { low: tax.low, high: tax.high }, saleRelated: true });
        } else {
          const gross = developerRightsPrice(leg.rights, info, config);
          inflow(devPayMonth, gross, 'תמורה ממכירת זכויות ליזם', 'sale_proceeds');
          const costs = gross * costRate;
          const levy = leg.rights * levyUnit;
          out(devPayMonth, costs, 'עלויות עסקה', 'transaction_costs', 'owner', { saleRelated: true });
          out(devPayMonth, levy, 'היטל השבחה על הזכויות שנמכרו', 'betterment_levy', 'owner', { rightsPortion: leg.rights, saleRelated: true });
          const tax = capitalGainsReserve({ consideration: gross, deductibleCosts: costs, deductibleLevy: levy, rightsPortion: leg.rights, info, profile, config });
          out(devPayMonth, addCg(tax), 'מס שבח (רזרבה)', 'capital_gains_tax', 'owner', { range: { low: tax.low, high: tax.high }, saleRelated: true });
        }
        break;
      }
      case 'combination': {
        if (leg.rights <= 0) break;
        rightsInCombination += leg.rights;
        const received = leg.rights * terms.combinationPct;
        retainedEq += received;
        // The developer pays the levy. A developer-paid levy is part of the consideration and
        // also deductible — so it is added and deducted, net zero, rather than ignored.
        const levy = leg.rights * levyUnit;
        out(permit, levy, 'היטל השבחה — משולם ע״י היזם', 'betterment_levy', 'developer', { rightsPortion: leg.rights });
        const consideration = received * constructionServiceValuePerApartment(config) + levy;
        const soldPortion = leg.rights * (1 - terms.combinationPct);
        const tax = capitalGainsReserve({ consideration, deductibleCosts: 0, deductibleLevy: levy, rightsPortion: soldPortion, info, profile, config });
        out(0, addCg(tax), 'מס שבח על שירותי הבנייה שמתקבלים (רזרבה)', 'capital_gains_tax', 'owner', { range: { low: tax.low, high: tax.high } });
        break;
      }
      case 'completion': {
        if (leg.apartmentEquivalents <= 0) break;
        retainedEq += leg.apartmentEquivalents;
        const price = leg.apartmentEquivalents * aptToday * config.commercial.completionPriceFactor;
        out(permit, price / 2, 'תשלום השלמה ליזם (50%)', 'completion_payment');
        out(completion, price / 2, 'תשלום השלמה ליזם (יתרה)', 'completion_payment');
        out(permit, price * config.taxation.landPurchaseTaxRate, 'מס רכישה על ההשלמה (רזרבה)', 'purchase_tax');
        break;
      }
      case 'buy_rights': {
        if (leg.rights <= 0) break;
        rightsPurchased += leg.rights;
        const price = developerRightsPrice(leg.rights, info, config);
        out(0, price, 'רכישת זכויות משלימות', 'rights_purchase');
        out(0, price * config.taxation.landPurchaseTaxRate, 'מס רכישה', 'purchase_tax');
        out(0, price * costRate, 'עלויות עסקה', 'transaction_costs');
        out(0, 0, 'היטל השבחה על הזכויות שנרכשו — על המוכר', 'betterment_levy', 'seller', { rightsPortion: leg.rights });
        break;
      }
      case 'build': {
        if (leg.apartments <= 0) break;
        apartmentsBuilt += leg.apartments;
        rightsBuilt += leg.ownRightsUsed + leg.purchasedRightsUsed;
        retainedEq += leg.apartments;
        for (const i of constructionInstallments(config, terms.developerMarkup, leg.apartments)) {
          constructionCost += i.amount;
          out(i.month, i.amount, `שירותי בנייה — ${i.label}`, 'construction');
        }
        out(permit, leg.ownRightsUsed * levyUnit, 'היטל השבחה על הזכויות שנבנות', 'betterment_levy', 'owner', { rightsPortion: leg.ownRightsUsed });
        break;
      }
      case 'revenue_share': {
        if (leg.rights <= 0) break;
        rightsInRevenueShare += leg.rights;
        const levy = leg.rights * levyUnit;
        out(permit, levy, 'היטל השבחה — משולם ע״י היזם', 'betterment_levy', 'developer', { rightsPortion: leg.rights });
        const share = leg.rights * aptAtCompletion * config.commercial.revenueShare;
        inflow(completion, share, 'חלקכם בהכנסות המכירה', 'revenue_share');
        const tax = capitalGainsReserve({ consideration: share + levy, deductibleCosts: 0, deductibleLevy: levy, rightsPortion: leg.rights, info, profile, config });
        out(completion, addCg(tax), 'מס שבח (רזרבה)', 'capital_gains_tax', 'owner', { range: { low: tax.low, high: tax.high }, saleRelated: true });
        break;
      }
      case 'sell_apartments': {
        if (leg.apartments <= 0) break;
        apartmentsSold += leg.apartments;
        break;
      }
      case 'hold_land': {
        if (leg.rights <= 0) break;
        rightsHeld += leg.rights;
        const value = developerRightsPrice(leg.rights, info, config);
        heldLandValueAtHorizon += value;
        const levy = leg.rights * levyUnit;
        out(horizon, levy, 'היטל השבחה — יחול במימוש', 'betterment_levy', 'owner', { rightsPortion: leg.rights, deferred: true });
        const tax = capitalGainsReserve({ consideration: value, deductibleCosts: value * costRate, deductibleLevy: levy, rightsPortion: leg.rights, info, profile, config });
        out(horizon, addCg(tax), 'מס שבח — יחול במימוש (רזרבה)', 'capital_gains_tax', 'owner', { deferred: true, range: { low: tax.low, high: tax.high } });
        deferredLiabilities += levy + tax.used + value * costRate;
        break;
      }
      case 'rent_for_repayment':
        rentCountsForRepayment = true;
        break;
    }
  }

  // Selling completed apartments happens last, once the per-apartment cost basis is known.
  if (apartmentsSold > 0 && apartmentsBuilt > 0) {
    const gross = apartmentsSold * aptAtCompletion;
    inflow(completion, gross, 'מכירת דירה במסירה', 'apartment_sale');
    const costs = gross * costRate;
    out(completion, costs, 'עלויות מכירת דירה', 'transaction_costs', 'owner', { saleRelated: true });
    const basisPerApt = constructionCost / apartmentsBuilt + levyUnit;
    const gain = Math.max(0, gross - costs - basisPerApt * apartmentsSold);
    const tax = gain * config.taxation.indicativeCapitalGainsRate;
    cgRange.low += tax;
    cgRange.high += tax;
    out(completion, tax, 'מס שבח על מכירת הדירה (רזרבה)', 'capital_gains_tax', 'owner', { saleRelated: true });
    retainedEq -= apartmentsSold;
  }

  const wholeApartmentsRetained = Math.floor(retainedEq + 1e-9);
  const collateralValue = retainedEq * aptToday + rightsHeld * info.sqmPerRight * config.market.developerRightsSaleScenario.pricePerOriginalSqm;

  return {
    events,
    ledger,
    rightsSold,
    rightsPurchased,
    rightsInCombination,
    rightsInRevenueShare,
    rightsBuilt,
    rightsHeld,
    retainedApartmentEquivalents: Math.max(0, retainedEq),
    wholeApartmentsRetained,
    apartmentsBuilt,
    completionMonth: completion,
    rentCountsForRepayment,
    heldLandValueAtHorizon,
    deferredLiabilities,
    collateralValue,
    constructionCost,
    capitalGainsRange: cgRange,
  };
}

export function monthlyNetRentFor(plan: TransactionPlan, config: ProjectConfig): number {
  return plan.retainedApartmentEquivalents * netMonthlyRentPerApartment(config);
}
