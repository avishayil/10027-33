import { useState } from 'react';
import { SegmentedToggle } from './SegmentedToggle';
import { PARCEL } from '../data/parcel33';
import { parseParcelFraction } from '../utils/simulationMath';
import { formatArea, formatNumber } from '../utils/format';

const PRESETS = [
  { area: 83.5, label: '83.5 מ״ר (167/42516)' },
  { area: 167, label: '167 מ״ר' },
  { area: 334, label: '334 מ״ר' },
  { area: 501, label: '501 מ״ר' },
];

const MODES = [
  { value: 'sqm', label: 'לפי מ״ר' },
  { value: 'fraction', label: 'לפי שבר בחלקה' },
];

export function LandInput({ landArea, onLandAreaChange, version, lotId, onLotChange }) {
  const [mode, setMode] = useState('sqm');
  const [fractionText, setFractionText] = useState('167/21258');
  const [error, setError] = useState(null);

  const handleFraction = (text) => {
    setFractionText(text);
    try {
      onLandAreaChange(parseParcelFraction(text));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMode = (next) => {
    setMode(next);
    setError(null);
    if (next === 'fraction') handleFraction(fractionText);
  };

  return (
    <div className="card">
      <h2>הזכויות שלכם בחלקה</h2>
      <p className="card-sub">
        גוש {PARCEL.gush} חלקה {PARCEL.parcel} — {formatNumber(PARCEL.area, 0)} מ״ר. השבר שלכם מופיע
        בטבלה ובנסח הטאבו (למשל 167/21258).
      </p>

      <SegmentedToggle options={MODES} value={mode} onChange={handleMode} label="אופן הזנה" />

      <div className="field-row" style={{ marginTop: 14 }}>
        {mode === 'sqm' ? (
          <label className="field">
            <span>שטח בחלקה (מ״ר)</span>
            <input
              className="input-large"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={landArea}
              onChange={(e) => onLandAreaChange(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        ) : (
          <label className="field">
            <span>שבר בחלקה (מונה/מכנה)</span>
            <input
              className="input-large"
              type="text"
              dir="ltr"
              inputMode="numeric"
              value={fractionText}
              onChange={(e) => handleFraction(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </label>
        )}
      </div>

      {mode === 'sqm' ? (
        <div className="presets" aria-label="שטחים נפוצים בחלקה">
          {PRESETS.map((p) => (
            <button
              key={p.area}
              type="button"
              className={landArea === p.area ? 'btn-chip active' : 'btn-chip'}
              onClick={() => onLandAreaChange(p.area)}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="field-hint">
          = {formatArea(landArea)} מ״ר בחלקה
        </p>
      )}

      <p className="sub-title">המגרש שהוקצה לכם ({version.shortLabel})</p>
      {version.lots.length > 1 ? (
        <SegmentedToggle
          options={version.lots.map((l) => ({ value: l.id, label: `מגרש ${l.id}` }))}
          value={lotId}
          onChange={onLotChange}
          label="מגרש בהקצאה"
        />
      ) : (
        <p className="owner-selected" style={{ marginTop: 0 }}>
          מגרש {version.lots[0].id} — {version.lots[0].use}
        </p>
      )}
      <p className="field-hint">{version.lotsNote}</p>
    </div>
  );
}
