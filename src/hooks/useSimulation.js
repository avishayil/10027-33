import { useCallback, useMemo, useState } from 'react';
import { DEFAULT_VERSION, getVersion } from '../data/parcel33';
import { computeSimulationTracks, computeTableRights } from '../utils/simulationMath';

/**
 * הנחות ברירת מחדל. היחידות, שווי הזכויות והיטל ההשבחה נגזרים מטבלת האיזון;
 * כאן רק הנחות שוק ועסקה שניתנות לשינוי בהגדרות המתקדמות.
 */
export const DEFAULT_CONFIG = {
  combinationPct: 35,
  /** ריק = לפי טבלת האיזון. מספר = דריסה ידנית של מ״ר קרקע ליח״ד. */
  sqmPerUnitOverride: null,

  costPerSqm: 11000,
  apartmentSizeSqm: 100,
  entrepreneurMarkup: 14.5,

  vatRate: 18,
  requiredEquityPct: 25,

  marketValueSqm: 25000,
  /** מחיר קרקע ברוטו למ״ר בחלקה — בסיס למסלול מזומן. תרחיש לא מאומת, לא הצעה קיימת. */
  landValuePerSqm: 6900,
  entrepreneurProfitMargin: 18,

  /** שיעור היטל ההשבחה מעליית השווי בין המצב הנכנס למצב היוצא. */
  bettermentLevyPct: 50,
  capitalGainsTax: 25,

  revenueSharePct: 45,
};

export function useSimulation(initialLandArea = 167) {
  const [landArea, setLandArea] = useState(initialLandArea);
  const [versionId, setVersionIdState] = useState(DEFAULT_VERSION);
  const [lotId, setLotId] = useState(() => getVersion(DEFAULT_VERSION).lots[0].id);
  const [config, setConfig] = useState(() => ({ ...DEFAULT_CONFIG }));

  const setVersionId = useCallback((next) => {
    setVersionIdState(next);
    // מספרי המגרשים שונים בין הגרסאות — חוזרים למגרש הראשון של הגרסה
    setLotId(getVersion(next).lots[0].id);
  }, []);

  const resetToDefaults = useCallback(() => setConfig({ ...DEFAULT_CONFIG }), []);

  const updateConfig = useCallback((key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const rights = useMemo(
    () => computeTableRights(landArea, versionId, lotId, config.bettermentLevyPct),
    [landArea, versionId, lotId, config.bettermentLevyPct],
  );

  const tracks = useMemo(
    () => computeSimulationTracks(landArea, rights, config),
    [landArea, rights, config],
  );

  return {
    landArea,
    setLandArea,
    versionId,
    setVersionId,
    lotId,
    setLotId,
    config,
    updateConfig,
    resetToDefaults,
    rights,
    tracks,
  };
}
