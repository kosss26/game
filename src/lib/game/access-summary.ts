import type { DayAccess } from "./access";
import { plural } from "@/lib/utils/plural";

export interface AccessSummaryInput {
  days: Pick<DayAccess, "status" | "waitHours">[];
  storyFree: boolean;
  freeAccess: boolean;
  hasPass: boolean;
  paymentsEnabled: boolean;
  prices: { skipDay: number; seasonPass: number };
  finished: boolean;
}

const hours = (n: number) => plural(n, "час", "часа", "часов");

/**
 * Как открываются главы — одной строкой на странице истории, до того как игрок
 * упрётся в ожидание. null — объяснять нечего (бесплатно, пропуск, пройдено).
 */
export function accessSummary(v: AccessSummaryInput): string | null {
  if (v.storyFree || v.finished) return null;
  if (v.freeAccess) return "Сейчас все главы открываются сразу, без ожидания.";
  if (v.hasPass) return null;
  const waits = v.days.filter(day => day.status !== "completed" && day.waitHours > 0).map(day => day.waitHours);
  if (!waits.length) return null;
  const min = Math.min(...waits), max = Math.max(...waits);
  const span = min === max ? `${max} ${hours(max)}` : `${min}–${max} ${hours(max)}`;
  const base = `Каждая следующая глава открывается через ${span} после предыдущей.`;
  if (!v.paymentsEnabled) return base;
  return `${base} Можно не ждать: глава — ${v.prices.skipDay} ⭐, вся история — ${v.prices.seasonPass} ⭐.`;
}
