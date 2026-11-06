"use client";

import { useEffect, useState } from "react";
import { getGlobalFreeMode, setGlobalFreeMode } from "@/lib/actions/players";

type Mode = { enabled: boolean; forced: boolean; updatedAt: string | null };

export function FreeModeToggle({ onChange }: { onChange?: (enabled: boolean) => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGlobalFreeMode().then(setMode).catch(() => setError("Не удалось загрузить настройку"));
  }, []);

  const toggle = async () => {
    if (!mode || mode.forced) return;
    const next = !mode.enabled;
    const text = next
      ? "Открыть все истории всем бесплатно? Ожидание между главами и оплата Stars отключатся для всех игроков сразу."
      : "Вернуть платный режим? Снова появятся ожидание между главами и покупки Stars. Бесплатные истории и игроки с персональным доступом останутся бесплатными.";
    if (!confirm(text)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await setGlobalFreeMode(next);
      setMode(r);
      onChange?.(r.enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const on = !!mode?.enabled;
  return (
    <section className={`rounded-xl border p-4 ${on ? "border-green-500/40 bg-green-500/10" : "border-tg-border bg-tg-bg-secondary"}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-tg-text">Всё бесплатно для всех</p>
          <p className="mt-0.5 text-sm text-tg-text-hint">
            {!mode
              ? "Загрузка…"
              : on
                ? "Включено: все истории открыты без ожидания и оплаты."
                : "Выключено: работают ожидание между главами и покупки Stars."}
          </p>
          {mode?.updatedAt && !mode.forced && <p className="mt-1 text-xs text-tg-text-hint">Изменено {new Date(mode.updatedAt).toLocaleString("ru-RU")}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Всё бесплатно для всех"
          disabled={!mode || busy || mode.forced}
          onClick={toggle}
          className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-green-500" : "bg-tg-bg"}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
        </button>
      </div>
      {mode?.forced && (
        <p className="mt-2 text-xs text-yellow-300">
          Включено принудительно строкой FREE_ACCESS=true в файле настроек сервера. Чтобы управлять отсюда, удалите эту строку и обновите приложение.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
