"use server";

import {
  signInWithInitData,
  signInWithToken,
  signInGuest,
  loginAdminWithPassword,
  logoutAdmin,
  type SignInResult,
} from "@/lib/auth/session";

/**
 * Вход игрока. Приоритет: Telegram initData → сохранённый токен → новый гость.
 */
export async function signIn(input: { initData?: string | null; token?: string | null }): Promise<SignInResult | null> {
  try {
    if (input.initData) {
      const res = await signInWithInitData(input.initData);
      if (res) return res;
    }
    if (input.token) {
      const res = await signInWithToken(input.token);
      if (res) return res;
    }
    if (!input.initData) return await signInGuest();
    return null;
  } catch (e) {
    console.error("signIn failed", e);
    return null;
  }
}

export async function adminLogin(password: string): Promise<{ ok: boolean }> {
  // Небольшая задержка против перебора
  await new Promise(r => setTimeout(r, 400));
  return { ok: await loginAdminWithPassword(password) };
}

export async function adminLogout(): Promise<void> {
  await logoutAdmin();
}
