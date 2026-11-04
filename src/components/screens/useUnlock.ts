"use client";

import { useCallback, useState } from "react";
import { createInvoice, getStoryView, redeemSkipCredit } from "@/lib/actions/player";
import { useApp } from "@/lib/telegram/TelegramProvider";

/** Пропуск ожидания: бесплатный пропуск или оплата Stars, с ожиданием подтверждения webhook */
export function useUnlock(storyId: string, onDone: () => void) {
  const { token, openInvoice, haptic } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waitForAccess = useCallback(
    async (check: (v: Awaited<ReturnType<typeof getStoryView>>) => boolean) => {
      for (let i = 0; i < 12; i++) {
        const v = await getStoryView(token, storyId);
        if (check(v)) return true;
        await new Promise(r => setTimeout(r, 1200));
      }
      return false;
    },
    [token, storyId]
  );

  const spendCredit = useCallback(
    async (dayNumber: number) => {
      setBusy(true);
      setError(null);
      const res = await redeemSkipCredit(token, storyId, dayNumber).catch(() => ({ ok: false, error: "Ошибка сети" }));
      setBusy(false);
      if (res.ok) {
        haptic("success");
        onDone();
      } else setError(res.error || "Не удалось");
    },
    [token, storyId, haptic, onDone]
  );

  const buy = useCallback(
    async (product: "skip_day" | "season_pass", dayNumber?: number) => {
      setBusy(true);
      setError(null);
      try {
        const inv = await createInvoice(token, { product, storyId, dayNumber });
        if (!inv.ok) {
          setError(inv.error);
          return;
        }
        const status = await openInvoice(inv.link);
        if (status === "paid" || status === "pending") {
          const ok = await waitForAccess(v =>
            !!v && (product === "season_pass" ? v.hasPass : v.days.some(d => d.dayNumber === dayNumber && d.status !== "waiting"))
          );
          if (ok) {
            haptic("success");
            onDone();
          } else if (status === "paid") {
            setError("Оплата прошла, доступ появится через минуту. Обновите страницу.");
          }
        } else if (status === "failed") {
          setError("Оплата не прошла");
        }
      } catch {
        setError("Ошибка сети");
      } finally {
        setBusy(false);
      }
    },
    [token, storyId, openInvoice, waitForAccess, haptic, onDone]
  );

  return { busy, error, spendCredit, buy };
}
