/** Labels and wording for price thresholds (shared by the summary, the verdict and the detail sections). */
import type { PriceKnob } from '../../domain/types';
import { formatCurrency, formatNumber } from '../../utils/format';

export const KNOB_LABELS: Record<PriceKnob, string> = {
  developer_price: 'מחיר שהיזם ישלם על הזכויות',
  post_approval_price: 'מחיר קרקע בשוק אחרי אישור התכנית',
  immediate_price: 'מחיר מכירה בשוק היום',
  revenue_share: 'אחוז התמורות מהכנסות המכירה',
  buyback_factor: 'פיצוי על חלק הדירה (ביחס לשווי שוק)',
  complementary_price: 'מחיר שתשלמו על זכויות משלימות',
};

/** An annual rate to two decimals (7.97%). */
export const formatRate = (x: number) => `${formatNumber(x * 100, 2)}%`;

/** The highest tax-loan rate at which a route still fits; the search stops at 30%. */
export function maxRateText(x: number | null): string | null {
  if (x === null) return null;
  return x >= 0.299 ? 'מתאים גם בריבית של 30% ומעלה' : `מתאים עד ריבית של כ-${formatRate(x)}`;
}

/** "לפחות X" for a price you receive, "לכל היותר X" for a price you pay. */
export function thresholdBound(t: { knob: PriceKnob; required: number | null; direction: 'min' | 'max' }): string {
  if (t.required === null) return formatKnob(t.knob, null);
  return `${t.direction === 'max' ? 'לכל היותר' : 'לפחות'} ${formatKnob(t.knob, t.required)}`;
}

export function formatKnob(knob: PriceKnob, x: number | null): string {
  if (x === null) return 'לא נמצא בטווח סביר';
  if (knob === 'revenue_share' || knob === 'buyback_factor') return `${formatNumber(x * 100, 0)}%`;
  return `${formatCurrency(x)} למ״ר קרקע`;
}
