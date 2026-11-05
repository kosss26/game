"use server";

import { db } from "@/lib/supabase/server";
import { resolveUser, isUserAdmin } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { computeAccess, canPlay, hasSeasonPass, type DayAccess } from "@/lib/game/access";
import { encodePayload, grantPurchase, isUuid } from "@/lib/game/purchases";
import { createStarsInvoiceLink, miniAppLink } from "@/lib/telegram/bot";
import type {
  Character,
  Day,
  Flags,
  HistoryEntry,
  Progress,
  ProgressState,
  Purchase,
  SnapshotData,
  Story,
  StoryMeta,
  User,
} from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Типы ответа
// ---------------------------------------------------------------------------

export interface CatalogItem {
  id: string;
  title: string;
  description: string | null;
  cover_style: string | null;
  meta: StoryMeta;
  totalDays: number;
  completedDays: number;
  /** Номер дня, который стоит открыть */
  nextDay: number | null;
  status: "new" | "in_progress" | "waiting" | "finished" | "coming";
  unlocksAt: string | null;
}

export interface StoryView {
  story: Pick<Story, "id" | "title" | "description" | "cover_style"> & { meta: StoryMeta };
  days: DayAccess[];
  upcomingDays: number;
  credits: number;
  hasPass: boolean;
  prices: { skipDay: number; seasonPass: number };
  paymentsEnabled: boolean;
  /** Бесплатный режим: все главы открыты */
  freeAccess: boolean;
  endingsUnlocked: string[];
  shareLink: string;
  isGuest: boolean;
}

export type DayPayload =
  | {
      ok: true;
      story: { id: string; title: string; meta: StoryMeta };
      day: { id: string; number: number; title: string; background: string | null; recap: string | null; teaser: string | null };
      snapshot: SnapshotData;
      version: number;
      characters: Record<string, Character>;
      progress: ProgressSlice | null;
      inheritedFlags: Flags;
      nextDay: { number: number; title: string } | null;
      totalDays: number;
      isLastDay: boolean;
    }
  | { ok: false; reason: "not_found" | "locked" | "unauthorized" | "not_published"; access?: DayAccess };

export type ProgressSlice = Pick<Progress, "scene_id" | "flags" | "history" | "state" | "completed" | "snapshot_version">;

// ---------------------------------------------------------------------------
// Вспомогательные
// ---------------------------------------------------------------------------

const MAX_HISTORY = 2000;
const MAX_FLAGS = 300;

function storyMeta(s: Pick<Story, "meta">): StoryMeta {
  return (s.meta || {}) as StoryMeta;
}

async function loadAccessContext(user: User | null, storyId: string) {
  const supabase = await db();
  const [{ data: days }, progressRes, purchaseRes] = await Promise.all([
    supabase.from("days").select("*").eq("story_id", storyId).order("day_number", { ascending: true }),
    user
      ? supabase.from("progresses").select("day_id, completed, completed_at, flags").eq("user_id", user.id).eq("story_id", storyId)
      : Promise.resolve({ data: [] as Array<Pick<Progress, "day_id" | "completed" | "completed_at" | "flags">> }),
    user
      ? supabase.from("purchases").select("product, day_number").eq("user_id", user.id).eq("story_id", storyId)
      : Promise.resolve({ data: [] as Array<Pick<Purchase, "product" | "day_number">> }),
  ]);
  let allDays = (days || []) as Day[];
  // Для стендов/QA: принудительное время ожидания между днями
  const forced = process.env.FORCE_WAIT_HOURS;
  if (forced !== undefined && forced !== "") {
    allDays = allDays.map(d => ({ ...d, meta: { ...(d.meta || {}), wait_hours: parseFloat(forced) } }));
  }
  const progresses = (progressRes.data || []) as Array<Pick<Progress, "day_id" | "completed" | "completed_at" | "flags">>;
  const purchases = (purchaseRes.data || []) as Array<Pick<Purchase, "product" | "day_number">>;
  const isAdmin = await isUserAdmin(user);
  const access = computeAccess({
    days: allDays,
    progresses,
    purchases,
    now: Date.now(),
    isAdmin,
    freeAccess: config.freeAccess,
    defaultWaitHours: config.defaultWaitHours,
  });
  return { allDays, progresses, purchases, access, isAdmin };
}

function summarize(access: DayAccess[], upcoming: number): Pick<CatalogItem, "completedDays" | "nextDay" | "status" | "unlocksAt"> {
  const completedDays = access.filter(a => a.status === "completed").length;
  const inProgress = access.find(a => a.status === "in_progress");
  const available = access.find(a => a.status === "available");
  const waiting = access.find(a => a.status === "waiting" || a.status === "not_released");
  if (access.length === 0) return { completedDays: 0, nextDay: null, status: "coming", unlocksAt: null };
  if (inProgress) return { completedDays, nextDay: inProgress.dayNumber, status: "in_progress", unlocksAt: null };
  if (available) return { completedDays, nextDay: available.dayNumber, status: completedDays ? "in_progress" : "new", unlocksAt: null };
  if (waiting) return { completedDays, nextDay: waiting.dayNumber, status: "waiting", unlocksAt: waiting.unlocksAt };
  if (completedDays === access.length) {
    return { completedDays, nextDay: null, status: upcoming > 0 ? "waiting" : "finished", unlocksAt: null };
  }
  return { completedDays, nextDay: null, status: "in_progress", unlocksAt: null };
}

// ---------------------------------------------------------------------------
// Каталог
// ---------------------------------------------------------------------------

export async function getCatalog(token: string | null): Promise<CatalogItem[]> {
  const user = await resolveUser(token);
  const supabase = await db();
  const { data: stories } = await supabase
    .from("stories")
    .select("*")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const items: CatalogItem[] = [];
  for (const s of (stories || []) as Story[]) {
    const ctx = await loadAccessContext(user, s.id);
    const upcoming = ctx.allDays.filter(d => d.status !== "published").length;
    items.push({
      id: s.id,
      title: s.title,
      description: s.description,
      cover_style: s.cover_style,
      meta: storyMeta(s),
      totalDays: ctx.access.length + upcoming,
      ...summarize(ctx.access, upcoming),
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Страница истории
// ---------------------------------------------------------------------------

export async function getStoryView(token: string | null, storyId: string): Promise<StoryView | null> {
  if (!isUuid(storyId)) return null;
  const user = await resolveUser(token);
  const supabase = await db();
  const { data: story } = await supabase.from("stories").select("*").eq("id", storyId).maybeSingle();
  if (!story) return null;
  const ctx = await loadAccessContext(user, storyId);
  if (story.status !== "published" && !ctx.isAdmin) return null;

  const endings = (user?.meta?.endings?.[storyId] || []) as string[];

  return {
    story: { id: story.id, title: story.title, description: story.description, cover_style: story.cover_style, meta: storyMeta(story) },
    days: ctx.access,
    upcomingDays: ctx.allDays.filter(d => d.status !== "published").length,
    credits: user?.skip_credits ?? 0,
    hasPass: hasSeasonPass(ctx.purchases),
    prices: config.prices,
    paymentsEnabled: !!config.botToken && !user?.is_guest && !config.freeAccess,
    freeAccess: config.freeAccess,
    endingsUnlocked: endings,
    shareLink: miniAppLink(user && !user.is_guest ? `ref_${user.telegram_id}` : undefined),
    isGuest: !!user?.is_guest,
  };
}

// ---------------------------------------------------------------------------
// День
// ---------------------------------------------------------------------------

export async function loadDay(token: string | null, storyId: string, dayNumber: number): Promise<DayPayload> {
  if (!isUuid(storyId) || !Number.isInteger(dayNumber) || dayNumber < 1) return { ok: false, reason: "not_found" };
  const user = await resolveUser(token);
  if (!user) return { ok: false, reason: "unauthorized" };

  const supabase = await db();
  const { data: story } = await supabase.from("stories").select("*").eq("id", storyId).maybeSingle();
  if (!story) return { ok: false, reason: "not_found" };

  const ctx = await loadAccessContext(user, storyId);
  if (story.status !== "published" && !ctx.isAdmin) return { ok: false, reason: "not_found" };
  const day = ctx.allDays.find(d => d.day_number === dayNumber);
  if (!day) return { ok: false, reason: "not_found" };
  const access = ctx.access.find(a => a.dayNumber === dayNumber);
  if (!access) return { ok: false, reason: "not_published" };
  if (!canPlay(access)) return { ok: false, reason: "locked", access };

  const { data: snap } = await supabase
    .from("snapshots")
    .select("version, snapshot_json")
    .eq("day_id", day.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!snap) return { ok: false, reason: "not_published" };

  // Флаги предыдущих дней (по порядку) — переходят в текущий день
  const byDay = new Map(ctx.progresses.map(p => [p.day_id, p]));
  let inheritedFlags: Flags = {};
  for (const d of ctx.allDays) {
    if (d.day_number >= dayNumber) break;
    const p = byDay.get(d.id);
    if (p?.completed) inheritedFlags = { ...inheritedFlags, ...((p.flags as Flags) || {}) };
  }

  let { data: progress } = await supabase
    .from("progresses")
    .select("scene_id, flags, history, state, completed, snapshot_version")
    .eq("user_id", user.id)
    .eq("story_id", storyId)
    .eq("day_id", day.id)
    .maybeSingle();

  if (!progress) {
    // Создаём запись — это «билет» на день: сохранять прогресс можно только по ней
    await supabase.from("progresses").upsert(
      { user_id: user.id, story_id: storyId, day_id: day.id, flags: {}, history: [], state: {}, completed: false, snapshot_version: snap.version },
      { onConflict: "user_id,story_id,day_id", ignoreDuplicates: true }
    );
    progress = null;
  }

  // Игрок посреди дня, а автор опубликовал новую версию — доигрываем ту, что начали
  let activeSnap = snap as { version: number; snapshot_json: unknown };
  if (progress && !progress.completed && progress.snapshot_version && progress.snapshot_version !== snap.version) {
    const { data: old } = await supabase
      .from("snapshots")
      .select("version, snapshot_json")
      .eq("day_id", day.id)
      .eq("version", progress.snapshot_version)
      .maybeSingle();
    if (old) activeSnap = old;
  }

  const published = ctx.access;
  const idx = published.findIndex(a => a.dayNumber === dayNumber);
  const next = published[idx + 1] || null;
  const upcoming = ctx.allDays.filter(d => d.status !== "published" && d.day_number > dayNumber).sort((a, b) => a.day_number - b.day_number)[0];
  const meta = storyMeta(story);
  const snapshot = activeSnap.snapshot_json as SnapshotData;

  return {
    ok: true,
    story: { id: story.id, title: story.title, meta },
    day: {
      id: day.id,
      number: day.day_number,
      title: snapshot.day?.title || day.title,
      background: snapshot.day?.meta?.background_style || story.cover_style || null,
      recap: snapshot.day?.meta?.recap_text || null,
      teaser: snapshot.day?.meta?.teaser || null,
    },
    snapshot,
    version: activeSnap.version,
    characters: { ...(meta.characters || {}), ...(snapshot.day?.meta?.characters || {}) },
    progress: (progress as ProgressSlice | null) ?? null,
    inheritedFlags,
    nextDay: next ? { number: next.dayNumber, title: next.title } : upcoming ? { number: upcoming.day_number, title: upcoming.title } : null,
    totalDays: published.length + ctx.allDays.filter(d => d.status !== "published").length,
    isLastDay: !next && !upcoming,
  };
}

function sanitizeFlags(flags: unknown): Flags {
  const out: Flags = {};
  if (!flags || typeof flags !== "object") return out;
  for (const [k, v] of Object.entries(flags as Record<string, unknown>).slice(0, MAX_FLAGS)) {
    if (k.length > 64) continue;
    if (typeof v === "boolean" || typeof v === "number") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 200);
  }
  return out;
}

function sanitizeHistory(history: unknown): HistoryEntry[] {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_HISTORY).flatMap((h): HistoryEntry[] => {
    if (!h || typeof h !== "object") return [];
    const e = h as Record<string, unknown>;
    const kind = e.kind === "system" || e.kind === "reply" ? e.kind : "message";
    const speaker = e.speaker === "me" || e.speaker === "system" ? e.speaker : "npc";
    return [
      {
        id: String(e.id || "").slice(0, 80),
        kind,
        speaker,
        character: typeof e.character === "string" ? e.character.slice(0, 40) : null,
        text: String(e.text || "").slice(0, 2000),
        at: typeof e.at === "number" ? e.at : Date.now(),
        ...(e.hidden === true ? { hidden: true } : {}),
        ...(typeof e.thread === "string" && e.thread ? { thread: e.thread.slice(0, 40) } : {}),
        ...(e.past === true ? { past: true } : {}),
      },
    ];
  });
}

export interface SaveInput {
  storyId: string;
  dayId: string;
  sceneId: string | null;
  flags: Flags;
  history: HistoryEntry[];
  state?: ProgressState;
  version?: number;
}

/** Сохранение прогресса. Работает только по «билету», созданному loadDay. */
export async function saveProgress(token: string | null, input: SaveInput): Promise<{ ok: boolean }> {
  if (!isUuid(input.storyId) || !isUuid(input.dayId)) return { ok: false };
  const user = await resolveUser(token);
  if (!user) return { ok: false };
  const supabase = await db();
  const state: ProgressState = {};
  if (input.state?.pause_until && Number.isFinite(input.state.pause_until)) {
    // пауза не может быть дольше суток
    state.pause_until = Math.min(input.state.pause_until, Date.now() + 86_400_000);
    if (input.state.pause_label) state.pause_label = String(input.state.pause_label).slice(0, 120);
  }
  const { data, error } = await supabase
    .from("progresses")
    .update({
      scene_id: input.sceneId ? String(input.sceneId).slice(0, 80) : null,
      flags: sanitizeFlags(input.flags),
      history: sanitizeHistory(input.history),
      state,
      snapshot_version: Number.isInteger(input.version) ? input.version : null,
    })
    .eq("user_id", user.id)
    .eq("story_id", input.storyId)
    .eq("day_id", input.dayId)
    .eq("completed", false)
    .select("id");
  return { ok: !error && Array.isArray(data) && data.length > 0 };
}

export async function recordChoice(
  token: string | null,
  input: { storyId: string; dayId: string; sceneId: string; choiceId: string }
): Promise<void> {
  if (!isUuid(input.storyId) || !isUuid(input.dayId)) return;
  const user = await resolveUser(token);
  if (!user) return;
  const supabase = await db();
  await supabase.from("choice_events").upsert(
    {
      user_id: user.id,
      story_id: input.storyId,
      day_id: input.dayId,
      scene_id: String(input.sceneId).slice(0, 80),
      choice_id: String(input.choiceId).slice(0, 80),
    },
    { onConflict: "user_id,scene_id", ignoreDuplicates: true }
  );
}

export async function completeDay(
  token: string | null,
  input: SaveInput & { ending?: string | null }
): Promise<{ ok: boolean }> {
  if (!isUuid(input.storyId) || !isUuid(input.dayId)) return { ok: false };
  const user = await resolveUser(token);
  if (!user) return { ok: false };
  const supabase = await db();
  const flags = sanitizeFlags(input.flags);
  if (input.ending) flags.__ending = String(input.ending).slice(0, 64);

  const { data, error } = await supabase
    .from("progresses")
    .update({
      scene_id: null,
      flags,
      history: sanitizeHistory(input.history),
      state: {},
      completed: true,
      completed_at: new Date().toISOString(),
      notified_at: null,
    })
    .eq("user_id", user.id)
    .eq("story_id", input.storyId)
    .eq("day_id", input.dayId)
    .eq("completed", false)
    .select("id");

  if (input.ending) {
    const meta = { ...(user.meta || {}) };
    const endings = { ...(meta.endings || {}) };
    const list = new Set(endings[input.storyId] || []);
    list.add(String(input.ending).slice(0, 64));
    endings[input.storyId] = [...list];
    await supabase.from("users").update({ meta: { ...meta, endings } }).eq("id", user.id);
  }
  return { ok: !error && Array.isArray(data) && data.length > 0 };
}

/** Сколько игроков выбрали каждый вариант */
export async function getChoiceStats(sceneIds: string[]): Promise<Record<string, Record<string, number>>> {
  const supabase = await db();
  const out: Record<string, Record<string, number>> = {};
  for (const sceneId of sceneIds.slice(0, 30)) {
    const { data } = await supabase.rpc("get_choice_stats", { p_scene_id: String(sceneId).slice(0, 80) });
    out[sceneId] = Object.fromEntries(((data || []) as Array<{ choice_id: string; count: number }>).map(r => [r.choice_id, Number(r.count)]));
  }
  return out;
}

/** Начать историю заново (концовки и покупки сохраняются) */
export async function restartStory(token: string | null, storyId: string): Promise<{ ok: boolean }> {
  if (!isUuid(storyId)) return { ok: false };
  const user = await resolveUser(token);
  if (!user) return { ok: false };
  const supabase = await db();
  const { error } = await supabase.from("progresses").delete().eq("user_id", user.id).eq("story_id", storyId);
  return { ok: !error };
}

/** Перечитать день: сбросить прогресс только этого дня (флаги следующих дней не трогаем) */
export async function replayDay(token: string | null, storyId: string, dayId: string): Promise<{ ok: boolean }> {
  if (!isUuid(storyId) || !isUuid(dayId)) return { ok: false };
  const user = await resolveUser(token);
  if (!user) return { ok: false };
  const supabase = await db();
  // Перепрохождение допустимо только для последнего пройденного дня, иначе ломается связность флагов
  const { data: rows } = await supabase.from("progresses").select("day_id").eq("user_id", user.id).eq("story_id", storyId);
  const { data: days } = await supabase.from("days").select("id, day_number").eq("story_id", storyId);
  const numberOf = new Map(((days || []) as Array<{ id: string; day_number: number }>).map(d => [d.id, d.day_number]));
  const latest = Math.max(0, ...((rows || []) as Array<{ day_id: string }>).map(r => numberOf.get(r.day_id) || 0));
  if (numberOf.get(dayId) !== latest) return { ok: false };
  const { error } = await supabase.from("progresses").delete().eq("user_id", user.id).eq("story_id", storyId).eq("day_id", dayId);
  return { ok: !error };
}

// ---------------------------------------------------------------------------
// Пропуск ожидания
// ---------------------------------------------------------------------------

export async function redeemSkipCredit(token: string | null, storyId: string, dayNumber: number): Promise<{ ok: boolean; error?: string }> {
  if (!isUuid(storyId) || !Number.isInteger(dayNumber)) return { ok: false };
  const user = await resolveUser(token);
  if (!user) return { ok: false, error: "Нужно войти" };
  const ctx = await loadAccessContext(user, storyId);
  const access = ctx.access.find(a => a.dayNumber === dayNumber);
  if (!access || access.status !== "waiting") return { ok: false, error: "День уже доступен" };
  const supabase = await db();
  const { data: consumed } = await supabase.rpc("consume_skip_credit", { p_user_id: user.id });
  if (!consumed) return { ok: false, error: "Нет бесплатных пропусков" };
  await grantPurchase({ product: "skip_day", storyId, dayNumber, userId: user.id }, { stars: 0, chargeId: null, source: "credit" });
  return { ok: true };
}

export async function createInvoice(
  token: string | null,
  input: { product: "skip_day" | "season_pass"; storyId: string; dayNumber?: number }
): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  if (!isUuid(input.storyId)) return { ok: false, error: "Некорректная история" };
  const user = await resolveUser(token);
  if (!user || user.is_guest) return { ok: false, error: "Покупки доступны в Telegram" };
  if (!config.botToken) return { ok: false, error: "Оплата не настроена" };
  const supabase = await db();
  const { data: story } = await supabase.from("stories").select("title").eq("id", input.storyId).maybeSingle();
  if (!story) return { ok: false, error: "История не найдена" };

  try {
    if (input.product === "skip_day") {
      if (!Number.isInteger(input.dayNumber) || (input.dayNumber as number) < 1) return { ok: false, error: "Некорректный день" };
      const link = await createStarsInvoiceLink({
        title: `День ${input.dayNumber} — сейчас`,
        description: `Открыть день ${input.dayNumber} истории «${story.title}» без ожидания`,
        payload: encodePayload({ product: "skip_day", storyId: input.storyId, dayNumber: input.dayNumber!, userId: user.id }),
        stars: config.prices.skipDay,
      });
      return { ok: true, link };
    }
    const link = await createStarsInvoiceLink({
      title: "Сезонный пропуск",
      description: `Все дни истории «${story.title}» без ожидания`,
      payload: encodePayload({ product: "season_pass", storyId: input.storyId, dayNumber: null, userId: user.id }),
      stars: config.prices.seasonPass,
    });
    return { ok: true, link };
  } catch (e) {
    console.error("createInvoice failed", e);
    return { ok: false, error: "Не удалось создать платёж. Попробуйте позже." };
  }
}
