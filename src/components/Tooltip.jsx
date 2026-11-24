/** סימן ⓘ עם הסבר שמופיע בריחוף או במיקוד מקלדת. */
export function Tooltip({ content, label = 'הסבר' }) {
  return (
    <span className="tip" tabIndex={0} role="note" aria-label={`${label}: ${content}`}>
      i
      <span className="tip-bubble" aria-hidden="true">
        {content}
      </span>
    </span>
  );
}
