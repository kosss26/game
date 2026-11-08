/**
 * Время истории для пузырей чата.
 *
 * На пузырях показываем не часы устройства, а время внутри сюжета: последнюю
 * отметку времени из системной строки главы («21:00», «Вторник, 17 ноября · 17:40»,
 * «У Аси на часах 03:12»). До первой отметки время не показывается вовсе.
 * Считается по полной истории главы (все чаты), поэтому работает и для старых
 * сохранений, где отметок на сообщениях нет.
 */
import type { HistoryEntry } from "@/lib/types/database";

const AT_START = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?!\d)/;
const ON_WATCH = /на часах\s+(\d{1,2}):(\d{2})(?!\d)/i;

function valid(h: string, m: string): string | null {
  const hh = Number(h), mm = Number(m);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Время, которое задаёт системная строка, или null.
 * Учитывается только время в начале строки, в начале сегмента после «·»
 * или после «на часах» — чтобы «Пик Персеид в 04:30» внутри текста не сдвигал часы.
 */
export function storyTimeOf(text: string): string | null {
  const clean = text.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const segments = clean.split("·").map(s => s.trim());
  for (const segment of segments) {
    const m = segment.match(AT_START);
    if (m) return valid(m[1], m[2]);
  }
  const w = clean.match(ON_WATCH);
  return w ? valid(w[1], w[2]) : null;
}

/** Время истории для каждой записи главы: последняя отметка до неё включительно. */
export function storyClocks(entries: HistoryEntry[]): WeakMap<HistoryEntry, string | null> {
  const out = new WeakMap<HistoryEntry, string | null>();
  let clock: string | null = null;
  for (const entry of entries) {
    if (entry.kind === "system") {
      const t = storyTimeOf(entry.text);
      if (t) clock = t;
    }
    out.set(entry, clock);
  }
  return out;
}
