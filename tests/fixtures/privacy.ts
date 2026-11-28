/** Israeli ID check digit (Luhn variant): a 9-digit number that passes it may be a personal identifier. */
export function validIsraeliId(s: string): boolean {
  let t = 0;
  for (let i = 0; i < 9; i += 1) {
    const d = Number(s[i]) * (i % 2 === 0 ? 1 : 2);
    t += d > 9 ? d - 9 : d;
  }
  return t % 10 === 0;
}
