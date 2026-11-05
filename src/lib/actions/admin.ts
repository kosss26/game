"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { importDayScript, publishDaySnapshot, buildSnapshot, ScriptError } from "@/lib/content/importer";
import { isUuid } from "@/lib/game/purchases";
import type { Story, Day, Scene, Choice, StoryMeta, SnapshotData } from "@/lib/types/database";

function assertId(id: string) {
  if (!isUuid(id)) throw new Error("Некорректный идентификатор");
}

// ============== STORIES ==============

export async function getAllStories(): Promise<Story[]> {
  await requireAdmin();
  const supabase = await db();
  const { data, error } = await supabase.from("stories").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Story[];
}

export async function getStory(storyId: string): Promise<Story | null> {
  await requireAdmin();
  assertId(storyId);
  const supabase = await db();
  const { data } = await supabase.from("stories").select("*").eq("id", storyId).maybeSingle();
  return (data as Story) || null;
}

export async function createStory(input: { title: string; description?: string; cover_style?: string }): Promise<Story> {
  await requireAdmin();
  const title = input.title?.trim();
  if (!title) throw new Error("Укажите название");
  const supabase = await db();
  const { data, error } = await supabase
    .from("stories")
    .insert({
      title: title.slice(0, 120),
      description: input.description?.trim().slice(0, 1000) || null,
      cover_style: input.cover_style || "noir",
      status: "draft",
      meta: {},
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  return data as Story;
}

export async function updateStory(
  storyId: string,
  input: Partial<Pick<Story, "title" | "description" | "cover_style" | "status" | "sort_order">> & { meta?: StoryMeta }
): Promise<Story> {
  await requireAdmin();
  assertId(storyId);
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = String(input.title).trim().slice(0, 120);
  if (input.description !== undefined) patch.description = input.description ? String(input.description).slice(0, 1000) : null;
  if (input.cover_style !== undefined) patch.cover_style = input.cover_style;
  if (input.sort_order !== undefined) patch.sort_order = Number(input.sort_order) || 0;
  if (input.status !== undefined) {
    if (!["draft", "published"].includes(input.status)) throw new Error("Некорректный статус");
    patch.status = input.status;
  }
  if (input.meta !== undefined) {
    if (typeof input.meta !== "object" || input.meta === null || Array.isArray(input.meta)) throw new Error("meta должен быть объектом");
    patch.meta = input.meta;
  }
  const supabase = await db();
  const { data, error } = await supabase.from("stories").update(patch).eq("id", storyId).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data as Story;
}

export async function deleteStory(storyId: string): Promise<void> {
  await requireAdmin();
  assertId(storyId);
  const supabase = await db();
  const { error } = await supabase.from("stories").delete().eq("id", storyId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function publishStory(storyId: string): Promise<void> {
  await requireAdmin();
  assertId(storyId);
  const supabase = await db();
  const { data: days } = await supabase.from("days").select("day_number, status").eq("story_id", storyId);
  const published = ((days || []) as Array<{ day_number: number; status: string }>).filter(d => d.status === "published");
  if (!published.some(d => d.day_number === 1)) throw new Error("Сначала опубликуйте день 1");
  const { error } = await supabase.from("stories").update({ status: "published" }).eq("id", storyId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

// ============== DAYS ==============

export async function getStoryDays(storyId: string): Promise<Day[]> {
  await requireAdmin();
  assertId(storyId);
  const supabase = await db();
  const { data, error } = await supabase.from("days").select("*").eq("story_id", storyId).order("day_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Day[];
}

export async function getDay(dayId: string): Promise<Day | null> {
  await requireAdmin();
  assertId(dayId);
  const supabase = await db();
  const { data } = await supabase.from("days").select("*").eq("id", dayId).maybeSingle();
  return (data as Day) || null;
}

export async function createDay(input: { story_id: string; day_number: number; title: string; unlock_at?: string; estimated_minutes?: number }): Promise<Day> {
  await requireAdmin();
  assertId(input.story_id);
  if (!Number.isInteger(input.day_number) || input.day_number < 1) throw new Error("Номер дня должен быть ≥ 1");
  if (!input.title?.trim()) throw new Error("Укажите название дня");
  const supabase = await db();
  const { data, error } = await supabase
    .from("days")
    .insert({
      story_id: input.story_id,
      day_number: input.day_number,
      title: input.title.trim().slice(0, 120),
      unlock_at: input.unlock_at ? new Date(input.unlock_at).toISOString() : null,
      estimated_minutes: input.estimated_minutes || null,
      status: "draft",
      meta: {},
    })
    .select()
    .single();
  if (error) throw new Error(error.code === "23505" ? `День ${input.day_number} уже существует` : error.message);
  return data as Day;
}

export async function updateDay(dayId: string, input: Partial<Pick<Day, "title" | "unlock_at" | "estimated_minutes" | "status" | "meta">>): Promise<Day> {
  await requireAdmin();
  assertId(dayId);
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = String(input.title).trim().slice(0, 120);
  if (input.unlock_at !== undefined) patch.unlock_at = input.unlock_at ? new Date(input.unlock_at).toISOString() : null;
  if (input.estimated_minutes !== undefined) patch.estimated_minutes = input.estimated_minutes || null;
  if (input.status !== undefined) patch.status = input.status === "published" ? "published" : "draft";
  if (input.meta !== undefined) patch.meta = input.meta;
  const supabase = await db();
  const { data, error } = await supabase.from("days").update(patch).eq("id", dayId).select().single();
  if (error) throw new Error(error.message);
  return data as Day;
}

export async function deleteDay(dayId: string): Promise<void> {
  await requireAdmin();
  assertId(dayId);
  const supabase = await db();
  const { error } = await supabase.from("days").delete().eq("id", dayId);
  if (error) throw new Error(error.message);
}

// ============== SCENES ==============

export async function getDayScenes(dayId: string): Promise<Scene[]> {
  await requireAdmin();
  assertId(dayId);
  const supabase = await db();
  const { data, error } = await supabase.from("scenes").select("*").eq("day_id", dayId).order("sort_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Scene[];
}

export async function getSceneChoices(sceneIds: string[]): Promise<Choice[]> {
  await requireAdmin();
  if (sceneIds.length === 0) return [];
  const supabase = await db();
  const { data, error } = await supabase.from("choices").select("*").in("scene_id", sceneIds).order("sort_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Choice[];
}

export async function deleteScene(sceneId: string): Promise<void> {
  await requireAdmin();
  assertId(sceneId);
  const supabase = await db();
  const { error } = await supabase.from("scenes").delete().eq("id", sceneId);
  if (error) throw new Error(error.message);
}

export interface ImportResult {
  ok: boolean;
  scenes?: number;
  choices?: number;
  errors?: Array<{ line: number; message: string }>;
  error?: string;
}

/** Импорт скрипта: парсинг и замена сцен выполняются на сервере */
export async function importScript(dayId: string, script: string): Promise<ImportResult> {
  await requireAdmin();
  assertId(dayId);
  if (typeof script !== "string" || script.length > 500_000) return { ok: false, error: "Скрипт слишком большой" };
  const supabase = await db();
  const { data: day } = await supabase.from("days").select("*").eq("id", dayId).maybeSingle();
  if (!day) return { ok: false, error: "День не найден" };
  const { data: story } = await supabase.from("stories").select("meta").eq("id", day.story_id).maybeSingle();
  try {
    const sm = (story?.meta || {}) as StoryMeta;
    const res = await importDayScript(supabase, day as Day, script, sm.characters || {}, sm.chats || {});
    revalidatePath(`/admin/days/${dayId}`);
    return { ok: true, scenes: res.scenes, choices: res.choices };
  } catch (e) {
    if (e instanceof ScriptError) {
      return { ok: false, errors: e.result.errors.map(er => ({ line: er.line, message: er.message })) };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка импорта" };
  }
}

// ============== PUBLISHING ==============

export async function publishDay(dayId: string): Promise<{ version: number }> {
  await requireAdmin();
  assertId(dayId);
  const supabase = await db();
  const res = await publishDaySnapshot(supabase, dayId);
  revalidatePath(`/admin/days/${dayId}`);
  return res;
}

export async function unpublishDay(dayId: string): Promise<void> {
  await requireAdmin();
  assertId(dayId);
  const supabase = await db();
  const { error } = await supabase.from("days").update({ status: "draft" }).eq("id", dayId);
  if (error) throw new Error(error.message);
}

/** Черновой снапшот для предпросмотра в админке (без публикации) */
export async function getDraftSnapshot(dayId: string): Promise<{ snapshot: SnapshotData; characters: StoryMeta["characters"]; storyMeta: StoryMeta }> {
  await requireAdmin();
  assertId(dayId);
  const supabase = await db();
  const { day, snapshot } = await buildSnapshot(supabase, dayId);
  const { data: story } = await supabase.from("stories").select("meta").eq("id", day.story_id).maybeSingle();
  return {
    snapshot,
    characters: { ...(((story?.meta || {}) as StoryMeta).characters || {}), ...(day.meta?.characters || {}) },
    storyMeta: (story?.meta || {}) as StoryMeta,
  };
}

// ============== ANALYTICS ==============

export interface DayFunnel {
  dayNumber: number;
  title: string;
  started: number;
  completed: number;
}

export async function getAnalytics(): Promise<{
  users: number;
  guests: number;
  started: number;
  completed: number;
  purchases: number;
  stars: number;
  funnels: Array<{ storyId: string; title: string; days: DayFunnel[] }>;
}> {
  await requireAdmin();
  const supabase = await db();
  const [{ count: users }, { count: guests }, { count: started }, { count: completed }, { data: purchases }, { data: stories }] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }).eq("is_guest", true),
    supabase.from("progresses").select("*", { count: "exact", head: true }),
    supabase.from("progresses").select("*", { count: "exact", head: true }).eq("completed", true),
    supabase.from("purchases").select("stars, source"),
    supabase.from("stories").select("id, title").order("sort_order", { ascending: true }),
  ]);

  const funnels = [];
  for (const s of (stories || []) as Array<{ id: string; title: string }>) {
    const { data: days } = await supabase.from("days").select("id, day_number, title").eq("story_id", s.id).order("day_number", { ascending: true });
    const out: DayFunnel[] = [];
    for (const d of (days || []) as Array<{ id: string; day_number: number; title: string }>) {
      const [{ count: st }, { count: cp }] = await Promise.all([
        supabase.from("progresses").select("*", { count: "exact", head: true }).eq("day_id", d.id),
        supabase.from("progresses").select("*", { count: "exact", head: true }).eq("day_id", d.id).eq("completed", true),
      ]);
      out.push({ dayNumber: d.day_number, title: d.title, started: st || 0, completed: cp || 0 });
    }
    funnels.push({ storyId: s.id, title: s.title, days: out });
  }

  const paid = ((purchases || []) as Array<{ stars: number; source: string }>).filter(p => p.source === "stars");
  return {
    users: users || 0,
    guests: guests || 0,
    started: started || 0,
    completed: completed || 0,
    purchases: paid.length,
    stars: paid.reduce((a, p) => a + (p.stars || 0), 0),
    funnels,
  };
}
