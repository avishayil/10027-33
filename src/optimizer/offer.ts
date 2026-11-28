/**
 * Checking an actual developer offer (V1 Milestone C1, MH-10; spec §3.6).
 *
 * Every field is optional. A term the owner enters is used as written (an offer term within its scope — this lot, on
 * the comparison date); a term left empty stays **unknown**: the model's scenario is used for it, it is listed as
 * missing, and it becomes a question for the developer or an adviser. The offer is evaluated as a contract snapshot and
 * compared with the owner's alternatives on the same valuation basis (today's prices, real 3%) and the same date, as
 * line-by-line changes against the base terms — not an aggregate score. Nothing is uploaded, extracted or stored
 * unless the owner saves it.
 */
import { getLot } from '../data/parcel33';
import { ARRANGEMENT_PAYERS } from '../domain/arrangements';
import type { CommercialTerms, LedgerEntry, PaymentMilestone, ProjectConfig, TaxArrangement, UserProfile } from '../domain/types';
import { contractConfig, snapshotsFor, type ContractFunding, type ContractSnapshot, type ContractTerms } from './contract';

export type Side = 'owner' | 'developer';

export interface ActualOffer {
  offerDate: string | null;
  validUntil: string | null;
  lotId: string | null;
  combinationPct: number | null;
  markup: number | null;
  construction: { pricePerSqm: number | null; areaBasis: 'licensed' | 'door_to_door' | null };
  completion: { pricePerSqm: number | null };
  taxes: { levy: Side | null; capitalGains: Side | null; vat: Side | null; levyCap: number | null };
  /** Shares of the owner's construction payments: at signing, at the permit, during construction, at delivery. */
  schedule: { signing: number | null; permit: number | null; construction: number | null; delivery: number | null };
  taxLoan: { offered: boolean | null; amountCap: number | null; annualRate: number | null; interestPaidBy: Side | null };
  guarantee: 'sale_law' | 'none' | null;
  inventory: { confirmed: boolean | null; description: string | null };
  option: { exerciseAtApproval: boolean | null; fee: number | null };
}

export const EMPTY_OFFER: ActualOffer = {
  offerDate: null,
  validUntil: null,
  lotId: null,
  combinationPct: null,
  markup: null,
  construction: { pricePerSqm: null, areaBasis: null },
  completion: { pricePerSqm: null },
  taxes: { levy: null, capitalGains: null, vat: null, levyCap: null },
  schedule: { signing: null, permit: null, construction: null, delivery: null },
  taxLoan: { offered: null, amountCap: null, annualRate: null, interestPaidBy: null },
  guarantee: null,
  inventory: { confirmed: null, description: null },
  option: { exerciseAtApproval: null, fee: null },
};

export interface MissingTerm {
  field: string;
  label: string;
  /** What to ask the developer or an adviser. */
  question: string;
}

export interface OfferContract {
  k: ContractTerms;
  terms: CommercialTerms;
  config: ProjectConfig;
  /** Fields the owner entered (used as written). */
  entered: string[];
  missing: MissingTerm[];
  warnings: string[];
  errors: string[];
  /** On the comparison date: valid, expired, not yet valid, or no validity date given. */
  status: 'valid' | 'expired' | 'not_yet_valid' | 'undated';
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pctOk = (x: number) => Number.isFinite(x) && x >= 0 && x <= 1;
const moneyOk = (x: number) => Number.isFinite(x) && x >= 0 && x < 1e10;

/** The arrangement template matching who pays the levy and the capital-gains tax (with a ₪0 levy cap when needed). */
function arrangementOf(levy: Side, cg: Side): { arrangement: TaxArrangement; levyCapZero: boolean } {
  if (cg === 'developer') return { arrangement: 'net', levyCapZero: levy === 'owner' };
  return { arrangement: levy === 'developer' ? 'mixed' : 'gross', levyCapZero: false };
}

/** The contract an offer describes, on top of the current base terms; unknown terms fall back to the model. */
export function offerContract(base: ProjectConfig, current: CommercialTerms, o: ActualOffer, profile: UserProfile): OfferContract {
  const entered: string[] = [];
  const missing: MissingTerm[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const miss = (field: string, label: string, question: string) => missing.push({ field, label, question });
  const date = base.analysis.valuationDate;
  const lotId = profile.lotId || base.rights.defaultLotId;

  // Dates and scope.
  for (const [d, label] of [
    [o.offerDate, 'תאריך ההצעה'],
    [o.validUntil, 'תוקף ההצעה'],
  ] as const)
    if (d !== null && !ISO.test(d)) errors.push(`${label}: תאריך לא תקין (שנה-חודש-יום).`);
  if (o.offerDate) entered.push('offerDate');
  else miss('offerDate', 'תאריך ההצעה', 'מה תאריך ההצעה, ומי חתום עליה?');
  if (o.validUntil) entered.push('validUntil');
  else miss('validUntil', 'תוקף ההצעה', 'עד מתי ההצעה בתוקף?');
  const status: OfferContract['status'] = !o.validUntil ? 'undated' : o.validUntil < date ? 'expired' : o.offerDate && o.offerDate > date ? 'not_yet_valid' : 'valid';
  if (status === 'expired') warnings.push(`ההצעה פגה ב-${o.validUntil} — לפני תאריך ההשוואה (${date}).`);
  if (o.lotId && o.lotId !== lotId) warnings.push(`ההצעה למגרש ${o.lotId}, והחישוב שלכם על מגרש ${lotId} — ודאו לאיזה מגרש ההצעה.`);

  // Combination and markup.
  let combinationPct = current.combinationPct;
  if (o.combinationPct !== null) {
    if (!pctOk(o.combinationPct)) errors.push('אחוז הקומבינציה חייב להיות בין 0% ל-100%.');
    else {
      combinationPct = o.combinationPct;
      entered.push('combinationPct');
    }
  } else miss('combinationPct', 'אחוז הקומבינציה', 'מה אחוז הקומבינציה בדיוק, ועל איזה שטח הוא מחושב?');
  let markup = current.developerMarkup;
  if (o.markup !== null) {
    if (!pctOk(o.markup)) errors.push('הרווח היזמי חייב להיות בין 0% ל-100%.');
    else {
      markup = o.markup;
      entered.push('markup');
    }
  } else miss('markup', 'רווח יזמי על שירותי בנייה', 'מה תוספת הרווח על שירותי בנייה (אחוז), והאם היא כוללת מע״מ?');

  // Taxes.
  const tpl = ARRANGEMENT_PAYERS[base.commercial.taxArrangement];
  const levy: Side = o.taxes.levy ?? (tpl.levy === 'developer' ? 'developer' : 'owner');
  const cg: Side = o.taxes.capitalGains ?? (tpl.capitalGainsTax === 'developer' ? 'developer' : 'owner');
  const { arrangement, levyCapZero } = arrangementOf(levy, cg);
  if (o.taxes.levy) entered.push('taxes.levy');
  else miss('taxes.levy', 'מי משלם את היטל ההשבחה', 'מי משלם את היטל ההשבחה — ועד איזה סכום?');
  if (o.taxes.capitalGains) entered.push('taxes.capitalGains');
  else miss('taxes.capitalGains', 'מי משלם את מס השבח', 'מי משלם את מס השבח על הזכויות שעוברות ליזם? (שאלה גם ליועץ מס)');
  const vatOf = (a: TaxArrangement): Side => (ARRANGEMENT_PAYERS[a].servicesVat === 'developer' ? 'developer' : 'owner');
  if (o.taxes.vat) {
    entered.push('taxes.vat');
    if (o.taxes.vat !== vatOf(arrangement)) warnings.push(`מע״מ על שירותי הבנייה: לפי ההצעה משלם ${o.taxes.vat === 'developer' ? 'היזם' : 'אתם'}, והחישוב לפי התבנית (${vatOf(arrangement) === 'developer' ? 'היזם' : 'אתם'}) — לבדוק מול יועץ מס.`);
  } else miss('taxes.vat', 'מי משלם מע״מ על שירותי הבנייה', 'מי משלם את המע״מ על שירותי הבנייה שאתם מקבלים?');
  let levyCap: number | null = base.commercial.offer.levyCap;
  if (o.taxes.levyCap !== null) {
    if (!moneyOk(o.taxes.levyCap)) errors.push('תקרת ההיטל חייבת להיות סכום לא שלילי.');
    else {
      levyCap = o.taxes.levyCap;
      entered.push('taxes.levyCap');
    }
  }
  if (levyCapZero) levyCap = 0;

  // Construction price and its area basis.
  const lot = getLot(base.rights.tableVersion, o.lotId || lotId);
  let costPerSqm = base.construction.costPerSqm;
  if (o.construction.pricePerSqm !== null) {
    if (!moneyOk(o.construction.pricePerSqm)) errors.push('מחיר הבנייה חייב להיות סכום לא שלילי.');
    else {
      entered.push('construction.pricePerSqm');
      if (o.construction.areaBasis === null) {
        miss('construction.areaBasis', 'על איזה שטח מחושב מחיר הבנייה', 'המחיר למ״ר הוא לפי שטח רישוי (ברוטו) או שטח דירה (מקיר לקיר)?');
        warnings.push('בסיס השטח של מחיר הבנייה לא צוין — חושב כמחיר למ״ר דירה.');
      } else entered.push('construction.areaBasis');
      // The engine prices services per saleable (door-to-door) m²; a licensed-area price covers more m² per apartment.
      costPerSqm = o.construction.areaBasis === 'licensed' ? (o.construction.pricePerSqm * lot.aboveGroundArea) / lot.residentialArea : o.construction.pricePerSqm;
    }
  } else miss('construction.pricePerSqm', 'מחיר שירותי הבנייה', 'מה המחיר למ״ר לשירותי בנייה, לפני רווח ומע״מ, ועל איזה שטח?');

  // Completion price.
  let completionPriceFactor = base.commercial.completionPriceFactor;
  if (o.completion.pricePerSqm !== null) {
    if (!moneyOk(o.completion.pricePerSqm)) errors.push('מחיר ההשלמה חייב להיות סכום לא שלילי.');
    else {
      completionPriceFactor = o.completion.pricePerSqm / base.market.apartmentValuePerSqm;
      entered.push('completion.pricePerSqm');
    }
  } else miss('completion.pricePerSqm', 'מחיר השלמה לדירה שלמה', 'אם תרצו להשלים לדירה שלמה: מה המחיר למ״ר, ומתי משלמים?');

  // Payment schedule.
  let schedule: PaymentMilestone[] = base.construction.schedule;
  const sch = o.schedule;
  const parts = [sch.signing, sch.permit, sch.construction, sch.delivery];
  if (parts.some((x) => x !== null)) {
    if (parts.some((x) => x === null)) errors.push('לוח התשלומים: נדרשים כל ארבעת החלקים (חתימה, היתר, בנייה, מסירה).');
    else if (parts.some((x) => !pctOk(x!))) errors.push('לוח התשלומים: כל חלק בין 0% ל-100%.');
    else if (Math.abs(parts.reduce<number>((sum, x) => sum + (x ?? 0), 0) - 1) > 0.001) errors.push('לוח התשלומים: סכום החלקים חייב להיות 100%.');
    else {
      const c = sch.construction! / 3;
      schedule = [
        { phase: 'signing', at: 0, share: sch.signing!, label: 'חתימת חוזה' },
        { phase: 'permit', at: 0, share: sch.permit!, label: 'היתר בנייה' },
        { phase: 'construction', at: 1 / 6, share: c, label: 'שלד' },
        { phase: 'construction', at: 5 / 12, share: c, label: 'שלד ומעטפת' },
        { phase: 'construction', at: 2 / 3, share: c, label: 'גמרים' },
        { phase: 'construction', at: 1, share: sch.delivery!, label: 'מסירה' },
      ];
      entered.push('schedule');
    }
  } else miss('schedule', 'לוח התשלומים ליזם', 'מתי משלמים על שירותי הבנייה — כמה בחתימה, בהיתר, בבנייה ובמסירה? והאם צמוד למדד?');

  // Tax loan.
  let funding: ContractFunding = 'none';
  let taxLoan = base.financing.taxLoan;
  let developerPaysTaxLoanInterest = base.commercial.offer.developerPaysTaxLoanInterest;
  if (o.taxLoan.offered !== null) {
    entered.push('taxLoan.offered');
    if (o.taxLoan.offered) {
      funding = 'developer_loan';
      if (o.taxLoan.annualRate !== null) {
        if (!(Number.isFinite(o.taxLoan.annualRate) && o.taxLoan.annualRate >= 0 && o.taxLoan.annualRate < 1)) errors.push('ריבית ההלוואה לא תקינה.');
        else {
          taxLoan = { ...taxLoan, annualRate: o.taxLoan.annualRate };
          entered.push('taxLoan.annualRate');
        }
      } else miss('taxLoan.annualRate', 'ריבית הלוואת המסים', 'מה הריבית על הלוואת המסים (כולל מע״מ על הריבית), והאם היא צמודה?');
      if (o.taxLoan.amountCap !== null) {
        if (!moneyOk(o.taxLoan.amountCap)) errors.push('תקרת ההלוואה חייבת להיות סכום לא שלילי.');
        else {
          taxLoan = { ...taxLoan, amountCap: o.taxLoan.amountCap };
          entered.push('taxLoan.amountCap');
        }
      } else miss('taxLoan.amountCap', 'תקרת הלוואת המסים', 'מה הסכום המרבי של הלוואת המסים?');
      if (o.taxLoan.interestPaidBy !== null) {
        developerPaysTaxLoanInterest = o.taxLoan.interestPaidBy === 'developer';
        entered.push('taxLoan.interestPaidBy');
      } else miss('taxLoan.interestPaidBy', 'מי נושא בריבית', 'מי נושא בריבית על הלוואת המסים עד המסירה?');
    }
  } else miss('taxLoan.offered', 'הלוואת מסים מהיזם', 'האם היזם מציע הלוואה למסים? באיזה סכום, ריבית ומועד פירעון?');

  // Guarantee, inventory, option.
  if (o.guarantee !== null) entered.push('guarantee');
  else miss('guarantee', 'ערבויות', 'אילו ערבויות תקבלו (ערבות חוק המכר / נאמנות) על התשלומים ועל הדירה?');
  if (o.inventory.confirmed !== null) entered.push('inventory');
  else miss('inventory', 'מלאי ושיוך דירות', 'איזו דירה בדיוק תקבלו (גודל, קומה, כיוון), ומתי השיוך נסגר?');
  if (o.option.fee !== null) entered.push('option.fee');

  const terms: CommercialTerms = { combinationPct, developerMarkup: markup };
  const k: ContractTerms = { arrangement, combinationPct, markup, offer: { levyCap, developerPaysTaxLoanInterest }, funding };
  const cfg0 = contractConfig(base, k);
  const config: ProjectConfig = {
    ...cfg0,
    construction: { ...cfg0.construction, costPerSqm, schedule },
    commercial: { ...cfg0.commercial, completionPriceFactor },
    financing: { ...cfg0.financing, taxLoan: { ...cfg0.financing.taxLoan, ...taxLoan, available: funding === 'developer_loan', considerAsAlternative: false } },
  };
  return { k, terms, config, entered, missing, warnings, errors, status };
}

export interface DiffLine {
  id: string;
  label: string;
  base: number | null;
  offer: number | null;
  delta: number | null;
  /** Whether a higher value is better for the owner (null = context). */
  higherIsBetter: boolean | null;
}

export interface OfferCheck {
  comparisonDate: string;
  terms: OfferContract;
  /** The owner's best acceptable route under the offer (else the best-valued route), and the same route on the base terms. */
  offerRoute: ContractSnapshot | null;
  baseRoute: ContractSnapshot | null;
  /** Every route under the offer (for inspection). */
  offerSnapshots: ContractSnapshot[];
  diff: DiffLine[];
  questions: string[];
  /** Option terms are known (a fee entered) — options may be compared. */
  optionTermsKnown: boolean;
}

const ownerTaxes = (ledger: LedgerEntry[], payer: 'owner' | 'developer') =>
  ledger
    .filter((e) => e.payer === payer && e.direction === 'out' && !e.deferred && ['betterment_levy', 'capital_gains_tax', 'services_vat', 'purchase_tax'].includes(e.category))
    .reduce((s, e) => s + e.amount, 0);

const CONDITION_QUESTIONS: Record<string, string> = {
  LENDER_CONFIRMATION: 'לבנק: האם תאושר משכנתא בסכום ובמועד שהמסלול צריך?',
  TAX_LOAN: 'ליזם: האם הלוואת המסים מובטחת בחוזה, ובאילו תנאי פירעון?',
  TAX_LOAN_REFINANCE: 'לבנק: האם אפשר למחזר את הלוואת המסים למשכנתא במסירה?',
  FRACTION_SETTLEMENT: 'ליזם: איך נסגר חלק הדירה שאינו שלם — יחידת סל, תשלום, או קנייה?',
  PLANNING_APPROVAL: 'ליזם ולעורך הדין: מה קורה אם התכנית לא תאושר עד מועד מסוים?',
  LEVY_TERMS: 'לשמאי: מה גובה ההיטל הצפוי בפועל, ומי נושא בהפרש מעל התקרה?',
  CONSTRUCTION_FINANCING: 'לבנק: האם יינתן מימון לתשלומי הבנייה לפני המסירה?',
  SALE_DATE_DEFERRAL: 'ליועץ המס: מתי מועד המכירה לצורך מס שבח בעסקה הזו?',
};

export function checkOffer(profile: UserProfile, base: ProjectConfig, current: CommercialTerms, o: ActualOffer): OfferCheck {
  const terms = offerContract(base, current, o, profile);
  const empty: OfferCheck = {
    comparisonDate: base.analysis.valuationDate,
    terms,
    offerRoute: null,
    baseRoute: null,
    offerSnapshots: [],
    diff: [],
    questions: [...terms.errors, ...terms.missing.map((m) => m.question)],
    optionTermsKnown: o.option.fee !== null,
  };
  if (terms.errors.length) return empty;
  const offerSnaps = snapshotsFor(profile, terms.k, terms.config);
  const kBase: ContractTerms = {
    arrangement: base.commercial.taxArrangement,
    combinationPct: current.combinationPct,
    markup: current.developerMarkup,
    offer: base.commercial.offer,
    funding: terms.k.funding,
  };
  const baseSnaps = snapshotsFor(profile, kBase, base);
  const pick = (xs: ContractSnapshot[]) => [...xs].filter((s) => s.owner.accepts).sort((a, b) => b.owner.value - a.owner.value)[0] ?? [...xs].sort((a, b) => b.owner.value - a.owner.value)[0] ?? null;
  const offerRoute = pick(offerSnaps);
  const baseRoute = offerRoute ? (baseSnaps.find((s) => s.routeId === offerRoute.routeId) ?? null) : null;
  const failure = (s: ContractSnapshot | null, guaranteed: boolean) => (s ? (guaranteed ? s.result.developerFailure.protected : s.result.developerFailure.unprotected) : null);
  const line = (id: string, label: string, b: number | null, x: number | null, higherIsBetter: boolean | null): DiffLine => ({
    id,
    label,
    base: b,
    offer: x,
    delta: b !== null && x !== null ? x - b : null,
    higherIsBetter,
  });
  const v = (s: ContractSnapshot | null, f: (s: ContractSnapshot) => number) => (s ? f(s) : null);
  const diff: DiffLine[] = offerRoute
    ? [
        line('apartments', 'דירות שלמות', v(baseRoute, (s) => s.owner.wholeApartments), v(offerRoute, (s) => s.owner.wholeApartments), true),
        line('value', 'ערך עבורכם (ערך נוכחי, מחירי היום)', v(baseRoute, (s) => s.owner.value), v(offerRoute, (s) => s.owner.value), true),
        line('ownerTaxes', 'מסים שאתם משלמים', v(baseRoute, (s) => ownerTaxes(s.result.ledger, 'owner')), v(offerRoute, (s) => ownerTaxes(s.result.ledger, 'owner')), false),
        line('developerTaxes', 'מסים שהיזם משלם בשבילכם', v(baseRoute, (s) => ownerTaxes(s.result.ledger, 'developer')), v(offerRoute, (s) => ownerTaxes(s.result.ledger, 'developer')), null),
        line('capital', 'כסף מכיסכם', v(baseRoute, (s) => s.result.personalCapitalRequired), v(offerRoute, (s) => s.result.personalCapitalRequired), false),
        line('signing', 'בחתימה', v(baseRoute, (s) => s.result.cashAtSigning), v(offerRoute, (s) => s.result.cashAtSigning), false),
        line('debt', 'הלוואות (משכנתא והלוואת מסים)', v(baseRoute, (s) => s.result.mortgageRequired + s.result.simulation.taxLoanDrawn), v(offerRoute, (s) => s.result.mortgageRequired + s.result.simulation.taxLoanDrawn), false),
        line('delivery', 'מצב נטו במסירה (מחירי היום)', v(baseRoute, (s) => s.result.delivery.netPosition), v(offerRoute, (s) => s.result.delivery.netPosition), true),
        line('noApproval', 'חשיפה אם התכנית לא תאושר', v(baseRoute, (s) => s.result.noApproval.unprotected), v(offerRoute, (s) => s.result.noApproval.unprotected), false),
        line('failure', 'הפסד אם היזם לא ישלים', failure(baseRoute, false), failure(offerRoute, o.guarantee === 'sale_law'), false),
        line('margin', 'רווח היזם במגרש (מההכנסות)', v(baseRoute, (s) => s.developer.margin ?? NaN), v(offerRoute, (s) => s.developer.margin ?? NaN), null),
      ].map((d) => (Number.isNaN(d.base) || Number.isNaN(d.offer) ? { ...d, base: Number.isNaN(d.base) ? null : d.base, offer: Number.isNaN(d.offer) ? null : d.offer, delta: null } : d))
    : [];
  const conditionQs = offerRoute ? offerRoute.conditions.map((c) => CONDITION_QUESTIONS[c]).filter((q): q is string => !!q) : [];
  const questions = [...new Set([...terms.warnings, ...terms.missing.map((m) => m.question), ...conditionQs])];
  return { ...empty, offerRoute, baseRoute, offerSnapshots: offerSnaps, diff, questions };
}
