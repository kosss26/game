import { cookies, headers } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { verifyTelegramWebAppData, type TelegramUser } from "@/lib/telegram/verify";
import type { User, AdminRole } from "@/lib/types/database";

const SESSION_COOKIE = "tg_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

interface SessionData {
  userId: string;
  telegramId: number;
  expiresAt: number;
}

/**
 * Get current user from session or Telegram initData
 */
export async function getCurrentUser(): Promise<User | null> {
  // Try to get from cookie session first
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  
  if (sessionCookie) {
    try {
      const session = JSON.parse(sessionCookie.value) as SessionData;
      
      if (session.expiresAt > Date.now()) {
        const supabase = await createAdminSupabaseClient();
        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.userId)
          .single();
        
        if (user) {
          return user as User;
        }
      }
    } catch {
      // Invalid session cookie
    }
  }

  // Try to authenticate from Telegram initData header
  const headersList = await headers();
  const initData = headersList.get("x-telegram-init-data");
  
  if (initData) {
    const telegramData = verifyTelegramWebAppData(initData);
    
    if (telegramData?.user) {
      return await upsertUserFromTelegram(telegramData.user);
    }
  }

  // Development mode fallback
  if (process.env.NODE_ENV === "development") {
    return getOrCreateDevUser();
  }

  return null;
}

/**
 * Authenticate user from Telegram initData
 */
export async function authenticateFromTelegram(initData: string): Promise<User | null> {
  const telegramData = verifyTelegramWebAppData(initData);
  
  if (!telegramData?.user) {
    return null;
  }

  const user = await upsertUserFromTelegram(telegramData.user);
  
  if (user) {
    await createSession(user);
  }

  return user;
}

/**
 * Create or update user from Telegram data
 */
async function upsertUserFromTelegram(telegramUser: TelegramUser): Promise<User | null> {
  const supabase = await createAdminSupabaseClient();

  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramUser.id)
    .single();

  if (existingUser) {
    // Update user info if changed
    const { data: updatedUser } = await supabase
      .from("users")
      .update({
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name || null,
        username: telegramUser.username || null,
        photo_url: telegramUser.photo_url || null,
      })
      .eq("id", existingUser.id)
      .select()
      .single();
    
    return updatedUser as User;
  }

  // Create new user
  const { data: newUser } = await supabase
    .from("users")
    .insert({
      telegram_id: telegramUser.id,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name || null,
      username: telegramUser.username || null,
      photo_url: telegramUser.photo_url || null,
    })
    .select()
    .single();

  return newUser as User;
}

/**
 * Create session cookie
 */
async function createSession(user: User): Promise<void> {
  const cookieStore = await cookies();
  
  const session: SessionData = {
    userId: user.id,
    telegramId: user.telegram_id,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  };

  cookieStore.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none", // Required for Telegram WebApp
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Check if user is admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const supabase = await createAdminSupabaseClient();
  
  const { data } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", userId)
    .single();

  return !!data && ["editor", "admin"].includes(data.role);
}

/**
 * Get user admin role
 */
export async function getUserAdminRole(userId: string): Promise<AdminRole | null> {
  const supabase = await createAdminSupabaseClient();
  
  const { data } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", userId)
    .single();

  return data?.role as AdminRole || null;
}

// Hardcoded админы по Telegram ID (работает без БД)
const HARDCODED_ADMIN_TELEGRAM_IDS = [1763619724];

/**
 * Require admin access - throws if not admin
 */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized: No user session");
  }

  // Проверяем по hardcoded списку ИЛИ по БД
  const isHardcodedAdmin = HARDCODED_ADMIN_TELEGRAM_IDS.includes(user.telegram_id);
  const isDbAdmin = await isUserAdmin(user.id).catch(() => false);
  
  if (!isHardcodedAdmin && !isDbAdmin) {
    throw new Error("Forbidden: Admin access required");
  }

  return user;
}

/**
 * Development mode: get or create dev user
 */
async function getOrCreateDevUser(): Promise<User | null> {
  const supabase = await createAdminSupabaseClient();
  const devTelegramId = 123456789;

  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", devTelegramId)
    .single();

  if (existingUser) {
    return existingUser as User;
  }

  const { data: newUser } = await supabase
    .from("users")
    .insert({
      telegram_id: devTelegramId,
      first_name: "Dev",
      last_name: "User",
      username: "devuser",
    })
    .select()
    .single();

  return newUser as User;
}
