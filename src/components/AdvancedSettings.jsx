import { useState } from 'react';
import { Settings, ChevronRight, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Slider } from './Slider';
import { Tooltip } from './Tooltip';
import { TOOLTIPS } from '../content/tooltips';
import { formatCurrency } from '../utils/calculations';

export function AdvancedSettings({ simulation }) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    config,
    updateConfig,
    resetToDefaults,
    marketValuePerApartment,
  } = simulation;

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-800 text-white min-h-12 min-w-12 p-3 sm:p-4 rounded-full shadow-2xl hover:bg-slate-900 transition-all hover:scale-110 border-2 border-slate-700 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        aria-label="הגדרות מתקדמות"
        aria-expanded={isOpen}
      >
        <Settings className="w-6 h-6 sm:w-7 sm:h-7" />
      </button>

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 left-0 h-[100dvh] w-full max-w-[min(100vw,24rem)] sm:max-w-none sm:w-96 bg-white shadow-2xl z-40 transition-transform duration-300 overflow-y-auto overscroll-contain pt-[env(safe-area-inset-top)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 sm:p-6 space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Settings className="w-6 h-6" />
              הגדרות מתקדמות
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="min-h-11 min-w-11 flex items-center justify-center p-2 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="סגור הגדרות מתקדמות"
            >
              <ChevronRight className="w-5 h-5" aria-hidden />
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={resetToDefaults}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            איפוס להגדרות מקוריות
          </button>

          {/* Project Constants */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">
              קבועי פרויקט
            </h3>

            <SettingItem
              label="אחוז קומבינציה"
              value={config.combinationPct}
              onChange={(v) => updateConfig('combinationPct', v)}
              min={20}
              max={50}
              step={1}
              unit="%"
              tooltip={TOOLTIPS.combination}
            />

            <SettingItem
              label="מ״ר ליחידה"
              value={config.sqmPerUnit}
              onChange={(v) => updateConfig('sqmPerUnit', v)}
              min={80}
              max={150}
              step={5}
              unit="מ״ר"
              tooltip={TOOLTIPS.density}
            />

            <SettingItem
              label="היטל השבחה"
              value={config.bettermentLevyPerUnit / 1000}
              onChange={(v) => updateConfig('bettermentLevyPerUnit', v * 1000)}
              min={100}
              max={300}
              step={10}
              unit="K ₪"
              tooltip={TOOLTIPS.bettermentLevy}
            />
          </div>

          {/* Construction */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">
              בנייה
            </h3>

            <SettingItem
              label="עלות בנייה למ״ר"
              value={config.costPerSqm}
              onChange={(v) => updateConfig('costPerSqm', v)}
              min={8000}
              max={15000}
              step={100}
              unit="₪"
              tooltip="עלות בנייה כוללת מע״ם למטר רבוע"
            />

            <SettingItem
              label="דמי יזם"
              value={config.entrepreneurMarkup}
              onChange={(v) => updateConfig('entrepreneurMarkup', v)}
              min={10}
              max={25}
              step={0.5}
              unit="%"
              tooltip={TOOLTIPS.entrepreneurialProfit}
            />
          </div>

          {/* Financing */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">
              מימון
            </h3>

            <SettingItem
              label="הון עצמי נדרש (מסך עלות)"
              value={config.requiredEquityPct}
              onChange={(v) => updateConfig('requiredEquityPct', v)}
              min={15}
              max={40}
              step={5}
              unit="%"
              tooltip="אחוז מהסך הכולל של עלות שירותי הבנייה המשמש להערכת סף הון עצמי (לדוגמה לפי דרישות בנקאיות נפוצות). מוצג בכרטיס שירותי בנייה ליד סף ההון."
            />
          </div>

          {/* Market */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">
              שוק
            </h3>

            <SettingItem
              label="שווי שוק למ״ר"
              value={config.marketValueSqm}
              onChange={(v) => updateConfig('marketValueSqm', v)}
              min={15000}
              max={35000}
              step={500}
              unit="₪"
              tooltip="שווי שוק ממוצע למטר רבוע של דירה מוגמרת"
            />
            <p className="text-xs text-slate-600 -mt-2">
              שווי דירה מחושב ({config.apartmentSizeSqm} מ״ר):{' '}
              <span className="font-semibold text-slate-800">
                {formatCurrency(marketValuePerApartment)}
              </span>
            </p>

            <SettingItem
              label="רווח יזמי (יציאה)"
              value={config.entrepreneurProfitMargin}
              onChange={(v) => updateConfig('entrepreneurProfitMargin', v)}
              min={10}
              max={30}
              step={1}
              unit="%"
              tooltip={TOOLTIPS.entrepreneurialProfit}
            />

            <SettingItem
              label="אחוז תמורות"
              value={config.revenueSharePct}
              onChange={(v) => updateConfig('revenueSharePct', v)}
              min={30}
              max={70}
              step={5}
              unit="%"
              tooltip={TOOLTIPS.revenueSharing}
            />
          </div>

          {/* Taxation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 border-b pb-2">
              מיסוי
            </h3>

            <SettingItem
              label="מס רווח הון"
              value={config.capitalGainsTax}
              onChange={(v) => updateConfig('capitalGainsTax', v)}
              min={20}
              max={50}
              step={1}
              unit="%"
              tooltip="מס שבח - מס על רווח הון מממכירת נדל״ן"
            />
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// Setting Item Component
function SettingItem({ label, value, onChange, min, max, step, unit, tooltip }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
          {label}
          {tooltip && <Tooltip content={tooltip} />}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-20 px-2 py-1 text-sm text-center border border-slate-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            min={min}
            max={max}
            step={step}
          />
          <span className="text-sm text-slate-600 w-12">{unit}</span>
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
