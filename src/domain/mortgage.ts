/** Standard amortising mortgage formulas (nominal annual rate, monthly payments). */

export function mortgageCapacity(monthlyPayment: number, annualRate: number, years: number): number {
  if (!(monthlyPayment > 0) || !(years > 0)) return 0;
  const n = years * 12;
  const r = annualRate / 12;
  if (r === 0) return monthlyPayment * n;
  return (monthlyPayment * (1 - Math.pow(1 + r, -n))) / r;
}

export function monthlyPayment(principal: number, annualRate: number, years: number): number {
  if (!(principal > 0) || !(years > 0)) return 0;
  const n = years * 12;
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function remainingBalance(principal: number, annualRate: number, years: number, monthsPaid: number): number {
  const p = monthlyPayment(principal, annualRate, years);
  const r = annualRate / 12;
  if (r === 0) return Math.max(0, principal - p * monthsPaid);
  const g = Math.pow(1 + r, monthsPaid);
  return Math.max(0, principal * g - (p * (g - 1)) / r);
}
