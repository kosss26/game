import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import { verifyTelegramWebAppData, type TelegramUser } from "@/lib/telegram/verify";
import { signToken, verifyToken } from "./token";
import type { User } from "@/lib/types/database";

export const SESSION_COOKIE = "pl_session";
export const ADMIN_COOKIE = "pl_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const ADMIN_TTL_MS = 1000 * 60 * 60 * 12;

function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    // Mini App открывается во фрейме web.telegram.org → нужен SameSite=None; Secure
    secure: config.isProduction,
    sameSite: (config.isProduction ? "none" : "lax") as "none" | "lax",
    maxAge: Math.floor(maxAgeMs / 1000),
    path: "/",
  };
}

export function issueSessionToken(userId: string): string {
  return signToken({ uid: userId, exp: Date.now() + SESSION_TTL_MS });
}

async function setSessionCookie(token: string) {
  try {
    const store = await cookies();
    store.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS));
  } catch {
    // вызов вне server action / route handler — cookie не установить
  }
}

async function getUserById(id: string): Promise<User | null> {
  const supabase = await db();
  const { data } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  return (data as User) || null;
}

/**
 * Текущий пользователь: сначала явный токен (передаётся клиентом, работает
 * даже при заблокированных сторонних cookie), затем cookie.
 */
export async function resolveUser(token?: string | null): Promise<User | null> {
  const fromToken = verifyToken(token);
  if (fromToken?.uid) return getUserById(fromToken.uid);
  try {
    const store = await cookies();
    const payload = verifyToken(store.get(SESSION_COOKIE)?.value);
    if (payload?.uid) return getUserById(payload.uid);
  } catch {
    // нет контекста запроса
  }
  return null;
}

async function upsertTelegramUser(tg: TelegramUser, startParam?: string): Promise<{ user: User; isNew: boolean } | null> {
  const supabase = await db();
  const profile = {
    first_name: tg.first_name.slice(0, 128),
    last_name: tg.last_name?.slice(0, 128) || null,
    username: tg.username?.slice(0, 64) || null,
    photo_url: tg.photo_url?.slice(0, 512) || null,
    language_code: tg.language_code?.slice(0, 8) || null,
    last_seen_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase.from("users").select("*").eq("telegram_id", tg.id).maybeSingle();
  if (existing) {
    const { data } = await supabase.from("users").update({ ...profile, bot_blocked: false }).eq("id", existing.id).select().single();
    return { user: (data || existing) as User, isNew: false };
  }

  // Реферальная ссылка: startapp=ref_<telegram_id>
  let referredBy: string | null = null;
  const ref = startParam?.match(/^ref_(\d{1,15})$/);
  if (ref && Number(ref[1]) !== tg.id) {
    const { data: referrer } = await supabase.from("users").select("id").eq("telegram_id", Number(ref[1])).maybeSingle();
    referredBy = referrer?.id || null;
  }

  const { data: created, error } = await supabase
    .from("users")
    .insert({ telegram_id: tg.id, ...profile, referred_by: referredBy })
    .select()
    .single();

  if (error) {
    // гонка: пользователь создан параллельным запросом
    const { data: again } = await supabase.from("users").select("*").eq("telegram_id", tg.id).maybeSingle();
    return again ? { user: again as User, isNew: false } : null;
  }

  if (referredBy && config.referralBonus > 0) {
    await supabase.rpc("grant_skip_credit", { p_user_id: referredBy, p_amount: config.referralBonus });
  }
  return { user: created as User, isNew: true };
}

export interface SignInResult {
  token: string;
  user: {
    id: string;
    telegram_id: number;
    first_name: string;
    username: string | null;
    photo_url: string | null;
    is_guest: boolean;
    skip_credits: number;
  };
  isAdmin: boolean;
  isNew: boolean;
}

function publicUser(u: User): SignInResult["user"] {
  return {
    id: u.id,
    telegram_id: u.telegram_id,
    first_name: u.first_name,
    username: u.username,
    photo_url: u.photo_url,
    is_guest: !!u.is_guest,
    skip_credits: u.skip_credits ?? 0,
  };
}

export async function signInWithInitData(initData: string): Promise<SignInResult | null> {
  const data = verifyTelegramWebAppData(initData);
  if (!data?.user) return null;
  const res = await upsertTelegramUser(data.user, data.start_param);
  if (!res) return null;
  const token = issueSessionToken(res.user.id);
  await setSessionCookie(token);
  return { token, user: publicUser(res.user), isAdmin: await isUserAdmin(res.user), isNew: res.isNew };
}

/** Повторный вход по сохранённому токену (гости и браузер) */
export async function signInWithToken(token: string): Promise<SignInResult | null> {
  const payload = verifyToken(token);
  if (!payload?.uid) return null;
  const user = await getUserById(payload.uid);
  if (!user) return null;
  const fresh = issueSessionToken(user.id);
  await setSessionCookie(fresh);
  return { token: fresh, user: publicUser(user), isAdmin: await isUserAdmin(user), isNew: false };
}

/** Гость (браузер вне Telegram). Отрицательный telegram_id не пересекается с реальными. */
export async function signInGuest(): Promise<SignInResult | null> {
  if (!config.allowWebGuests) return null;
  const supabase = await db();
  const guestId = -(crypto.randomInt(1, 2 ** 47));
  const { data, error } = await supabase
    .from("users")
    .insert({ telegram_id: guestId, first_name: "Гость", is_guest: true })
    .select()
    .single();
  if (error || !data) return null;
  const user = data as User;
  const token = issueSessionToken(user.id);
  await setSessionCookie(token);
  return { token, user: publicUser(user), isAdmin: false, isNew: true };
}

export async function isUserAdmin(user: User | null): Promise<boolean> {
  if (!user || user.is_guest) return false;
  if (config.adminTelegramIds.includes(Number(user.telegram_id))) return true;
  const supabase = await db();
  const { data } = await supabase.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  return !!data && ["editor", "admin"].includes(data.role);
}

/** Есть ли у текущего запроса права администратора */
export async function hasAdminAccess(): Promise<boolean> {
  try {
    const store = await cookies();
    const adm = verifyToken(store.get(ADMIN_COOKIE)?.value);
    if (adm?.adm) return true;
  } catch {
    return false;
  }
  // Локальная демо-база в режиме разработки — админка открыта
  if (!config.isProduction && process.env.ADMIN_DEV_OPEN !== "false" && !config.adminPassword) return true;
  const user = await resolveUser();
  return isUserAdmin(user);
}

export class AccessDeniedError extends Error {
  constructor() {
    super("Нет доступа к админке");
  }
}

/** Бросает ошибку, если нет прав администратора. Вызывать в каждом admin action. */
export async function requireAdmin(): Promise<void> {
  if (!(await hasAdminAccess())) throw new AccessDeniedError();
}

export async function loginAdminWithPassword(password: string): Promise<boolean> {
  if (!config.adminPassword || typeof password !== "string") return false;
  const a = crypto.createHash("sha256").update(password).digest();
  const b = crypto.createHash("sha256").update(config.adminPassword).digest();
  if (!crypto.timingSafeEqual(a, b)) return false;
  const store = await cookies();
  store.set(ADMIN_COOKIE, signToken({ adm: true, exp: Date.now() + ADMIN_TTL_MS }), cookieOptions(ADMIN_TTL_MS));
  return true;
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
