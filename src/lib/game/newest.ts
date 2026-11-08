import type { Story } from "@/lib/types/database";

/** Истории, залитые одной пачкой (сид, миграция), считаем созданными одновременно. */
const SAME_BATCH_MS = 10 * 60_000;

/**
 * Самая новая история каталога. Сначала — по дате создания; среди созданных
 * одной пачкой решает порядок в каталоге (sort_order: меньше — выше), иначе
 * «новинкой» оказывается та, что случайно вставилась в базу последней.
 */
export function newestStory<T extends Pick<Story, "created_at" | "sort_order">>(list: T[]): T | undefined {
  if (list.length === 0) return undefined;
  const time = (s: T) => Date.parse(s.created_at || "") || 0;
  const latest = Math.max(...list.map(time));
  return list
    .filter(s => latest - time(s) < SAME_BATCH_MS)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || time(b) - time(a))[0];
}
