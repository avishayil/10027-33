import { useState, useMemo, useCallback } from 'react';
import { computeSimulationTracks } from '../utils/simulationMath';

// Default configuration. שווי דירה נגזר מ-marketValueSqm × apartmentSizeSqm
export const DEFAULT_CONFIG = {
  combinationPct: 35,
  sqmPerUnit: 110,

  costPerSqm: 11000,
  apartmentSizeSqm: 100,
  entrepreneurMarkup: 14.5,

  vatRate: 18,
  requiredEquityPct: 25,

  marketValueSqm: 25000,
  /** ברוטו ליחידת זכות — בסיס למסלול מזומן; היטל השבחה מנוכה בנפרד בנוסחה */
  landValuePerUnit: 760000,
  entrepreneurProfitMargin: 18,

  bettermentLevyPerUnit: 160000,
  capitalGainsTax: 25,

  revenueSharePct: 45,
};

/**
 * Custom hook for managing simulation parameters and calculations
 */
export function useSimulation(initialLandArea = 167) {
  const [landArea, setLandArea] = useState(initialLandArea);
  const [config, setConfig] = useState(() => ({ ...DEFAULT_CONFIG }));

  const resetToDefaults = useCallback(() => {
    setConfig({ ...DEFAULT_CONFIG });
  }, []);

  const updateConfig = useCallback((key, value) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const tracks = useMemo(
    () => computeSimulationTracks(landArea, config),
    [landArea, config]
  );

  const marketValuePerApartment = config.marketValueSqm * config.apartmentSizeSqm;

  return {
    landArea,
    setLandArea,
    config,
    setConfig,
    updateConfig,

    units: tracks.units,
    marketValuePerApartment,
    landValuePerUnit: tracks.landValuePerUnit,

    combination: tracks.combination,
    costPlus: tracks.costPlus,
    revenueSharing: tracks.revenueSharing,
    cashExit: tracks.cashExit,

    resetToDefaults,
  };
}
