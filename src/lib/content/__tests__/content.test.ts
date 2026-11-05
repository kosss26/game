/**
 * Проверка всего контента: каждый день парсится без ошибок, все метки на месте,
 * случайные прохождения всегда доходят до конца, все концовки достижимы.
 */
import { loadContent } from "../loader";
import { parseDayScript } from "../importer";
import { convertToDbFormat } from "@/lib/parser/dsl-parser";
import { buildRuntime, resolve, applyChoice, applyInput, nextAfter } from "@/lib/engine/runtime";
import type { Flags, SnapshotData } from "@/lib/types/database";

const stories = loadContent();

function toSnapshot(script: string, characters: Record<string, { name: string }>, chats: Record<string, { name: string }> = {}): SnapshotData {
  const parsed = parseDayScript(script, characters, chats);
  if (parsed.errors.length) throw new Error(parsed.errors.map(e => `${e.line}: ${e.message}`).join("\n"));
  const db = convertToDbFormat(parsed);
  return {
    day: { story_id: "s", day_number: 1, title: "", unlock_at: null, estimated_minutes: null, status: "published", meta: null },
    scenes: db.scenes.map((s, i) => ({ id: `s${i}`, sort_index: i, type: s.type, speaker: s.speaker ?? null, text: s.text ?? null, meta: s.meta ?? null, next_scene_id: null, tag: s.tag ?? null })),
    choices: db.choices.map((c, i) => ({ id: `c${i}`, scene_id: `s${c.scene_index}`, label: c.label, goto_tag: c.goto_tag ?? null, goto_scene_id: null, set_flags: c.set_flags ?? null, condition: c.condition ?? null, sort_index: c.sort_index })),
  };
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

describe.each(stories.map(s => [s.slug, s] as const))("контент: %s", (_slug, story) => {
  const characters = story.meta.characters || {};
  const snapshots = story.days.map(d => ({ n: d.number, snap: toSnapshot(d.script, characters, story.meta.chats || {}) }));

  it("дни идут подряд с 1", () => {
    expect(story.days.map(d => d.number)).toEqual(story.days.map((_, i) => i + 1));
  });

  it("подстановки {flag} ссылаются только на флаги, которые где-то задаются", () => {
    const assigned = new Set<string>(["name"]);
    for (const { snap } of snapshots) {
      for (const sc of snap.scenes) {
        if (sc.meta?.input_key) assigned.add(sc.meta.input_key);
        for (const op of sc.meta?.ops || []) {
          const m = op.replace(/^flag:/i, "").match(/^!?\s*([\p{L}_][\p{L}\p{N}_.]*)/u);
          if (m) assigned.add(m[1]);
        }
      }
      for (const c of snap.choices) for (const k of Object.keys(c.set_flags || {})) assigned.add(k);
    }
    const unknown: string[] = [];
    for (const { n, snap } of snapshots) {
      for (const sc of snap.scenes) {
        for (const m of (sc.text || "").matchAll(/\{([^}|]+)\}/g)) if (!assigned.has(m[1])) unknown.push(`день ${n}: {${m[1]}}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it("в каждом чате пишут только его участники", () => {
    const problems: string[] = [];
    for (const d of story.days) {
      const r = parseDayScript(d.script, characters, story.meta.chats || {});
      const chats = { ...(story.meta.chats || {}), ...r.dayMeta.chats };
      if (Object.keys(chats).length === 0) continue;
      for (const sc of r.scenes) {
        if (sc.type !== "message" || sc.speaker !== "npc" || !sc.meta.thread) continue;
        const c = chats[sc.meta.thread];
        if (!c) continue;
        if (c.kind === "group") {
          const allowed = [...(c.members || []), ...(c.also || [])];
          if (!allowed.includes(sc.meta.character || "")) problems.push(`${d.file}:${sc.line} ${sc.meta.character} пишет в группу «${c.name}»`);
          continue;
        }
        if (c.character !== sc.meta.character && !(c.also || []).includes(sc.meta.character || "")) problems.push(`${d.file}:${sc.line} ${sc.meta.character} пишет в чат «${c.name}»`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("случайные прохождения завершаются, все концовки достижимы", () => {
    const endings = new Map<string, number>();
    const runtimes = snapshots.map(s => buildRuntime(s.snap));
    for (let run = 0; run < 3000; run++) {
      const r = rand(run + 1);
      let flags: Flags = {};
      let lastEnding: string | null = null;
      for (const rt of runtimes) {
        let pointer = rt.firstSceneId;
        let steps = 0;
        for (;;) {
          if (++steps > 5000) throw new Error("день не завершается");
          const res = resolve(rt, pointer, flags);
          flags = res.flags;
          const st = res.step;
          if (st.kind === "end") {
            lastEnding = st.ending;
            break;
          }
          if (st.kind === "choice") {
            const opt = st.options[Math.floor(r() * st.options.length)];
            ({ pointer, flags } = applyChoice(rt, st.scene.id, opt, flags));
          } else if (st.kind === "input") {
            ({ pointer, flags } = applyInput(rt, st.scene.id, st.key, "Тест", flags));
          } else {
            pointer = nextAfter(rt, st.scene.id);
          }
        }
      }
      if (lastEnding) endings.set(lastEnding, (endings.get(lastEnding) || 0) + 1);
    }
    const declared = Object.keys(story.meta.endings || {});
    for (const e of declared) expect([e, endings.get(e) || 0]).toEqual([e, expect.any(Number)]);
    expect(declared.filter(e => !endings.has(e))).toEqual([]);
    // Последний день всегда завершается какой-либо концовкой
    expect([...endings.values()].reduce((a, b) => a + b, 0)).toBe(3000);
    // Для информации: распределение концовок
    console.log(story.slug, Object.fromEntries(endings));
  });
});
