"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "@/lib/actions/auth";
import { withTimeout } from "@/lib/utils/with-timeout";
import { setupTelegramViewport, type TelegramViewport } from "./viewport";

// ---------------------------------------------------------------------------
// Типы Telegram WebApp (используемое подмножество)
// ---------------------------------------------------------------------------

type HapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";

export interface TelegramWebApp extends TelegramViewport {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string; username?: string }; start_param?: string };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  isVersionAtLeast?: (v: string) => boolean;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  HapticFeedback: {
    impactOccurred: (style: HapticStyle) => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  onEvent: (event: string, cb: (...args: any[]) => void) => void;
  offEvent: (event: string, cb: (...args: any[]) => void) => void;
  shareMessage?: (id: string, callback?: (sent: boolean) => void) => void;
  openInvoice?: (url: string, cb?: (status: "paid" | "cancelled" | "failed" | "pending") => void) => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  showConfirm?: (message: string, cb?: (ok: boolean) => void) => void;
  showAlert?: (message: string, cb?: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export interface Session {
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
}

export type Speed = "normal" | "fast" | "instant";

interface AppContextValue {
  webApp: TelegramWebApp | null;
  isTelegram: boolean;
  ready: boolean;
  session: Session | null;
  token: string | null;
  authError: boolean;
  retryAuth: () => void;
  haptic: (kind: HapticStyle | "success" | "error" | "warning" | "select") => void;
  speed: Speed;
  setSpeed: (s: Speed) => void;
  /** Выборы на время включены */
  timers: boolean;
  setTimers: (v: boolean) => void;
  confirm: (message: string) => Promise<boolean>;
  openInvoice: (url: string) => Promise<"paid" | "cancelled" | "failed" | "pending">;
  share: (url: string, text: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp вне AppProvider");
  return ctx;
}

/** Обратная совместимость */
export const useTelegram = useApp;

const TOKEN_KEY = "pl_token";
const SPEED_KEY = "pl_speed";
const TIMERS_KEY = "pl_timers";
const BG = "#090a0f";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // приватный режим
  }
}

function waitForTelegram(signal: AbortSignal, timeoutMs = 8000): Promise<TelegramWebApp | null> {
  return new Promise(resolve => {
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const finish = (tg: TelegramWebApp | null) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve(tg);
    };
    const abort = () => finish(null);
    const tick = () => {
      if (signal.aborted) return finish(null);
      const tg = window.Telegram?.WebApp;
      if (tg) return finish(tg);
      if (Date.now() - started >= timeoutMs) return finish(null);
      timer = setTimeout(tick, 50);
    };
    signal.addEventListener("abort", abort, { once: true });
    tick();
  });
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState(false);
  const [speed, setSpeedState] = useState<Speed>("normal");
  const [timers, setTimersState] = useState(true);

  useEffect(() => {
    const s = safeGet(SPEED_KEY);
    if (s === "normal" || s === "fast" || s === "instant") setSpeedState(s);
    if (safeGet(TIMERS_KEY) === "off") setTimersState(false);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new Event("polnoch:hydrated"));
    let cancelled = false;
    const controller = new AbortController();
    let removeInsetListeners: (() => void) | undefined;
    setReady(false);
    setAuthError(false);
    (async () => {
      const tg = await waitForTelegram(controller.signal);
      if (cancelled) return;
      // A missing SDK must not silently turn a Telegram player into a new guest.
      if (!tg) {
        setAuthError(true);
        setReady(true);
        return;
      }
      const inTelegram = !!tg && !!tg.initData;
      // Release Telegram's native loading screen before any network sign-in.
      try { tg.ready(); } catch { /* old clients */ }
      if (tg && inTelegram) {
        removeInsetListeners = setupTelegramViewport(tg, document.documentElement.style);
        try {
          tg.setHeaderColor?.(BG);
          tg.setBackgroundColor?.(BG);
          tg.setBottomBarColor?.(BG);
          tg.disableVerticalSwipes?.();
        } catch {
          // старые клиенты Telegram
        }
        if (!cancelled) setWebApp(tg);
      }

      const res = await withTimeout(
        signIn({ initData: inTelegram ? tg.initData : null, token: safeGet(TOKEN_KEY) }),
        15_000,
      ).catch(() => null);
      if (cancelled) return;
      if (res) {
        safeSet(TOKEN_KEY, res.token);
        setSession({ token: res.token, user: res.user, isAdmin: res.isAdmin });
        setAuthError(false);
      } else {
        setAuthError(true);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
      controller.abort();
      removeInsetListeners?.();
    };
  }, []);

  const haptic = useCallback<AppContextValue["haptic"]>(
    kind => {
      const h = webApp?.HapticFeedback;
      if (!h) return;
      try {
        if (kind === "success" || kind === "error" || kind === "warning") h.notificationOccurred(kind);
        else if (kind === "select") h.selectionChanged();
        else h.impactOccurred(kind);
      } catch {
        // ignore
      }
    },
    [webApp]
  );

  const setSpeed = useCallback((s: Speed) => {
    setSpeedState(s);
    safeSet(SPEED_KEY, s);
  }, []);

  const setTimers = useCallback((v: boolean) => {
    setTimersState(v);
    safeSet(TIMERS_KEY, v ? "on" : "off");
  }, []);

  const confirm = useCallback(
    (message: string) =>
      new Promise<boolean>(resolve => {
        if (webApp?.showConfirm) webApp.showConfirm(message, ok => resolve(!!ok));
        else resolve(window.confirm(message));
      }),
    [webApp]
  );

  const openInvoice = useCallback(
    (url: string) =>
      new Promise<"paid" | "cancelled" | "failed" | "pending">(resolve => {
        if (webApp?.openInvoice) webApp.openInvoice(url, status => resolve(status));
        else {
          window.open(url, "_blank");
          resolve("pending");
        }
      }),
    [webApp]
  );

  const share = useCallback(
    (url: string, text: string) => {
      const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
      if (webApp) webApp.openTelegramLink(link);
      else if (typeof navigator !== "undefined" && navigator.share) navigator.share({ url, text }).catch(() => undefined);
      else window.open(link, "_blank");
    },
    [webApp]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      webApp,
      isTelegram: !!webApp,
      ready,
      session,
      token: session?.token ?? null,
      authError,
      retryAuth: () => {
        // Next.js serializes server actions. Reload also releases a stalled queue.
        window.location.reload();
      },
      haptic,
      speed,
      setSpeed,
      timers,
      setTimers,
      confirm,
      openInvoice,
      share,
    }),
    [webApp, ready, session, authError, haptic, speed, setSpeed, timers, setTimers, confirm, openInvoice, share]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * Нативная кнопка «Назад» Telegram. Возвращает true, если она используется
 * (тогда экранную кнопку можно не показывать).
 */
export function useBackButton(onBack: () => void): boolean {
  const { webApp } = useApp();
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!webApp) return;
    const handler = () => ref.current();
    webApp.BackButton.onClick(handler);
    webApp.BackButton.show();
    return () => {
      webApp.BackButton.offClick(handler);
      webApp.BackButton.hide();
    };
  }, [webApp]);
  return !!webApp;
}
