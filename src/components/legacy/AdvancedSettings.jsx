import { Slider } from '../Slider';
import { Tooltip } from '../Tooltip';
import { TOOLTIPS } from '../../content/tooltips';
import { formatCurrency, formatNumber } from '../../utils/format';

const GROUPS = [
  {
    title: 'עסקה',
    fields: [
      { key: 'combinationPct', label: 'אחוז קומבינציה', min: 20, max: 60, step: 1, unit: '%', tooltip: TOOLTIPS.combination },
      { key: 'revenueSharePct', label: 'אחוז תמורות', min: 30, max: 70, step: 1, unit: '%' },
      { key: 'landValuePerSqm', label: 'מחיר קרקע למ״ר (מזומן)', min: 3000, max: 12000, step: 100, unit: '₪', tooltip: TOOLTIPS.landValuePerSqm },
      { key: 'entrepreneurProfitMargin', label: 'רווח יזמי במזומן', min: 10, max: 30, step: 1, unit: '%' },
    ],
  },
  {
    title: 'בנייה ומימון',
    fields: [
      { key: 'costPerSqm', label: 'עלות בנייה למ״ר (לפני מע״מ)', min: 8000, max: 15000, step: 100, unit: '₪' },
      { key: 'apartmentSizeSqm', label: 'גודל דירה', min: 60, max: 140, step: 5, unit: 'מ״ר' },
      { key: 'entrepreneurMarkup', label: 'עמלת יזם (עלות+)', min: 10, max: 25, step: 0.5, unit: '%' },
      { key: 'requiredEquityPct', label: 'הון עצמי נדרש', min: 15, max: 40, step: 5, unit: '%' },
    ],
  },
  {
    title: 'שוק ומיסוי',
    fields: [
      { key: 'marketValueSqm', label: 'שווי שוק למ״ר דירה', min: 15000, max: 35000, step: 500, unit: '₪' },
      { key: 'bettermentLevyPct', label: 'היטל השבחה (מעליית השווי)', min: 0, max: 50, step: 1, unit: '%', tooltip: TOOLTIPS.bettermentLevy },
      { key: 'capitalGainsTax', label: 'מס שבח', min: 0, max: 50, step: 1, unit: '%', tooltip: TOOLTIPS.capitalGainsTax },
      { key: 'vatRate', label: 'מע״מ', min: 0, max: 25, step: 1, unit: '%' },
    ],
  },
];

export function AdvancedSettings({ config, updateConfig, resetToDefaults, marketValuePerApartment, tableSqmPerUnit }) {
  return (
    <details className="card">
      <summary>
        <span>
          הגדרות מתקדמות
          <span className="summary-sub">הנחות שוק ועסקה — כל הכרטיסים מתעדכנים מיד</span>
        </span>
      </summary>

      {GROUPS.map((g) => (
        <div key={g.title} className="settings-group">
          <h3>{g.title}</h3>
          <div className="settings-grid">
            {g.fields.map((f) => (
              <Slider
                key={f.key}
                label={f.label}
                value={config[f.key]}
                onChange={(v) => updateConfig(f.key, v)}
                min={f.min}
                max={f.max}
                step={f.step}
                unit={f.unit}
                tooltip={f.tooltip}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="settings-group">
        <h3>זכויות</h3>
        <div className="settings-grid">
          <label className="setting">
            <span className="setting-label">
              דריסת מ״ר קרקע ליח״ד
              <Tooltip content={TOOLTIPS.sqmPerUnitOverride} />
            </span>
            <span className="setting-controls">
              <input
                type="number"
                min={20}
                max={200}
                step={1}
                placeholder="לפי הטבלה"
                value={config.sqmPerUnitOverride ?? ''}
                onChange={(e) =>
                  updateConfig('sqmPerUnitOverride', e.target.value === '' ? null : Number(e.target.value))
                }
              />
              <span className="setting-unit">ריק = לפי הטבלה ({formatNumber(tableSqmPerUnit, 1)})</span>
            </span>
          </label>
        </div>
      </div>

      <p className="field-hint">
        שווי דירה מוגמרת לפי ההגדרות: {formatCurrency(marketValuePerApartment)} ({formatCurrency(config.marketValueSqm)} ×{' '}
        {config.apartmentSizeSqm} מ״ר).
      </p>
      <div className="settings-actions">
        <button type="button" className="btn-primary" onClick={resetToDefaults}>
          איפוס להגדרות המקוריות
        </button>
      </div>
    </details>
  );
}
