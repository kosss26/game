import { storyClocks, storyTimeOf } from "../story-clock";
import { loadContent } from "@/lib/content/loader";
import type { HistoryEntry } from "@/lib/types/database";

describe("storyTimeOf", () => {
  test.each([
    ["21:00", "21:00"],
    ["23:52. Пётр Ильич всё ещё у своего монитора.", "23:52"],
    ["Вторник, 17 ноября · 17:40 · Ильинка, дом деда", "17:40"],
    ["Ранее этим утром · 07:40", "07:40"],
    ["Год спустя · 20 ноября · 21:07", "21:07"],
    ["00:00:00", "00:00"],
    ["04:43:57", "04:43"],
    ["У Аси на часах 03:12", "03:12"],
    ["🔴 05:58 · В эфире — звонок с телефона из элеватора", "05:58"],
    ["22:20 · Уведомление «Небо сегодня»: Пик Персеид — сегодня в 04:30!", "22:20"],
    ["8:05", "08:05"],
  ])("%s → %s", (text, time) => expect(storyTimeOf(text)).toBe(time));

  test.each([
    "Вы прочитали это в воскресенье, в 08:20.",
    "Ника · была в сети в 02:18",
    "Окно: 12 из 40 секунд",
    "Весовой датчик, объект 7: 3 214 г",
    "Перед началом",
    "25:10",
  ])("без отметки: %s", text => expect(storyTimeOf(text)).toBeNull());
});

describe("storyClocks", () => {
  const e = (id: string, kind: HistoryEntry["kind"], text: string, thread?: string): HistoryEntry =>
    ({ id, kind, speaker: kind === "system" ? "system" : kind === "reply" ? "me" : "npc", text, at: 0, ...(thread ? { thread } : {}) });

  test("до первой отметки времени нет, дальше — последняя отметка из любого чата", () => {
    const log = [e("a", "message", "привет"), e("b", "system", "19:40", "roman"), e("c", "message", "ты не спишь?", "roman"), e("d", "reply", "Сплю", "marina"), e("e", "system", "Девять минут спустя"), e("f", "message", "ок")];
    const clocks = storyClocks(log);
    expect(log.map(x => clocks.get(x))).toEqual([null, "19:40", "19:40", "19:40", "19:40", "19:40"]);
  });

  test("в каждой главе каждой истории есть хотя бы одна отметка времени", () => {
    const without: string[] = [];
    for (const story of loadContent()) for (const day of story.days) {
      const has = day.script.split("\n").some(l => l.trim().startsWith("SYS:") && storyTimeOf(l.trim().slice(4).trim()));
      if (!has) without.push(`${story.slug}/${day.file}`);
    }
    expect(without).toEqual([]);
  });
});
