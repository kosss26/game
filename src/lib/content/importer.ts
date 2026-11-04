/**
 * Импорт скрипта дня в БД и публикация снапшота.
 * Без "server-only": используется и в server actions, и в CLI-скрипте seed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseScript, validateScript, convertToDbFormat, type ParseResult } from "@/lib/parser/dsl-parser";
import type { Character, Choice, Day, DayMeta, Scene, SnapshotData } from "@/lib/types/database";

export class ScriptError extends Error {
  constructor(public result: ParseResult) {
    super(
      "Скрипт содержит ошибки:\n" +
        result.errors
          .slice(0, 10)
          .map(e => `строка ${e.line}: ${e.message}`)
          .join("\n")
    );
  }
}

export function parseDayScript(script: string, storyCharacters: Record<string, Character> = {}): ParseResult {
  const result = parseScript(script, { characters: storyCharacters });
  result.errors = [...result.errors, ...validateScript(result)];
  return result;
}

/**
 * Полностью заменяет сцены дня содержимым скрипта и сохраняет исходник в meta.script.
 */
export async function importDayScript(
  supabase: SupabaseClient,
  day: Pick<Day, "id" | "meta" | "title" | "estimated_minutes">,
  script: string,
  storyCharacters: Record<string, Character> = {}
): Promise<{ scenes: number; choices: number; result: ParseResult }> {
  const result = parseDayScript(script, storyCharacters);
  if (result.errors.length > 0) throw new ScriptError(result);
  const dbData = convertToDbFormat(result);

  const del = await supabase.from("scenes").delete().eq("day_id", day.id);
  if (del.error) throw new Error(del.error.message);

  const { data: created, error: scenesError } = await supabase
    .from("scenes")
    .insert(
      dbData.scenes.map((s, index) => ({
        day_id: day.id,
        sort_index: index,
        type: s.type,
        speaker: s.speaker || null,
        text: s.text ?? null,
        meta: s.meta || {},
        tag: s.tag || null,
      }))
    )
    .select();
  if (scenesError) throw new Error(scenesError.message);
  const scenes = ((created || []) as Scene[]).sort((a, b) => a.sort_index - b.sort_index);

  const tagToId = new Map<string, string>();
  for (const s of scenes) if (s.tag) tagToId.set(s.tag, s.id);

  if (dbData.choices.length > 0) {
    const { error } = await supabase.from("choices").insert(
      dbData.choices.map(c => ({
        scene_id: scenes[c.scene_index].id,
        label: c.label,
        goto_tag: c.goto_tag || null,
        goto_scene_id: c.goto_tag ? tagToId.get(c.goto_tag) || null : null,
        set_flags: c.set_flags || {},
        condition: c.condition || null,
        sort_index: c.sort_index,
      }))
    );
    if (error) throw new Error(error.message);
  }

  const m = result.dayMeta;
  const meta: DayMeta = {
    ...(day.meta || {}),
    script,
    characters: m.characters,
  };
  if (m.backgroundStyle) meta.background_style = m.backgroundStyle;
  if (m.recap !== undefined) meta.recap_text = m.recap;
  if (m.teaser !== undefined) meta.teaser = m.teaser;
  if (m.push !== undefined) meta.push = m.push;
  if (m.waitHours !== undefined) meta.wait_hours = m.waitHours;

  const patch: Partial<Day> = { meta };
  if (m.title) patch.title = m.title;
  if (m.minutes) patch.estimated_minutes = m.minutes;
  const upd = await supabase.from("days").update(patch).eq("id", day.id);
  if (upd.error) throw new Error(upd.error.message);

  return { scenes: scenes.length, choices: dbData.choices.length, result };
}

/** Собирает неизменяемый снапшот из черновых сцен (без записи в БД) */
export async function buildSnapshot(supabase: SupabaseClient, dayId: string): Promise<{ day: Day; snapshot: SnapshotData }> {
  const { data: day, error: dayError } = await supabase.from("days").select("*").eq("id", dayId).single();
  if (dayError || !day) throw new Error("День не найден");

  const { data: scenes, error: scenesError } = await supabase.from("scenes").select("*").eq("day_id", dayId).order("sort_index", { ascending: true });
  if (scenesError) throw new Error(scenesError.message);
  const sceneList = (scenes || []) as Scene[];

  let choiceList: Choice[] = [];
  if (sceneList.length > 0) {
    const { data: choices, error } = await supabase
      .from("choices")
      .select("*")
      .in("scene_id", sceneList.map(s => s.id))
      .order("sort_index", { ascending: true });
    if (error) throw new Error(error.message);
    choiceList = (choices || []) as Choice[];
  }

  const d = day as Day;
  // Исходный скрипт в снапшот не кладём — он не нужен игроку
  const { script: _script, ...publicMeta } = d.meta || {};
  return {
    day: d,
    snapshot: {
      day: {
        story_id: d.story_id,
        day_number: d.day_number,
        title: d.title,
        unlock_at: d.unlock_at,
        estimated_minutes: d.estimated_minutes,
        status: "published",
        meta: publicMeta,
      },
      scenes: sceneList.map(s => ({
        id: s.id,
        sort_index: s.sort_index,
        type: s.type,
        speaker: s.speaker,
        text: s.text,
        meta: s.meta,
        next_scene_id: s.next_scene_id,
        tag: s.tag,
      })),
      choices: choiceList.map(c => ({
        id: c.id,
        scene_id: c.scene_id,
        label: c.label,
        goto_tag: c.goto_tag,
        goto_scene_id: c.goto_scene_id,
        set_flags: c.set_flags,
        condition: c.condition,
        sort_index: c.sort_index,
      })),
    },
  };
}

export async function publishDaySnapshot(supabase: SupabaseClient, dayId: string): Promise<{ version: number }> {
  const { snapshot } = await buildSnapshot(supabase, dayId);
  if (snapshot.scenes.length === 0) throw new Error("Нельзя опубликовать пустой день");

  const { data: latest } = await supabase
    .from("snapshots")
    .select("version")
    .eq("day_id", dayId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((latest as { version?: number } | null)?.version || 0) + 1;
  snapshot.version = version;

  const { error } = await supabase.from("snapshots").insert({ day_id: dayId, version, snapshot_json: snapshot });
  if (error) throw new Error(error.message);
  const upd = await supabase.from("days").update({ status: "published" }).eq("id", dayId);
  if (upd.error) throw new Error(upd.error.message);
  return { version };
}
