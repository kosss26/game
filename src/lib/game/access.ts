/**
 * Правила доступа к дням истории (чистая функция — покрыта тестами).
 *
 * День N доступен, если:
 *  - он опубликован и наступил его unlock_at (глобальная дата релиза);
 *  - N = 1, либо день N-1 завершён и прошло wait_hours после завершения;
 *  - ожидание можно пропустить: покупка skip_day за Stars / бонусный пропуск / сезонный пропуск.
 */

import type { Day, Progress, Purchase } from "@/lib/types/database";

export type DayStatus =
  | "completed"
  | "in_progress"
  | "available"
  | "waiting"
  | "locked"
  | "not_released";

export interface DayAccess {
  dayId: string;
  dayNumber: number;
  title: string;
  minutes: number | null;
  status: DayStatus;
  /** Когда откроется (для waiting / not_released), ISO */
  unlocksAt: string | null;
  /** Можно ли пропустить ожидание покупкой */
  skippable: boolean;
  /** Сколько часов глава ждёт после завершения предыдущей (0 — открывается сразу) */
  waitHours: number;
}

export interface AccessInput {
  days: Day[];
  progresses: Array<Pick<Progress, "day_id" | "completed" | "completed_at">>;
  purchases: Array<Pick<Purchase, "product" | "day_number">>;
  now: number;
  isAdmin?: boolean;
  /** Бесплатный режим: без ожидания между главами */
  freeAccess?: boolean;
  defaultWaitHours: number;
}

export function hasSeasonPass(purchases: AccessInput["purchases"]): boolean {
  return purchases.some(p => p.product === "season_pass");
}

export function computeAccess(input: AccessInput): DayAccess[] {
  const days = [...input.days].filter(d => d.status === "published").sort((a, b) => a.day_number - b.day_number);
  const progressByDay = new Map(input.progresses.map(p => [p.day_id, p]));
  const pass = hasSeasonPass(input.purchases) || !!input.freeAccess;
  const skipped = new Set(input.purchases.filter(p => p.product === "skip_day").map(p => p.day_number));

  const out: DayAccess[] = [];
  let prevCompletedAt: number | null = null;
  let prevCompleted = true;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const progress = progressByDay.get(day.id);
    const base = {
      dayId: day.id,
      dayNumber: day.day_number,
      title: day.title,
      minutes: day.estimated_minutes,
      unlocksAt: null as string | null,
      skippable: false,
      waitHours: i === 0 || pass || skipped.has(day.day_number) ? 0 : Math.max(0, day.meta?.wait_hours ?? input.defaultWaitHours),
    };

    const releaseAt = day.unlock_at ? new Date(day.unlock_at).getTime() : null;
    let status: DayStatus;
    let unlocksAt: string | null = null;
    let skippable = false;

    if (progress?.completed) {
      status = "completed";
    } else if (input.isAdmin) {
      status = progress ? "in_progress" : "available";
    } else if (releaseAt && releaseAt > input.now) {
      status = "not_released";
      unlocksAt = new Date(releaseAt).toISOString();
    } else if (progress) {
      status = "in_progress";
    } else if (i === 0) {
      status = "available";
    } else if (!prevCompleted) {
      status = "locked";
    } else {
      const waitHours = day.meta?.wait_hours ?? input.defaultWaitHours;
      const readyAt = (prevCompletedAt ?? 0) + waitHours * 3_600_000;
      if (readyAt > input.now && !pass && !skipped.has(day.day_number)) {
        status = "waiting";
        unlocksAt = new Date(readyAt).toISOString();
        skippable = true;
      } else {
        status = "available";
      }
    }

    out.push({ ...base, status, unlocksAt, skippable });
    prevCompleted = !!progress?.completed;
    prevCompletedAt = progress?.completed_at ? new Date(progress.completed_at).getTime() : prevCompleted ? input.now : null;
  }
  return out;
}

export function canPlay(a: DayAccess | undefined): boolean {
  return !!a && (a.status === "available" || a.status === "in_progress" || a.status === "completed");
}
