/**
 * Converts a candidate strategy (a list of transaction legs) into dated cash events, a two-sided tax/cost
 * ledger (owner and developer entries) and the resulting asset position.
 *
 * Levy ledger rule: every apartment-equivalent of the owner's original rights has its betterment levy assigned
 * to exactly one payer (owner, developer or a buyer), once.
 *
 * Timeline (months from signing): signing 0 · plan approval (= statutory sale date under §19(3א) when it
 * applies) · permit · completion. A developer's purchase of rights is conditional on approval: payment, levy
 * and capital-gains tax fall at approval or later — never before.
 */
import {
  completionMonth as completionMonthOf,
  constructionSchedule,
  constructionServiceTaxValuePerApartment,
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

export function approvalMonthOf(config: ProjectConfig): number {
  return Math.round(config.commercial.approvalYears * 12);
}

export function buildTransactionPlan(candidate: Candidate, ctx: PlanContext): TransactionPlan {
  const { info, profile, terms, config } = ctx;
  const events: CashEvent[] = [];
  const ledger: LedgerEntry[] = [];
  const cgRange = { low: 0, high: 0 };

  const completion = completionMonthOf(config);
  const permit = permitMonthOf(config);
  const approval = approvalMonthOf(config);
  const horizon = config.analysis.horizonYears * 12;
  const devPayMonth = Math.max(Math.round(config.commercial.developerPaymentYear * 12), approval);
  const combinationSaleMonth = config.commercial.combinationSaleDate === 'approval' ? approval : 0;
  const arrangement = config.commercial.taxArrangement;
  const cgRate = config.taxation.indicativeCapitalGainsRate;
  const buyerPurchaseTax = config.taxation.landPurchaseTaxRate;
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
  let retainedLandRights = 0;
  let settleFraction: 'cash' | 'pool' | null = null;
  let fractionSettled: TransactionPlan['fractionSettled'] = null;
  let tierSize: number | null = null;
  let heldLandValueAtHorizon = 0;
  let deferredLiabilities = 0;

  const out = (
    month: number,
    amount: number,
    label: string,
    category: LedgerEntry['category'],
    payer: LedgerEntry['payer'] = 'owner',
    extra: Partial<LedgerEntry> = {},
  ) => {
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
  const levyPayer: LedgerEntry['payer'] = arrangement === 'gross' ? 'owner' : 'developer';

  for (const leg of candidate.legs) {
    switch (leg.kind) {
      case 'sell_rights': {
        if (leg.rights <= 0) break;
        rightsSold += leg.rights;
        if (leg.market === 'post_approval') {
          // Wait for approval, then sell on the open market (independent of developer offers).
          const gross = leg.rights * info.sqmPerRight * config.market.postApprovalLandValuePerSqm;
          inflow(approval, gross, 'מכירה בשוק אחרי אישור התכנית', 'sale_proceeds');
          const costs = gross * costRate;
          const levy = leg.rights * levyUnit;
          out(approval, costs, 'עלויות עסקה', 'transaction_costs', 'owner', { saleRelated: true });
          out(approval, levy, 'היטל השבחה (מכירה אחרי אישור)', 'betterment_levy', 'owner', { rightsPortion: leg.rights, saleRelated: true });
          const tax = capitalGainsReserve({ consideration: gross, deductibleCosts: costs, deductibleLevy: levy, rightsPortion: leg.rights, info, profile, config });
          out(approval, addCg(tax), 'מס שבח (רזרבה)', 'capital_gains_tax', 'owner', { range: { low: tax.low, high: tax.high }, saleRelated: true });
        } else if (leg.market === 'open_market') {
          // Sale before planning approval: no levy has arisen yet — the buyer inherits it (priced in).
          const gross = immediateRightsPrice(leg.rights, info, config);
          inflow(0, gross, 'מכירה מיידית בשוק הפתוח', 'sale_proceeds');
          const costs = gross * costRate;
          out(0, costs, 'עלויות עסקה', 'transaction_costs', 'owner', { saleRelated: true });
          out(0, 0, 'היטל השבחה — עובר לקונה (מכירה לפני אישור)', 'betterment_levy', 'buyer', { rightsPortion: leg.rights, saleRelated: true });
          const tax = capitalGainsReserve({ consideration: gross, deductibleCosts: costs, deductibleLevy: 0, rightsPortion: leg.rights, info, profile, config });
          out(0, addCg(tax), 'מס שבח (רזרבה)', 'capital_gains_tax', 'owner', { range: { low: tax.low, high: tax.high }, saleRelated: true });
        } else {
          // Sale to a developer, conditional on plan approval: payment, levy and tax at approval or later.
          const gross = developerRightsPrice(leg.rights, info, config);
          inflow(devPayMonth, gross, 'תמורה ממכירת זכויות ליזם (אחרי אישור התכנית)', 'sale_proceeds');
          const costs = gross * costRate;
          const levy = leg.rights * levyUnit;
          out(devPayMonth, costs, 'עלויות עסקה', 'transaction_costs', 'owner', { saleRelated: true });
          out(devPayMonth, levy, 'היטל השבחה על הזכויות שנמכרו', 'betterment_levy', 'owner', { rightsPortion: leg.rights, saleRelated: true });
          const tax = capitalGainsReserve({ consideration: gross, deductibleCosts: costs, deductibleLevy: levy, rightsPortion: leg.rights, info, profile, config });
          out(devPayMonth, addCg(tax), 'מס שבח (רזרבה)', 'capital_gains_tax', 'owner', { range: { low: tax.low, high: tax.high }, saleRelated: true });
          out(devPayMonth, gross * buyerPurchaseTax, 'מס רכישה על הקרקע — על היזם', 'purchase_tax', 'developer');
        }
        break;
      }
      case 'combination': {
        if (leg.rights <= 0) break;
        rightsInCombination += leg.rights;
        const received = leg.rights * terms.combinationPct;
        retainedEq += received;
        // The owner sells (1 − c) of the land and keeps c of it until the apartments are delivered.
        retainedLandRights += leg.rights * terms.combinationPct;
        // Consideration = market value of construction services received (incl. ordinary contractor profit and
        // VAT) + any owner taxes the developer pays (§17(d)). Only the levy share attributable to the land sold
        // is deducted (proportional allocation — to be confirmed professionally).
        const services = received * constructionServiceTaxValuePerApartment(config);
        const levy = leg.rights * levyUnit;
        out(permit, levy, levyPayer === 'owner' ? 'היטל השבחה — עליכם (עסקת ברוטו)' : 'היטל השבחה — משולם ע״י היזם', 'betterment_levy', levyPayer, {
          rightsPortion: leg.rights,
        });
        const developerPaidLevy = levyPayer === 'developer' ? levy : 0;
        const soldPortion = leg.rights * (1 - terms.combinationPct);
        const tax = capitalGainsReserve({
          consideration: services + developerPaidLevy,
          deductibleCosts: 0,
          deductibleLevy: levy * (1 - terms.combinationPct),
          rightsPortion: soldPortion,
          info,
          profile,
          config,
        });
        let developerPaidTax = 0;
        if (arrangement === 'net') {
          // Net deal: the developer pays the owner's tax; that payment is itself consideration → gross-up.
          const g = 1 / (1 - cgRate);
          developerPaidTax = tax.used * g;
          out(combinationSaleMonth, developerPaidTax, 'מס שבח — משולם ע״י היזם (עסקת נטו, כולל גילום)', 'capital_gains_tax', 'developer', {
            range: { low: tax.low * g, high: tax.high * g },
          });
        } else {
          out(combinationSaleMonth, addCg(tax), 'מס שבח על שירותי הבנייה שמתקבלים (רזרבה)', 'capital_gains_tax', 'owner', {
            range: { low: tax.low, high: tax.high },
          });
        }
        // The developer's acquisition tax on the land it receives, on the full consideration including taxes it pays.
        out(combinationSaleMonth, (services + developerPaidLevy + developerPaidTax) * buyerPurchaseTax, 'מס רכישה על הקרקע — על היזם', 'purchase_tax', 'developer');
        break;
      }
      case 'completion': {
        if (leg.apartmentEquivalents <= 0) break;
        retainedEq += leg.apartmentEquivalents;
        const price = leg.apartmentEquivalents * aptToday * config.commercial.completionPriceFactor;
        out(permit, price / 2, 'תשלום השלמה ליזם (50%)', 'completion_payment');
        out(completion, price / 2, 'תשלום השלמה ליזם (יתרה)', 'completion_payment');
        // Classification depends on the contract; the rate depends on whether it will be the only home.
        const pt = config.taxation.completionPurchaseTax;
        const rate = profile.soleHome === true ? pt.soleHome : pt.additionalHome;
        out(permit, price * rate, 'מס רכישה על ההשלמה (לפי סיווג ומצב דירות)', 'purchase_tax', 'owner', {
          range: { low: price * pt.soleHome, high: price * pt.additionalHome },
        });
        break;
      }
      case 'buy_rights': {
        if (leg.rights <= 0) break;
        rightsPurchased += leg.rights;
        // Bought from other owners at the open-market reference — not at the developer's buying price.
        const price = leg.rights * info.sqmPerRight * config.market.postApprovalLandValuePerSqm;
        out(0, price, 'רכישת זכויות משלימות (מבעלים אחרים)', 'rights_purchase');
        out(0, price * buyerPurchaseTax, 'מס רכישה', 'purchase_tax');
        out(0, price * costRate, 'עלויות עסקה', 'transaction_costs');
        out(0, 0, 'היטל השבחה על הזכויות שנרכשו — על המוכר', 'betterment_levy', 'seller', { rightsPortion: leg.rights });
        break;
      }
      case 'build': {
        if (leg.apartments <= 0) break;
        apartmentsBuilt += leg.apartments;
        rightsBuilt += leg.ownRightsUsed + leg.purchasedRightsUsed;
        retainedLandRights += leg.ownRightsUsed + leg.purchasedRightsUsed;
        retainedEq += leg.apartments;
        const sched = constructionSchedule(config, terms.developerMarkup, leg.apartments);
        constructionCost += sched.actualSpend;
        if (sched.reserveHeld > 0) out(0, sched.reserveHeld, 'רזרבה לבלתי צפוי (נזילות, לא הוצאה)', 'contingency_reserve');
        for (const i of sched.installments) out(i.month, i.amount, `שירותי בנייה — ${i.label}`, 'construction');
        if (sched.reserveReleased > 0) inflow(completion, sched.reserveReleased, 'שחרור הרזרבה שלא נוצלה', 'contingency_release');
        out(permit, leg.ownRightsUsed * levyUnit, 'היטל השבחה על הזכויות שנבנות', 'betterment_levy', 'owner', { rightsPortion: leg.ownRightsUsed });
        break;
      }
      case 'revenue_share': {
        if (leg.rights <= 0) break;
        rightsInRevenueShare += leg.rights;
        const levy = leg.rights * levyUnit;
        out(permit, levy, levyPayer === 'owner' ? 'היטל השבחה — עליכם' : 'היטל השבחה — משולם ע״י היזם', 'betterment_levy', levyPayer, { rightsPortion: leg.rights });
        const share = leg.rights * aptAtCompletion * config.commercial.revenueShare;
        inflow(completion, share, 'חלקכם בהכנסות המכירה', 'revenue_share');
        const devLevy = levyPayer === 'developer' ? levy : 0;
        const tax = capitalGainsReserve({ consideration: share + devLevy, deductibleCosts: 0, deductibleLevy: levy, rightsPortion: leg.rights, info, profile, config });
        // Cash consideration: §19(3א) deferral does not apply — assessed at signing (conservative).
        const taxMonth = config.taxation.revenueShareTaxAtSigning ? 0 : completion;
        out(taxMonth, addCg(tax), 'מס שבח על התמורה הצפויה (רזרבה)', 'capital_gains_tax', 'owner', { range: { low: tax.low, high: tax.high }, saleRelated: true });
        out(0, (share + devLevy) * buyerPurchaseTax, 'מס רכישה על הקרקע — על היזם', 'purchase_tax', 'developer');
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
      case 'settle_fraction_cash':
        settleFraction = 'cash';
        break;
      case 'balancing_pool':
        settleFraction = 'pool';
        break;
      case 'tier_apartment':
        tierSize = leg.sizeSqm;
        break;
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
    // Asset-level basis: actual construction spend + levy + the original land basis of the right used.
    const constructionBasis = (constructionCost / apartmentsBuilt) * apartmentsSold;
    const tax = capitalGainsReserve({
      consideration: gross,
      deductibleCosts: costs + constructionBasis,
      deductibleLevy: levyUnit * apartmentsSold,
      rightsPortion: apartmentsSold,
      info,
      profile,
      config,
    });
    out(completion, addCg(tax), 'מס שבח על מכירת הדירה (רזרבה)', 'capital_gains_tax', 'owner', { saleRelated: true, range: { low: tax.low, high: tax.high } });
    retainedEq -= apartmentsSold;
    // The apartment stays owned (and is collateral) until it is sold at completion.
    retainedLandRights = Math.max(0, retainedLandRights - apartmentsSold);
  }

  let wholeApartmentsRetained = Math.floor(retainedEq + 1e-6);
  let fractionalShare = Math.max(0, retainedEq - wholeApartmentsRetained);
  if (fractionalShare < 1e-6) fractionalShare = 0;
  const standardSize = config.construction.apartmentSizeSqm;
  const apartmentSizes: number[] = new Array(wholeApartmentsRetained).fill(standardSize);

  if (tierSize !== null && fractionalShare > 0) {
    // Value-based allocation: the fraction becomes one whole apartment of `tierSize`. Value units: 1 = a standard
    // apartment. Not a guarantee that such an apartment exists or can be legally assigned.
    const tierEq = tierSize / standardSize;
    const gap = tierEq - fractionalShare;
    if (gap > 1e-9) {
      const price = gap * aptToday * config.commercial.completionPriceFactor;
      out(permit, price / 2, `תשלום השלמה לדירת ${tierSize} מ״ר (50%)`, 'completion_payment');
      out(completion, price / 2, `תשלום השלמה לדירת ${tierSize} מ״ר (יתרה)`, 'completion_payment');
      const pt = config.taxation.completionPurchaseTax;
      const rate = profile.soleHome === true ? pt.soleHome : pt.additionalHome;
      out(permit, price * rate, 'מס רכישה על ההשלמה (לפי סיווג ומצב דירות)', 'purchase_tax', 'owner', {
        range: { low: price * pt.soleHome, high: price * pt.additionalHome },
      });
    } else if (gap < -1e-9) {
      const amount = -gap * aptAtCompletion * config.commercial.fractionCashSettlementFactor;
      inflow(completion, amount, 'איזון כספי על ההפרש לדירה הקטנה', 'fraction_settlement');
      const tax = amount * config.taxation.indicativeCapitalGainsRate;
      cgRange.low += tax;
      cgRange.high += tax;
      out(completion, tax, 'מס שבח על האיזון (רזרבה)', 'capital_gains_tax', 'owner', { saleRelated: true });
      fractionSettled = { mode: 'cash', share: -gap };
    }
    retainedEq = wholeApartmentsRetained + tierEq;
    apartmentSizes.push(tierSize);
    wholeApartmentsRetained += 1;
    fractionalShare = 0;
  }

  if (settleFraction && fractionalShare > 0) {
    // Cash: the developer buys the fraction back at a negotiated discount. Pool (יחידת סל): fractions of several
    // owners are pooled into balancing units sold on the market; proceeds after costs are distributed.
    const factor = settleFraction === 'cash' ? config.commercial.fractionCashSettlementFactor : 1 - costRate;
    const amount = fractionalShare * aptAtCompletion * factor;
    inflow(completion, amount, settleFraction === 'cash' ? 'פיצוי כספי על חלק הדירה' : 'חלקכם ממכירת יחידת הסל', 'fraction_settlement');
    // Extra land-sale consideration: the land share was already allocated — no further basis (conservative).
    const tax = amount * config.taxation.indicativeCapitalGainsRate;
    cgRange.low += tax;
    cgRange.high += tax;
    out(completion, tax, 'מס שבח על הפיצוי (רזרבה)', 'capital_gains_tax', 'owner', { saleRelated: true });
    retainedEq -= fractionalShare;
    fractionSettled = { mode: settleFraction, share: fractionalShare };
    fractionalShare = 0;
    wholeApartmentsRetained = Math.floor(retainedEq + 1e-6);
    apartmentSizes.length = wholeApartmentsRetained;
  }
  const wholeApartmentValueEq = apartmentSizes.reduce((s, x) => s + x / standardSize, 0);

  const landPrice = info.sqmPerRight * config.market.developerRightsSaleScenario.pricePerOriginalSqm;
  const preCompletionLandCollateral = retainedLandRights * landPrice;
  const postCompletionCollateral = wholeApartmentValueEq * aptToday + rightsHeld * landPrice;

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
    fractionalShare,
    wholeApartmentValueEq,
    apartmentSizes,
    retainedLandRights,
    apartmentsBuilt,
    apartmentsSoldByOwner: apartmentsSold,
    fractionSettled,
    completionMonth: completion,
    rentCountsForRepayment,
    heldLandValueAtHorizon,
    deferredLiabilities,
    preCompletionLandCollateral,
    postCompletionCollateral,
    constructionCost,
    capitalGainsRange: cgRange,
  };
}

/**
 * Only whole apartments produce rent (or rent saved). If rented (S08) a rental-tax reserve applies; if the owner
 * lives in it, there is no rental tax on the housing benefit — only the maintenance reserve.
 */
export function monthlyNetRentFor(plan: TransactionPlan, config: ProjectConfig): number {
  const gross = netMonthlyRentPerApartment(config) / (1 - config.market.rentalExpenseReserve - config.taxation.rentalTaxReserve);
  const rate = plan.rentCountsForRepayment
    ? 1 - config.market.rentalExpenseReserve - config.taxation.rentalTaxReserve
    : 1 - config.market.rentalExpenseReserve;
  // Rent scales with apartment value (size) — a compact apartment earns less than a standard one.
  return plan.wholeApartmentValueEq * gross * rate;
}
