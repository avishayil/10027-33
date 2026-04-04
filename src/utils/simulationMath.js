/**
 * Single source of truth for Plot 33 track calculations (used by useSimulation).
 */

export function marketValuePerApartmentFromConfig(config) {
  return config.marketValueSqm * config.apartmentSizeSqm;
}

function costPerBuiltUnit(config) {
  const constructionCostPerApartment = config.costPerSqm * config.apartmentSizeSqm;
  const entrepreneurFee =
    constructionCostPerApartment * (config.entrepreneurMarkup / 100);
  const subtotal = constructionCostPerApartment + entrepreneurFee;
  const vat = subtotal * (config.vatRate / 100);
  const bettermentLevy = config.bettermentLevyPerUnit;
  const costPerUnit = subtotal + vat + bettermentLevy;
  return {
    constructionCostPerApartment,
    entrepreneurFee,
    subtotal,
    vat,
    bettermentLevy,
    costPerUnit,
  };
}

/**
 * @param {number} landArea
 * @param {object} config — same shape as DEFAULT_CONFIG from useSimulation
 */
export function computeSimulationTracks(landArea, config) {
  const units = landArea / config.sqmPerUnit;
  const marketValuePerApartment = marketValuePerApartmentFromConfig(config);
  const landValuePerUnit = config.landValuePerUnit;

  const combinationRatio = config.combinationPct / 100;
  const finishedUnits = units * combinationRatio;
  const wholeUnits = Math.floor(finishedUnits);
  const fractionalPart = finishedUnits - wholeUnits;
  const hasMushaProblem = fractionalPart > 0.01;

  const totalCombinationValue = finishedUnits * marketValuePerApartment;
  const soldPortion = 1 - combinationRatio;
  const soldUnits = units * soldPortion;
  const soldValue = soldUnits * landValuePerUnit;
  const combinationCapitalGainsTax = soldValue * (config.capitalGainsTax / 100);
  const bettermentLevyCovered = units * config.bettermentLevyPerUnit;

  const combination = {
    finishedUnits,
    wholeUnits,
    fractionalPart,
    hasMushaProblem,
    totalValue: totalCombinationValue,
    soldUnits,
    soldValue,
    capitalGainsTax: combinationCapitalGainsTax,
    bettermentLevyCovered,
    equityRequired: combinationCapitalGainsTax,
    profit: totalCombinationValue - combinationCapitalGainsTax,
  };

  const built = costPerBuiltUnit(config);
  const totalEquityRequired = built.costPerUnit * units;
  const totalMarketValueCp = units * marketValuePerApartment;
  const equityBarrier =
    totalEquityRequired * (config.requiredEquityPct / 100);

  const costPlus = {
    finishedUnits: units,
    constructionCostPerApartment: built.constructionCostPerApartment,
    entrepreneurFee: built.entrepreneurFee,
    subtotal: built.subtotal,
    vat: built.vat,
    bettermentLevy: built.bettermentLevy,
    costPerUnit: built.costPerUnit,
    totalEquityRequired,
    totalMarketValue: totalMarketValueCp,
    profit: totalMarketValueCp - totalEquityRequired,
    breakEvenPriceSqm: built.costPerUnit / config.apartmentSizeSqm,
    equityBarrier,
    requiredEquityPct: config.requiredEquityPct,
  };

  const totalMarketValueRs = units * marketValuePerApartment;
  const yourShare =
    totalMarketValueRs * (config.revenueSharePct / 100);

  const revenueSharing = {
    finishedUnits: units,
    totalMarketValue: totalMarketValueRs,
    revenueSharePct: config.revenueSharePct,
    yourShare,
    equityRequired: 0,
    profit: yourShare,
    capitalGainsTax: 0,
    netProfit: yourShare,
  };

  const grossLandValue = units * landValuePerUnit;
  const bettermentLevy = units * config.bettermentLevyPerUnit;
  const entrepreneurProfit =
    grossLandValue * (config.entrepreneurProfitMargin / 100);
  const amountBeforeTax = grossLandValue - bettermentLevy - entrepreneurProfit;
  const cashCapitalGainsTax =
    amountBeforeTax * (config.capitalGainsTax / 100);
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
    marketValuePerApartment,
    landValuePerUnit,
    combination,
    costPlus,
    revenueSharing,
    cashExit,
  };
}
