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
  approvalMonth,
  completionMonth as completionMonthOf,
  constructionSchedule,
  constructionServiceTaxValuePerApartment,
  permitMonth as permitMonthOf,
} from './construction';
import { developerPart, developerTaxPart, termsFor } from './arrangements';
import { capitalGainsReserve, levyPerRight, netMonthlyRentPerApartment } from './taxation';
import type {
  CashEvent,
  Candidate,
  CommercialTerms,
  LedgerEntry,
  PriceBasis,
  ProjectConfig,
  RightsInfo,
  TransactionPlan,
  UserProfile,
} from './types';
import { apartmentValueAt, apartmentValueToday, developerRightsPrice, immediateRightsPrice } from './valuation';

/** Indexed construction payments (and their reserve) are nominal amounts; everything else is in today's prices. */
export const NOMINAL_CATEGORIES: ReadonlySet<LedgerEntry['category']> = new Set<LedgerEntry['category']>(['construction', 'contingency_reserve', 'contingency_release']);
export const priceBasisOf = (category: LedgerEntry['category']): PriceBasis => (NOMINAL_CATEGORIES.has(category) ? 'nominal' : 'real');

export interface PlanContext {
  info: RightsInfo;
  profile: UserProfile;
  terms: CommercialTerms;
  config: ProjectConfig;
}

export function approvalMonthOf(config: ProjectConfig): number {
  return approvalMonth(config);
}

export function buildTransactionPlan(candidate: Candidate, ctx: PlanContext): TransactionPlan {
  const { info, profile, terms, config } = ctx;
  const events: CashEvent[] = [];
  const ledger: LedgerEntry[] = [];
  const cgRange = { low: 0, high: 0 };

  const completion = completionMonthOf(config);
  // A pool sale / developer buy-back of the fraction may come after delivery (adverse stress).
  const settlementDelay = Math.max(0, Math.round(config.timeline.settlementDelayMonths));
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
  let poolSoldFraction = 1;
  let fractionSettled: TransactionPlan['fractionSettled'] = null;
  let tierRooms: number | null = null;
  let mixRooms: number[] | null = null;
  // Asset-level basis of apartment entitlement received in combination: the taxable services value (already the
  // consideration for the land sold) + the original land basis of the retained share.
  let combinationReceived = 0;
  let combinationBasis = 0;
  /** Capital-gains reserve on disposing of `share` of the combination entitlement for `amount`. */
  const disposalTax = (amount: number, share: number) => {
    const basisPerEq = combinationReceived > 0 ? combinationBasis / combinationReceived : 0;
    return Math.max(0, amount - basisPerEq * share) * config.taxation.indicativeCapitalGainsRate;
  };
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
    const priceBasis = priceBasisOf(category);
    ledger.push({ category, label, amount, direction: 'out', month, payer, priceBasis, ...extra });
    if (payer === 'owner' && !extra.deferred && amount > 0)
      events.push({ month, amount: -amount, label, category, priceBasis, ...(extra.taxLoanEligible ? { taxLoanEligible: true } : {}) });
  };
  const inflow = (month: number, amount: number, label: string, category: LedgerEntry['category']) => {
    if (amount <= 0) return;
    const priceBasis = priceBasisOf(category);
    ledger.push({ category, label, amount, direction: 'in', month, payer: 'owner', priceBasis });
    events.push({ month, amount, label, category, priceBasis });
  };
  const addCg = (t: { used: number; low: number; high: number }) => {
    cgRange.low += t.low;
    cgRange.high += t.high;
    return t.used;
  };
  // Per-tax contract terms: the arrangement template with any actual-offer overrides (e.g. a levy cap). With
  // servicesVatOnOwner off, the developer always absorbs the services VAT (legacy fixtures).
  const contract = termsFor(arrangement, config.commercial.offer, config.taxation.servicesVatOnOwner);
  const vatRate = config.taxation.vatRate;
  // A cap applies to the holding as a whole, across legs.
  let levyCapLeft = contract.levy.developerCap;
  /** Splits a levy between developer and owner; one ledger entry per payer, rights portions pro rata. */
  const levyEntries = (month: number, levy: number, rights: number, ownerLabel: string) => {
    const dev = developerPart(levy, contract.levy, levyCapLeft);
    if (levyCapLeft !== null) levyCapLeft = Math.max(0, levyCapLeft - dev);
    const owner = levy - dev;
    if (dev > 0) out(month, dev, 'היטל השבחה — משולם ע״י היזם', 'betterment_levy', 'developer', { rightsPortion: levy > 0 ? (rights * dev) / levy : 0 });
    if (owner > 0 || dev <= 0)
      out(month, owner, ownerLabel, 'betterment_levy', 'owner', { rightsPortion: levy > 0 ? (rights * owner) / levy : rights, taxLoanEligible: true });
    return dev;
  };
  /** Splits the owner's capital-gains tax: the developer's part is grossed up (it is itself consideration). */
  const cgEntries = (month: number, tax: { used: number; low: number; high: number }, ownerLabel: string, extra: Partial<LedgerEntry>) => {
    const dev = developerTaxPart(tax.used, contract.capitalGains, cgRate);
    const scale = (t0: number) => developerTaxPart(t0, contract.capitalGains, cgRate);
    if (dev > 0) {
      out(month, dev, 'מס שבח — משולם ע״י היזם (כולל גילום)', 'capital_gains_tax', 'developer', {
        range: { low: scale(tax.low), high: scale(tax.high) },
      });
    }
    // Owner's part: the tax grown by the consideration the developer's payment adds, minus that payment.
    const ownerOf = (t0: number) => Math.max(0, t0 + cgRate * scale(t0) - scale(t0));
    const owner = ownerOf(tax.used);
    if (owner > 1e-9) {
      cgRange.low += ownerOf(tax.low);
      cgRange.high += ownerOf(tax.high);
      out(month, owner, ownerLabel, 'capital_gains_tax', 'owner', { range: { low: ownerOf(tax.low), high: ownerOf(tax.high) }, ...extra });
    }
    return dev;
  };

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
        combinationReceived += received;
        // Retained-land basis share is unknown unless the user gave it (then pro rata on the rights kept).
        const knownBasis = typeof profile.acquisitionBasis === 'number' ? profile.acquisitionBasis : 0;
        combinationBasis += services + (info.apartmentEquivalents > 0 ? (knownBasis * leg.rights * terms.combinationPct) / info.apartmentEquivalents : 0);
        const levy = leg.rights * levyUnit;
        const developerPaidLevy = levyEntries(permit, levy, leg.rights, 'היטל השבחה — עליכם');
        // VAT on the services: a private owner cannot reclaim it. When the owner pays it, the land's consideration is
        // the services ex VAT (the owner is not taxed on VAT it paid itself — to be confirmed by a tax adviser).
        const servicesVat = (services * vatRate) / (1 + vatRate);
        const devVat = developerPart(servicesVat, contract.servicesVat);
        const ownerPaidVat = servicesVat - devVat;
        if (devVat > 0) out(permit, devVat, 'מע״מ על שירותי הבנייה — על היזם', 'services_vat', 'developer');
        if (ownerPaidVat > 0) out(permit, ownerPaidVat, 'מע״מ על שירותי הבנייה שאתם מקבלים', 'services_vat', 'owner', { taxLoanEligible: true });
        const soldPortion = leg.rights * (1 - terms.combinationPct);
        const tax = capitalGainsReserve({
          consideration: services - ownerPaidVat + developerPaidLevy,
          deductibleCosts: 0,
          deductibleLevy: levy * (1 - terms.combinationPct),
          rightsPortion: soldPortion,
          info,
          profile,
          config,
        });
        // The developer's part of the tax (net deal: all of it) is grossed up — the payment is itself consideration.
        const developerPaidTax = cgEntries(combinationSaleMonth, tax, 'מס שבח על שירותי הבנייה שמתקבלים (רזרבה)', { taxLoanEligible: true });
        // The developer's acquisition tax on the land it receives, on the full consideration including taxes it pays.
        out(combinationSaleMonth, (services - ownerPaidVat + developerPaidLevy + developerPaidTax) * buyerPurchaseTax, 'מס רכישה על הקרקע — על היזם', 'purchase_tax', 'developer');
        break;
      }
      case 'completion': {
        if (leg.apartmentEquivalents <= 0) break;
        retainedEq += leg.apartmentEquivalents;
        const price = leg.apartmentEquivalents * aptToday * config.commercial.completionPriceFactor;
        out(permit, price / 2, 'תשלום השלמה ליזם (50%)', 'completion_payment');
        out(completion, price / 2, 'תשלום השלמה ליזם (יתרה)', 'completion_payment');
        // Classification depends on the contract; the rate depends on whether it will be the only home. With more
        // than one apartment in the plan, the completed one is an additional home whatever the household owns today.
        const pt = config.taxation.completionPurchaseTax;
        const rate = profile.soleHome === true && retainedEq <= 1 + 1e-6 ? pt.soleHome : pt.additionalHome;
        out(permit, price * rate, 'מס רכישה על החלק שאתם קונים מהיזם (לא על הקרקע שלכם)', 'purchase_tax', 'owner', {
          range: { low: price * pt.soleHome, high: price * pt.additionalHome },
        });
        break;
      }
      case 'buy_rights': {
        if (leg.rights <= 0) break;
        rightsPurchased += leg.rights;
        // Bought from other owners at the open-market reference — not at the developer's buying price.
        const price = leg.rights * info.sqmPerRight * (config.market.complementaryRightsPricePerSqm ?? config.market.postApprovalLandValuePerSqm);
        out(0, price, 'רכישת זכויות משלימות (מבעלים אחרים)', 'rights_purchase');
        out(0, price * buyerPurchaseTax, 'מס רכישה', 'purchase_tax');
        out(0, price * costRate, 'עלויות עסקה', 'transaction_costs');
        // Iteration 9 / F05: bought at signing, before the plan is approved — the buyer owns the rights at approval and
        // bears the levy on them by default (a contract may put it on the seller: the low end of the range).
        if (0 < approval) {
          const levy = leg.rights * levyUnit;
          out(permit, levy, 'היטל השבחה על הזכויות שנרכשו (נקנו לפני אישור התכנית — עליכם, אלא אם סוכם אחרת)', 'betterment_levy', 'owner', {
            rightsPortion: leg.rights,
            range: { low: 0, high: levy },
          });
        } else {
          out(0, 0, 'היטל השבחה על הזכויות שנרכשו — על המוכר (נקנו אחרי אישור התכנית)', 'betterment_levy', 'seller', { rightsPortion: leg.rights });
        }
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
        const devLevy = levyEntries(permit, levy, leg.rights, 'היטל השבחה — עליכם');
        const share = leg.rights * aptAtCompletion * config.commercial.revenueShare;
        inflow(completion, share, 'חלקכם בהכנסות המכירה', 'revenue_share');
        const tax = capitalGainsReserve({ consideration: share + devLevy, deductibleCosts: 0, deductibleLevy: levy, rightsPortion: leg.rights, info, profile, config });
        // Cash consideration: §19(3א) deferral does not apply — assessed at signing (conservative).
        const taxMonth = config.taxation.revenueShareTaxAtSigning ? 0 : completion;
        const devTax = cgEntries(taxMonth, tax, 'מס שבח על התמורה הצפויה (רזרבה)', { saleRelated: true });
        out(0, (share + devLevy + devTax) * buyerPurchaseTax, 'מס רכישה על הקרקע — על היזם', 'purchase_tax', 'developer');
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
        poolSoldFraction = Math.max(0, Math.min(1, leg.soldFraction ?? 1));
        break;
      case 'tier_apartment':
        tierRooms = leg.rooms;
        break;
      case 'apartment_mix':
        mixRooms = leg.rooms;
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
  const apartmentRooms: number[] = new Array(wholeApartmentsRetained).fill(4);
  const values: number[] = new Array(wholeApartmentsRetained).fill(1);
  const tier = tierRooms !== null ? config.market.apartmentTypes.find((t) => t.rooms === tierRooms) : undefined;

  if (mixRooms && mixRooms.length > 0) {
    // Value-based allocation of the whole entitlement into a mix of apartment types (appraisal comparables). The owner
    // pays the gap as a completion payment, or the developer pays out the excess. Not confirmed inventory.
    const types = mixRooms.map((r) => config.market.apartmentTypes.find((t) => t.rooms === r)!);
    const mixValue = types.reduce((sum, t) => sum + t.relativeValue, 0);
    const gap = mixValue - retainedEq;
    if (gap > 1e-9) {
      const price = gap * aptToday * config.commercial.completionPriceFactor;
      out(permit, price / 2, `תשלום השלמה לתמהיל הדירות (50%)`, 'completion_payment');
      out(completion, price / 2, `תשלום השלמה לתמהיל הדירות (יתרה)`, 'completion_payment');
      const pt = config.taxation.completionPurchaseTax;
      // With more than one apartment the completed share is an additional home whatever the household owns today.
      const rate = profile.soleHome === true && types.length === 1 ? pt.soleHome : pt.additionalHome;
      out(permit, price * rate, 'מס רכישה על החלק שאתם קונים מהיזם (לא על הקרקע שלכם)', 'purchase_tax', 'owner', {
        range: { low: price * pt.soleHome, high: price * pt.additionalHome },
      });
    } else if (gap < -1e-9) {
      const amount = -gap * aptAtCompletion * config.commercial.fractionCashSettlementFactor;
      inflow(completion + settlementDelay, amount, 'איזון כספי על ההפרש לתמהיל הדירות', 'fraction_settlement');
      const tax = disposalTax(amount, -gap);
      cgRange.low += tax;
      cgRange.high += tax;
      out(completion + settlementDelay, tax, 'מס שבח על האיזון (רזרבה)', 'capital_gains_tax', 'owner', { saleRelated: true });
      fractionSettled = { mode: 'cash', share: -gap };
    }
    retainedEq = mixValue;
    wholeApartmentsRetained = types.length;
    fractionalShare = 0;
    apartmentSizes.length = 0;
    apartmentRooms.length = 0;
    values.length = 0;
    for (const t of types) {
      apartmentSizes.push(t.sizeSqm);
      apartmentRooms.push(t.rooms);
      values.push(t.relativeValue);
    }
  }

  if (tier && fractionalShare > 0) {
    // Value-based allocation: the fraction becomes one whole apartment of this type. Its value relative to the
    // 4-room standard comes from appraisal comparables (smaller units cost more per m²) — not a linear area ratio.
    // Not a guarantee that such an apartment exists or can be legally assigned.
    const tierSize = tier.sizeSqm;
    const tierEq = tier.relativeValue;
    const gap = tierEq - fractionalShare;
    if (gap > 1e-9) {
      const price = gap * aptToday * config.commercial.completionPriceFactor;
      out(permit, price / 2, `תשלום השלמה לדירת ${tierSize} מ״ר (50%)`, 'completion_payment');
      out(completion, price / 2, `תשלום השלמה לדירת ${tierSize} מ״ר (יתרה)`, 'completion_payment');
      const pt = config.taxation.completionPurchaseTax;
      // The upgraded apartment is the only home only if the plan has no other whole apartment.
      const rate = profile.soleHome === true && wholeApartmentsRetained === 0 ? pt.soleHome : pt.additionalHome;
      out(permit, price * rate, 'מס רכישה על החלק שאתם קונים מהיזם (לא על הקרקע שלכם)', 'purchase_tax', 'owner', {
        range: { low: price * pt.soleHome, high: price * pt.additionalHome },
      });
    } else if (gap < -1e-9) {
      const amount = -gap * aptAtCompletion * config.commercial.fractionCashSettlementFactor;
      inflow(completion + settlementDelay, amount, 'איזון כספי על ההפרש לדירה הקטנה', 'fraction_settlement');
      const tax = disposalTax(amount, -gap);
      cgRange.low += tax;
      cgRange.high += tax;
      out(completion + settlementDelay, tax, 'מס שבח על האיזון (רזרבה)', 'capital_gains_tax', 'owner', { saleRelated: true });
      fractionSettled = { mode: 'cash', share: -gap };
    }
    retainedEq = wholeApartmentsRetained + tierEq;
    apartmentSizes.push(tierSize);
    apartmentRooms.push(tier.rooms);
    values.push(tierEq);
    wholeApartmentsRetained += 1;
    fractionalShare = 0;
  }

  const settledShare = settleFraction === 'pool' ? fractionalShare * poolSoldFraction : fractionalShare;
  if (settleFraction && settledShare > 1e-12) {
    // Cash: the developer buys the fraction back at a negotiated discount. Pool (יחידת סל): fractions of several
    // owners are pooled into balancing units sold on the market; proceeds after costs are distributed. Only the part
    // actually sold with whole units is cash (B1); the rest stays an illiquid fractional share.
    const factor = settleFraction === 'cash' ? config.commercial.fractionCashSettlementFactor : 1 - costRate;
    const amount = settledShare * aptAtCompletion * factor;
    inflow(completion + settlementDelay, amount, settleFraction === 'cash' ? 'פיצוי כספי על חלק הדירה' : 'חלקכם ממכירת יחידת הסל', 'fraction_settlement');
    // Disposal of retained property (the apartment entitlement received), not extra land consideration: the gain is
    // measured over its basis — the services value already taxed when it was received.
    const tax = disposalTax(amount, settledShare);
    cgRange.low += tax;
    cgRange.high += tax;
    out(completion + settlementDelay, tax, 'מס שבח על הפיצוי (רזרבה)', 'capital_gains_tax', 'owner', { saleRelated: true });
    retainedEq -= settledShare;
    fractionSettled = { mode: settleFraction, share: settledShare };
    fractionalShare -= settledShare;
    if (fractionalShare < 1e-9) fractionalShare = 0;
    wholeApartmentsRetained = Math.floor(retainedEq + 1e-6);
    apartmentSizes.length = wholeApartmentsRetained;
    apartmentRooms.length = wholeApartmentsRetained;
    values.length = wholeApartmentsRetained;
  }
  const wholeApartmentValueEq = values.reduce((s, x) => s + x, 0);
  // Living in a kept apartment saves rent, but that is not cash: it never funds payments or accumulates.
  const housingBenefitMonthly = rentCountsForRepayment
    ? 0
    : wholeApartmentValueEq * config.market.monthlyRentPerApartment * (1 - config.market.rentalExpenseReserve);

  // Land a lender could recognise: the planning appraisal's allocation value per right — never the unverified
  // developer-price scenario (a hypothetical price must not decide whether a route is financeable).
  const landPrice = info.apartmentEquivalents > 0 ? info.table.allocationValue / info.apartmentEquivalents : 0;
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
    apartmentValues: values,
    apartmentRooms,
    housingBenefitMonthly,
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
 * Rental cash flow: only when the owner actually rents the apartments out (S08), after the rental-tax and
 * maintenance reserves. An owner-occupied apartment produces no cash — its rent saving is a non-cash benefit
 * (housingBenefitMonthly) shown only in the long-term projection.
 */
export function monthlyNetRentFor(plan: TransactionPlan, config: ProjectConfig): number {
  if (!plan.rentCountsForRepayment) return 0;
  return plan.wholeApartmentValueEq * netMonthlyRentPerApartment(config);
}
