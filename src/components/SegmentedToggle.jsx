/** מתג בחירה (segmented control), כמו בורר הגרסאות ב-compound-13-tables. */
export function SegmentedToggle({ options, value, onChange, label, large = false }) {
  return (
    <div
      className={large ? 'mode-toggle mode-toggle-main' : 'mode-toggle'}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
