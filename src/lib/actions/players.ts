"use server";

/**
 * Студия: управление игроками.
 * Список с поиском и фильтрами, карточка игрока, бесплатный доступ, пропуски, сброс прогресса.
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { isUuid } from "@/lib/game/purchases";
import { config } from "@/lib/config";
import type { Day, Purchase, Story, StoryMeta, User } from "@/lib/types/database";

export type PlayerFilter = "all" | "free" | "buyers" | "active" | "blocked" | "guests";

export interface PlayerRow {
  id: string;
  telegram_id: number;
  name: string;
  username: string | null;
  photo_url: string | null;
  is_guest: boolean;
  created_at: string;
  last_seen_at: string | null;
  bot_blocked: boolean;
  skip_credits: number;
  free_access: boolean;
  chapters: number;
  stories: number;
  endings: number;
  stars: number;
}

export interface PlayerList {
  rows: PlayerRow[];
  hasMore: boolean;
  totals: { players: number; guests: number; free: number; buyers: number };
  globalFree: boolean;
}

export interface PlayerStoryProgress {
  storyId: string;
  title: string;
  totalDays: number;
  completedDays: number;
  currentDay: number | null;
  lastPlayedAt: string | null;
  endings: Array<{ id: string; title: string; unlocked: boolean }>;
  hasPass: boolean;
}

export interface PlayerDetail {
  player: PlayerRow & { last_name: string | null; language_code: string | null; free_access_at: string | null; free_access_note: string | null };
  stories: PlayerStoryProgress[];
  purchases: Array<Pick<Purchase, "id" | "product" | "story_id" | "day_number" | "stars" | "source" | "created_at"> & { storyTitle: string | null }>;
  invited: number;
  referredBy: { id: string; name: string } | null;
  globalFree: boolean;
}

const PAGE = 50;

function fullName(u: Pick<User, "first_name" | "last_name">): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ");
}

function assertId(id: string) {
  if (!isUuid(id)) throw new Error("Некорректный идентификатор");
}

/** Список игроков. q — имя, @username или Telegram ID */
export async function listPlayers(input: { q?: string; filter?: PlayerFilter; limit?: number } = {}): Promise<PlayerList> {
  await requireAdmin();
  const supabase = await db();
  const limit = Math.min(Math.max(input.limit || PAGE, PAGE), 1000);
  const filter = input.filter || "all";
  const q = (input.q || "").trim();

  let query = supabase.from("users").select("*").order("last_seen_at", { ascending: false }).limit(2000);
  if (filter === "guests") query = query.eq("is_guest", true);
  else query = query.eq("is_guest", false);
  if (filter === "blocked") query = query.eq("bot_blocked", true);
  if (q) {
    if (/^\d{3,}$/.test(q)) query = query.eq("telegram_id", Number(q));
    else if (q.startsWith("@")) query = query.ilike("username", q.slice(1).replace(/[%_]/g, "") + "%");
    else query = query.ilike("first_name", `%${q.replace(/[%_]/g, "")}%`);
  }
  const { data: usersRaw, error } = await query;
  if (error) throw new Error(error.message);
  const users = (usersRaw || []) as User[];

  // Агрегаты по всем найденным (для фильтров «покупатели» и «активные»)
  const ids = users.map(u => u.id);
  const [progRes, purRes] = await Promise.all([
    ids.length ? supabase.from("progresses").select("user_id, story_id, completed").in("user_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("purchases").select("user_id, stars").in("user_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const chapters = new Map<string, number>();
  const stories = new Map<string, Set<string>>();
  for (const p of (progRes.data || []) as Array<{ user_id: string; story_id: string; completed: boolean }>) {
    if (p.completed) chapters.set(p.user_id, (chapters.get(p.user_id) || 0) + 1);
    if (!stories.has(p.user_id)) stories.set(p.user_id, new Set());
    stories.get(p.user_id)!.add(p.story_id);
  }
  const stars = new Map<string, number>();
  for (const p of (purRes.data || []) as Array<{ user_id: string; stars: number }>) stars.set(p.user_id, (stars.get(p.user_id) || 0) + (p.stars || 0));

  const toRow = (u: User): PlayerRow => ({
    id: u.id,
    telegram_id: Number(u.telegram_id),
    name: fullName(u),
    username: u.username,
    photo_url: u.photo_url,
    is_guest: !!u.is_guest,
    created_at: u.created_at,
    last_seen_at: (u as User & { last_seen_at?: string | null }).last_seen_at || null,
    bot_blocked: !!u.bot_blocked,
    skip_credits: u.skip_credits || 0,
    free_access: !!u.meta?.free_access,
    chapters: chapters.get(u.id) || 0,
    stories: stories.get(u.id)?.size || 0,
    endings: Object.values(u.meta?.endings || {}).reduce((a, l) => a + l.length, 0),
    stars: stars.get(u.id) || 0,
  });

  let rows = users.map(toRow);
  if (filter === "free") rows = rows.filter(r => r.free_access);
  if (filter === "buyers") rows = rows.filter(r => r.stars > 0);
  if (filter === "active") rows = rows.filter(r => r.chapters > 0);

  // Итоги по всей базе (без поиска)
  const { data: all } = await supabase.from("users").select("id, is_guest, meta").limit(100000);
  const allUsers = (all || []) as Array<Pick<User, "id" | "is_guest" | "meta">>;
  const { data: buyersRaw } = await supabase.from("purchases").select("user_id").gt("stars", 0).limit(100000);
  const buyers = new Set(((buyersRaw || []) as Array<{ user_id: string }>).map(b => b.user_id));

  return {
    rows: rows.slice(0, limit),
    hasMore: rows.length > limit,
    totals: {
      players: allUsers.filter(u => !u.is_guest).length,
      guests: allUsers.filter(u => u.is_guest).length,
      free: allUsers.filter(u => u.meta?.free_access).length,
      buyers: buyers.size,
    },
    globalFree: config.freeAccess,
  };
}

export async function getPlayer(userId: string): Promise<PlayerDetail | null> {
  await requireAdmin();
  assertId(userId);
  const supabase = await db();
  const { data: u } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (!u) return null;
  const user = u as User & { last_seen_at?: string | null };

  const [{ data: storiesRaw }, { data: daysRaw }, { data: progRaw }, { data: purRaw }, { data: invitedRaw }] = await Promise.all([
    supabase.from("stories").select("id, title, meta, sort_order, status").order("sort_order", { ascending: true }),
    supabase.from("days").select("id, story_id, day_number, status"),
    supabase.from("progresses").select("story_id, day_id, completed, updated_at").eq("user_id", userId),
    supabase.from("purchases").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("users").select("id").eq("referred_by", userId).limit(10000),
  ]);
  const storiesList = ((storiesRaw || []) as Array<Pick<Story, "id" | "title" | "meta" | "status">>).filter(s => s.status === "published");
  const days = (daysRaw || []) as Array<Pick<Day, "id" | "story_id" | "day_number" | "status">>;
  const progresses = (progRaw || []) as Array<{ story_id: string; day_id: string; completed: boolean; updated_at: string }>;
  const purchases = (purRaw || []) as Purchase[];
  const dayNum = new Map(days.map(d => [d.id, d.day_number]));
  const titles = new Map(storiesList.map(s => [s.id, s.title]));

  const stories: PlayerStoryProgress[] = storiesList.map(s => {
    const meta = (s.meta || {}) as StoryMeta;
    const mine = progresses.filter(p => p.story_id === s.id);
    const got = new Set(user.meta?.endings?.[s.id] || []);
    const open = mine.filter(p => !p.completed).map(p => dayNum.get(p.day_id) || 0).sort((a, b) => b - a)[0];
    const last = mine.reduce<string | null>((m, p) => (!m || p.updated_at > m ? p.updated_at : m), null);
    return {
      storyId: s.id,
      title: s.title,
      totalDays: days.filter(d => d.story_id === s.id && d.status === "published").length,
      completedDays: mine.filter(p => p.completed).length,
      currentDay: open || null,
      lastPlayedAt: last,
      endings: Object.entries(meta.endings || {}).map(([id, e]) => ({ id, title: e.title, unlocked: got.has(id) })),
      hasPass: purchases.some(p => p.story_id === s.id && p.product === "season_pass"),
    };
  });

  let referredBy: PlayerDetail["referredBy"] = null;
  if (user.referred_by) {
    const { data: r } = await supabase.from("users").select("id, first_name, last_name").eq("id", user.referred_by).maybeSingle();
    if (r) referredBy = { id: r.id, name: fullName(r as User) };
  }

  const chapters = progresses.filter(p => p.completed).length;
  return {
    player: {
      id: user.id,
      telegram_id: Number(user.telegram_id),
      name: fullName(user),
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      language_code: user.language_code || null,
      is_guest: !!user.is_guest,
      created_at: user.created_at,
      last_seen_at: user.last_seen_at || null,
      bot_blocked: !!user.bot_blocked,
      skip_credits: user.skip_credits || 0,
      free_access: !!user.meta?.free_access,
      free_access_at: user.meta?.free_access_at || null,
      free_access_note: user.meta?.free_access_note || null,
      chapters,
      stories: new Set(progresses.map(p => p.story_id)).size,
      endings: Object.values(user.meta?.endings || {}).reduce((a, l) => a + l.length, 0),
      stars: purchases.reduce((a, p) => a + (p.stars || 0), 0),
    },
    stories,
    purchases: purchases.map(p => ({ id: p.id, product: p.product, story_id: p.story_id, day_number: p.day_number, stars: p.stars, source: p.source, created_at: p.created_at, storyTitle: p.story_id ? titles.get(p.story_id) || null : null })),
    invited: (invitedRaw || []).length,
    referredBy,
    globalFree: config.freeAccess,
  };
}

async function patchMeta(userId: string, patch: (meta: NonNullable<User["meta"]>) => NonNullable<User["meta"]>) {
  const supabase = await db();
  const { data: u } = await supabase.from("users").select("meta").eq("id", userId).maybeSingle();
  if (!u) throw new Error("Игрок не найден");
  const meta = patch({ ...((u.meta || {}) as NonNullable<User["meta"]>) });
  const { error } = await supabase.from("users").update({ meta }).eq("id", userId);
  if (error) throw new Error(error.message);
}

function touch(userId: string) {
  revalidatePath("/admin/players");
  revalidatePath(`/admin/players/${userId}`);
}

/** Бесплатный доступ ко всем историям без ожидания и оплаты */
export async function setFreeAccess(userId: string, enabled: boolean, note?: string): Promise<{ ok: true }> {
  await requireAdmin();
  assertId(userId);
  await patchMeta(userId, meta => {
    if (enabled) {
      meta.free_access = true;
      meta.free_access_at = new Date().toISOString();
      const n = (note || "").trim().slice(0, 200);
      if (n) meta.free_access_note = n;
      else delete meta.free_access_note;
    } else {
      delete meta.free_access;
      delete meta.free_access_at;
      delete meta.free_access_note;
    }
    return meta;
  });
  touch(userId);
  return { ok: true };
}

/** Начислить (или списать, amount < 0) бесплатные пропуски ожидания */
export async function addSkipCredits(userId: string, amount: number): Promise<{ ok: true; credits: number }> {
  await requireAdmin();
  assertId(userId);
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100) throw new Error("Некорректное количество");
  const supabase = await db();
  const { data: u } = await supabase.from("users").select("skip_credits").eq("id", userId).maybeSingle();
  if (!u) throw new Error("Игрок не найден");
  const credits = Math.max(0, (u.skip_credits || 0) + amount);
  const { error } = await supabase.from("users").update({ skip_credits: credits }).eq("id", userId);
  if (error) throw new Error(error.message);
  touch(userId);
  return { ok: true, credits };
}

/** Подарить сезонный пропуск на одну историю */
export async function grantSeasonPass(userId: string, storyId: string): Promise<{ ok: true }> {
  await requireAdmin();
  assertId(userId);
  assertId(storyId);
  const supabase = await db();
  const { data: existing } = await supabase.from("purchases").select("id").eq("user_id", userId).eq("story_id", storyId).eq("product", "season_pass").limit(1);
  if (!existing || existing.length === 0) {
    const { error } = await supabase.from("purchases").insert({ user_id: userId, story_id: storyId, product: "season_pass", day_number: null, stars: 0, source: "gift", telegram_charge_id: null });
    if (error) throw new Error(error.message);
  }
  touch(userId);
  return { ok: true };
}

/** Сбросить прогресс игрока в истории (концовки и покупки сохраняются) */
export async function resetPlayerStory(userId: string, storyId: string): Promise<{ ok: true }> {
  await requireAdmin();
  assertId(userId);
  assertId(storyId);
  const supabase = await db();
  const { error } = await supabase.from("progresses").delete().eq("user_id", userId).eq("story_id", storyId);
  if (error) throw new Error(error.message);
  touch(userId);
  return { ok: true };
}
