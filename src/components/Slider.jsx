import { Tooltip } from './Tooltip';

/** הגדרה מספרית: סרגל + שדה מספר. */
export function Slider({ label, value, onChange, min, max, step = 1, unit, tooltip }) {
  const set = (raw) => {
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(n);
  };
  return (
    <label className="setting">
      <span className="setting-label">
        {label}
        {tooltip && <Tooltip content={tooltip} />}
      </span>
      <span className="setting-controls">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => set(e.target.value)}
          aria-label={label}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => set(e.target.value)}
          aria-label={`${label} (ערך)`}
        />
        {unit && <span className="setting-unit">{unit}</span>}
      </span>
    </label>
  );
}
