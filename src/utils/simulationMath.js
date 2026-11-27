/**
 * מקור האמת היחיד לחישובי הסימולטור לחלקה 33.
 * פונקציות טהורות בלבד — ללא React.
 */
import { BASE_SHARE_AREA, PARCEL, getLot, getVersion } from '../data/parcel33';

/**
 * ממיר שבר זכות בחלקה (למשל "167/21258") לשטח קרקע במ״ר.
 * מקבל שבר בלבד; זורק Error עם הודעה בעברית לקלט לא תקין.
 */
export function parseParcelFraction(input) {
  const trimmed = String(input ?? '').trim();
  if (trimmed === '') throw new Error('יש להזין שבר זכות, למשל 167/21258.');
  const parts = trimmed.split('/');
  if (parts.length !== 2 || parts[0].trim() === '' || parts[1].trim() === '') {
    throw new Error('שבר לא תקין. השתמשו בפורמט כמו 167/21258.');
  }
  const numerator = Number(parts[0].trim());
  const denominator = Number(parts[1].trim());
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new Error('שבר לא תקין. המונה והמכנה חייבים להיות מספרים.');
  }
  if (denominator === 0) throw new Error('המכנה לא יכול להיות 0.');
  if (numerator < 0 || denominator < 0) throw new Error('שבר לא יכול להיות שלילי.');
  const fraction = numerator / denominator;
  if (fraction > 1) throw new Error('השבר גדול מהחלקה כולה (מעל 1).');
  return fraction * PARCEL.area;
}

/**
 * הזכויות של בעל קרקע לפי טבלת האיזון וההקצאה, לגרסה ולמגרש שנבחרו.
 * @param {number} landArea שטח בחלקה (מ״ר)
 * @param {'v2'} versionId — רק הטבלאות המעודכנות (106(ב))
 * @param {string} lotId
 * @param {number} bettermentLevyPct שיעור היטל ההשבחה מעליית השווי (ברירת מחדל 50%)
 */
export function computeTableRights(landArea, versionId, lotId, bettermentLevyPct = 50) {
  const version = getVersion(versionId);
  const lot = getLot(versionId, lotId);
  const area = Math.max(0, Number(landArea) || 0);

  const lotShare = (area / BASE_SHARE_AREA) * lot.sharePer167;
  const units = lotShare * lot.units;
  const residentialArea = lotShare * lot.residentialArea;
  const allocationValue = lotShare * lot.value;
  const incomingValue = (area * version.incomingValue) / PARCEL.area;
  const increase = allocationValue - incomingValue;
  const bettermentLevy = Math.max(0, increase) * (bettermentLevyPct / 100);

  return {
    versionId: version.id,
    lot,
    landArea: area,
    parcelShare: area / PARCEL.area,
    lotShare,
    units,
    sqmPerUnit: units > 0 ? area / units : 0,
    residentialArea,
    allocationValue,
    incomingValue,
    increase,
    bettermentLevy,
    bettermentLevyPct,
  };
}

export function marketValuePerApartmentFromConfig(config) {
  return config.marketValueSqm * config.apartmentSizeSqm;
}

/**
 * ארבעת המסלולים לבעל הקרקע.
 * @param {number} landArea
 * @param {ReturnType<typeof computeTableRights>} rights
 * @param {object} config — באותו מבנה של DEFAULT_CONFIG
 */
export function computeSimulationTracks(landArea, rights, config) {
  const area = Math.max(0, Number(landArea) || 0);
  const override = Number(config.sqmPerUnitOverride);
  const units = override > 0 ? area / override : rights.units;
  const sqmPerUnit = units > 0 ? area / units : 0;
  const bettermentLevy = rights.bettermentLevy;
  const marketValuePerApartment = marketValuePerApartmentFromConfig(config);
  const landValuePerSqm = config.landValuePerSqm;

  // --- קומבינציה: היזם מקבל את יתרת הזכויות ומכסה את היטל ההשבחה ---
  const combinationRatio = config.combinationPct / 100;
  const finishedUnits = units * combinationRatio;
  const wholeUnits = Math.floor(finishedUnits + 1e-9);
  const fractionalPart = Math.max(0, finishedUnits - wholeUnits);
  const soldPortion = 1 - combinationRatio;
  const soldUnits = units * soldPortion;
  const soldValue = area * soldPortion * landValuePerSqm;
  const combinationCapitalGainsTax = soldValue * (config.capitalGainsTax / 100);
  const totalCombinationValue = finishedUnits * marketValuePerApartment;

  const combination = {
    finishedUnits,
    wholeUnits,
    fractionalPart,
    hasMushaProblem: fractionalPart > 0.01,
    totalValue: totalCombinationValue,
    soldUnits,
    soldPortion,
    soldValue,
    capitalGainsTax: combinationCapitalGainsTax,
    bettermentLevyCovered: bettermentLevy,
    equityRequired: combinationCapitalGainsTax,
    profit: totalCombinationValue - combinationCapitalGainsTax,
  };

  // --- שירותי בנייה (עלות+): הבעלים בונים את כל הזכויות ומשלמים את ההיטל ---
  const constructionCostPerApartment = config.costPerSqm * config.apartmentSizeSqm;
  const entrepreneurFee = constructionCostPerApartment * (config.entrepreneurMarkup / 100);
  const subtotal = constructionCostPerApartment + entrepreneurFee;
  const vat = subtotal * (config.vatRate / 100);
  const buildCostPerUnit = subtotal + vat;
  const levyPerUnit = units > 0 ? bettermentLevy / units : 0;
  const costPerUnit = buildCostPerUnit + levyPerUnit;
  const totalEquityRequired = buildCostPerUnit * units + bettermentLevy;
  const totalMarketValueCp = units * marketValuePerApartment;

  const costPlus = {
    finishedUnits: units,
    constructionCostPerApartment,
    entrepreneurFee,
    subtotal,
    vat,
    buildCostPerUnit,
    bettermentLevy,
    levyPerUnit,
    costPerUnit,
    totalEquityRequired,
    totalMarketValue: totalMarketValueCp,
    profit: totalMarketValueCp - totalEquityRequired,
    breakEvenPriceSqm: config.apartmentSizeSqm > 0 ? costPerUnit / config.apartmentSizeSqm : 0,
    equityBarrier: totalEquityRequired * (config.requiredEquityPct / 100),
    requiredEquityPct: config.requiredEquityPct,
  };

  // --- תמורות: חלק מההכנסות מכל הזכויות, היזם מממן ---
  const totalMarketValueRs = units * marketValuePerApartment;
  const yourShare = totalMarketValueRs * (config.revenueSharePct / 100);
  const revenueSharing = {
    finishedUnits: units,
    totalMarketValue: totalMarketValueRs,
    revenueSharePct: config.revenueSharePct,
    yourShare,
    equityRequired: 0,
    profit: yourShare,
  };

  // --- מזומן: מחיר לפי מ״ר קרקע, בניכוי היטל, רווח יזמי ומס שבח ---
  const grossLandValue = area * landValuePerSqm;
  const entrepreneurProfit = grossLandValue * (config.entrepreneurProfitMargin / 100);
  const amountBeforeTax = grossLandValue - bettermentLevy - entrepreneurProfit;
  const cashCapitalGainsTax = Math.max(0, amountBeforeTax) * (config.capitalGainsTax / 100);
  const netCashAmount = amountBeforeTax - cashCapitalGainsTax;
  const cashExit = {
    grossLandValue,
    bettermentLevy,
    entrepreneurProfit,
    amountBeforeTax,
    capitalGainsTax: cashCapitalGainsTax,
    netCashAmount,
    equityRequired: 0,
    profit: netCashAmount,
  };

  return {
    units,
    sqmPerUnit,
    isOverridden: override > 0,
    marketValuePerApartment,
    combination,
    costPlus,
    revenueSharing,
    cashExit,
  };
}
