// Constants for Plot 33, Complex 10027
export const CONSTANTS = {
  UNITS_PER_SQM: 110, // 110 sqm = 1 Unit (Rights)
  CONSTRUCTION_COST_SQM: 11000, // ILS including VAT
  ENTREPRENEUR_FEE_COST_PLUS: 0.145, // 14.5%
  COMBINATION_PERCENT: 0.35, // 35%
  MARKET_VALUE_PER_APARTMENT: 2500000, // ILS
  LAND_VALUE_PER_UNIT_GROSS: 760000, // ILS
  BETTERMENT_LEVY_ESTIMATE: 160000, // ILS per unit
  CASH_EXIT_DISCOUNT: 0.18, // 18% discount
};

/**
 * Calculate total units/rights from land area
 */
export function calculateUnits(sqm) {
  return sqm / CONSTANTS.UNITS_PER_SQM;
}

/**
 * Calculate Combination Track (35%)
 */
export function calculateCombinationTrack(units) {
  const finishedUnits = units * CONSTANTS.COMBINATION_PERCENT;
  const wholeUnits = Math.floor(finishedUnits);
  const fractionalPart = finishedUnits - wholeUnits;
  const hasMushaProblem = fractionalPart > 0.01; // Threshold for showing warning

  return {
    finishedUnits,
    wholeUnits,
    fractionalPart,
    hasMushaProblem,
    totalValue: finishedUnits * CONSTANTS.MARKET_VALUE_PER_APARTMENT,
    equityRequired: 0, // No equity required in combination
    profit: finishedUnits * CONSTANTS.MARKET_VALUE_PER_APARTMENT,
  };
}

/**
 * Calculate Cost Plus Track (Construction Services)
 */
export function calculateCostPlusTrack(units) {
  const constructionCostPerUnit = CONSTANTS.CONSTRUCTION_COST_SQM * CONSTANTS.UNITS_PER_SQM;
  const entrepreneurFee = constructionCostPerUnit * CONSTANTS.ENTREPRENEUR_FEE_COST_PLUS;
  const totalCostPerUnit = constructionCostPerUnit + entrepreneurFee + CONSTANTS.BETTERMENT_LEVY_ESTIMATE;

  const finishedUnits = units;
  const totalEquityRequired = totalCostPerUnit * units;
  const totalMarketValue = finishedUnits * CONSTANTS.MARKET_VALUE_PER_APARTMENT;
  const totalProfit = totalMarketValue - totalEquityRequired;

  return {
    finishedUnits,
    equityRequiredPerUnit: totalCostPerUnit,
    totalEquityRequired,
    totalMarketValue,
    profit: totalProfit,
    profitPerUnit: totalProfit / units,
    constructionCost: constructionCostPerUnit,
    entrepreneurFee,
  };
}

/**
 * Calculate Revenue Sharing Track (Tmorot)
 */
export function calculateRevenueSharing(units) {
  // In Tmorot, the entrepreneur builds and you share the revenue
  // Typically 50-50 split, but can vary
  const revenueSharePercent = 0.45; // aligned with Simulator default
  const totalMarketValue = units * CONSTANTS.MARKET_VALUE_PER_APARTMENT;
  const yourShare = totalMarketValue * revenueSharePercent;

  return {
    finishedUnits: units,
    totalMarketValue,
    revenueSharePercent,
    yourShare,
    equityRequired: 0,
    profit: yourShare,
  };
}

/**
 * Calculate Cash Exit
 */
export function calculateCashExit(units) {
  const grossLandValue = units * CONSTANTS.LAND_VALUE_PER_UNIT_GROSS;
  const bettermentLevy = units * CONSTANTS.BETTERMENT_LEVY_ESTIMATE;
  const entrepreneurProfit = grossLandValue * CONSTANTS.CASH_EXIT_DISCOUNT;
  const netCashAmount = grossLandValue - bettermentLevy - entrepreneurProfit;

  return {
    grossLandValue,
    bettermentLevy,
    entrepreneurProfit,
    netCashAmount,
    equityRequired: 0,
    profit: netCashAmount,
  };
}

/**
 * Get recommended strategy based on land size
 */
export function getRecommendedStrategy(sqm, units) {
  // For 167 sqm (1.52 units)
  if (sqm >= 150 && sqm < 250) {
    const costPlus = calculateCostPlusTrack(1);
    const remainingUnits = units - 1;
    const cashExit = calculateCashExit(remainingUnits);

    return {
      strategy: 'mixed',
      title: 'אסטרטגיה מומלצת: משולב',
      description: `בנה דירה אחת בעלות+ ומכור את ${remainingUnits.toFixed(2)} זכויות במזומן כדי לממן את הבנייה`,
      details: {
        costPlusUnits: 1,
        costPlusEquity: costPlus.equityRequiredPerUnit,
        cashExitUnits: remainingUnits,
        cashReceived: cashExit.netCashAmount,
        netEquityNeeded: Math.max(0, costPlus.equityRequiredPerUnit - cashExit.netCashAmount),
        finalValue: costPlus.totalMarketValue,
        totalProfit: costPlus.totalMarketValue - Math.max(0, costPlus.equityRequiredPerUnit - cashExit.netCashAmount),
      }
    };
  }

  // For 334 sqm (3.04 units)
  if (sqm >= 250 && sqm < 420) {
    const combinationUnits = Math.floor(units * CONSTANTS.COMBINATION_PERCENT);
    const remainingUnits = units - (combinationUnits / CONSTANTS.COMBINATION_PERCENT);
    const combination = calculateCombinationTrack(combinationUnits / CONSTANTS.COMBINATION_PERCENT);
    const cashExit = calculateCashExit(remainingUnits);

    return {
      strategy: 'combination-cash',
      title: 'אסטרטגיה מומלצת: שילוב + מזומן',
      description: `קבל ${combinationUnits} דירה בשילוב ומכור ${remainingUnits.toFixed(2)} זכויות במזומן`,
      details: {
        combinationUnits,
        combinationValue: combination.totalValue,
        cashExitUnits: remainingUnits,
        cashReceived: cashExit.netCashAmount,
        totalValue: combination.totalValue + cashExit.netCashAmount,
        equityRequired: 0,
      }
    };
  }

  // For 501 sqm (4.55 units) and larger
  if (sqm >= 420) {
    const combination = calculateCombinationTrack(units);

    return {
      strategy: 'combination',
      title: 'אסטרטגיה מומלצת: שילוב',
      description: `קבל ${combination.wholeUnits} דירות בשילוב (35%)`,
      details: {
        wholeUnits: combination.wholeUnits,
        fractionalPart: combination.fractionalPart,
        totalValue: combination.totalValue,
        equityRequired: 0,
        warning: combination.hasMushaProblem ? 'שים לב: תהיה שותפות במושע בדירה נוספת' : null,
      }
    };
  }

  // Default: Cash Exit
  const cashExit = calculateCashExit(units);
  return {
    strategy: 'cash',
    title: 'אסטרטגיה מומלצת: יציאה במזומן',
    description: 'מכירת הזכויות במזומן',
    details: {
      cashReceived: cashExit.netCashAmount,
      equityRequired: 0,
    }
  };
}

/**
 * Format currency in ILS
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format number with commas
 */
export function formatNumber(num, decimals = 2) {
  return new Intl.NumberFormat('he-IL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
