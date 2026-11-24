const currency = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** ₪ בשקלים שלמים. */
export function formatCurrency(amount) {
  return currency.format(Number.isFinite(amount) ? amount : 0);
}

/** מספר עם הפרדת אלפים ומספר ספרות קבוע אחרי הנקודה. */
export function formatNumber(num, decimals = 2) {
  return new Intl.NumberFormat('he-IL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(num) ? num : 0);
}

/** שטח במ״ר — עד 2 ספרות אחרי הנקודה, בלי אפסים מיותרים (167, 83.5). */
export function formatArea(num) {
  return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(Number.isFinite(num) ? num : 0);
}

/** שבר עשרוני כאחוז, למשל 0.0235 → "2.35%". */
export function formatPercent(fraction, decimals = 2) {
  return `${formatNumber(fraction * 100, decimals)}%`;
}
