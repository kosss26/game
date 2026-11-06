"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { listPlayers, setFreeAccess, type PlayerFilter, type PlayerList } from "@/lib/actions/players";

const FILTERS: Array<{ id: PlayerFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "active", label: "Играют" },
  { id: "free", label: "Бесплатно" },
  { id: "buyers", label: "Покупатели" },
  { id: "blocked", label: "Заблокировали бота" },
  { id: "guests", label: "Гости" },
];

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 2) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function PlayersList() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<PlayerFilter>("all");
  const [limit, setLimit] = useState(50);
  const [data, setData] = useState<PlayerList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(() => {
    const id = ++reqId.current;
    setError(null);
    listPlayers({ q, filter, limit })
      .then(r => {
        if (id === reqId.current) setData(r);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Ошибка загрузки"));
  }, [q, filter, limit]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const toggleFree = async (userId: string, enabled: boolean) => {
    setBusy(userId);
    try {
      await setFreeAccess(userId, enabled);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-4 py-6">
      <h2 className="mb-1 text-xl font-bold text-tg-text">Игроки</h2>
      {data && (
        <p className="mb-4 text-sm text-tg-text-hint">
          {data.totals.players} игроков · {data.totals.free} с бесплатным доступом · {data.totals.buyers} покупателей
          {data.totals.guests ? ` · ${data.totals.guests} гостей` : ""}
        </p>
      )}
      {data?.globalFree && (
        <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          Сейчас бесплатный режим включён для всех (FREE_ACCESS). Отметка «бесплатно» у игрока начнёт работать, когда вы вернёте оплату.
        </div>
      )}

      <input
        value={q}
        onChange={e => {
          setQ(e.target.value);
          setLimit(50);
        }}
        placeholder="Имя, @username или Telegram ID"
        className="mb-3 w-full rounded-xl border border-tg-border bg-tg-bg-secondary px-4 py-3 text-tg-text outline-none focus:border-tg-accent"
      />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => {
              setFilter(f.id);
              setLimit(50);
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${filter === f.id ? "bg-tg-accent text-white" : "bg-tg-bg-secondary text-tg-text-secondary"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      {!data ? (
        <p className="text-sm text-tg-text-hint">Загрузка…</p>
      ) : data.rows.length === 0 ? (
        <p className="rounded-xl bg-tg-bg-secondary p-6 text-center text-sm text-tg-text-hint">Никого не нашли</p>
      ) : (
        <div className="space-y-2">
          {data.rows.map(r => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl border border-tg-border bg-tg-bg-secondary p-3">
              <Link href={`/admin/players/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-tg-accent/20 text-sm font-semibold text-tg-accent">
                  {r.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (r.name || "?").slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-tg-text">{r.name || "Без имени"}</span>
                    {r.free_access && <span className="shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] text-green-400">бесплатно</span>}
                    {r.stars > 0 && <span className="shrink-0 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[11px] text-yellow-300">{r.stars} ⭐</span>}
                    {r.bot_blocked && <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-400">бот заблокирован</span>}
                  </span>
                  <span className="block truncate text-xs text-tg-text-hint">
                    {r.username ? `@${r.username} · ` : ""}
                    {r.chapters} гл. · {r.endings} концовок · {timeAgo(r.last_seen_at)}
                  </span>
                </span>
              </Link>
              {!r.is_guest && (
                <button
                  disabled={busy === r.id}
                  onClick={() => toggleFree(r.id, !r.free_access)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50 ${r.free_access ? "bg-tg-bg text-tg-text-secondary" : "bg-tg-accent text-white"}`}
                >
                  {r.free_access ? "Отозвать" : "Открыть бесплатно"}
                </button>
              )}
            </div>
          ))}
          {data.hasMore && (
            <button onClick={() => setLimit(l => l + 50)} className="w-full rounded-xl bg-tg-bg-secondary py-3 text-sm text-tg-accent">
              Показать ещё
            </button>
          )}
        </div>
      )}
    </div>
  );
}
