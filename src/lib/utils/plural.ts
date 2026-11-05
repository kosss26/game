/** Русское склонение по числу: plural(5, "глава", "главы", "глав") → "глав" */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function chaptersLabel(n: number): string {
  return `${n} ${plural(n, "глава", "главы", "глав")}`;
}
