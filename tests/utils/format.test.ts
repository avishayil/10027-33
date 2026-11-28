/** Compact money in Hebrew: exact below ₪10,000, thousands below a million, millions above — never "1,000 אלף". */
import { describe, expect, it } from 'vitest';
import { formatCompactCurrency, formatCurrency } from '../../src/utils/format';

// Intl may insert direction marks and non-breaking spaces; compare on plain text.
const plain = (s: string) => s.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\u00a0/g, ' ');
const c = (x: number) => plain(formatCompactCurrency(x));

describe('formatCompactCurrency', () => {
  it('exact below ₪10,000', () => {
    expect(c(9_999)).toBe(plain(formatCurrency(9_999)));
    expect(c(0)).toBe(plain(formatCurrency(0)));
  });
  it('thousands from ₪10,000 to just under a million', () => {
    expect(c(10_000)).toBe('10 אלף ₪');
    expect(c(202_321)).toBe('202 אלף ₪');
    expect(c(999_499)).toBe('999 אלף ₪');
  });
  it('rounding up to a thousand thousands is a million — never "1,000 אלף"', () => {
    expect(c(999_500)).toBe('1 מיליון ₪');
    expect(c(999_999)).toBe('1 מיליון ₪');
    expect(c(1_000_000)).toBe('1 מיליון ₪');
  });
  it('millions with up to two decimals and no trailing zeros', () => {
    expect(c(1_250_000)).toBe('1.25 מיליון ₪');
    expect(c(1_500_000)).toBe('1.5 מיליון ₪');
    expect(c(2_307_793)).toBe('2.31 מיליון ₪');
    expect(c(27_950_000)).toBe('27.95 מיליון ₪');
    expect(c(1_004_999)).toBe('1 מיליון ₪');
  });
  it('negative amounts keep their sign at every scale', () => {
    expect(c(-202_321)).toMatch(/^-\s?202 אלף ₪$/);
    expect(c(-999_700)).toMatch(/^-\s?1 מיליון ₪$/);
    expect(c(-1_500_000)).toMatch(/^-\s?1.5 מיליון ₪$/);
  });
  it('non-finite values do not crash', () => {
    expect(c(Number.NaN)).toBe(plain(formatCurrency(0)));
  });
});
