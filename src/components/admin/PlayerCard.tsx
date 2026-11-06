"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addSkipCredits, grantSeasonPass, resetPlayerStory, setFreeAccess, type PlayerDetail } from "@/lib/actions/players";
import { timeAgo } from "./PlayersList";

const PRODUCT: Record<string, string> = { skip_day: "Пропуск ожидания", season_pass: "Сезонный пропуск" };
const SOURCE: Record<string, string> = { stars: "Stars", credit: "бонус", gift: "подарок" };

export function PlayerCard({ detail }: { detail: PlayerDetail }) {
  const router = useRouter();
  const p = detail.player;
  const [note, setNote] = useState(p.free_access_note || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <Link href="/admin/players" className="text-sm text-tg-accent">
        ← Все игроки
      </Link>

      <div className="mt-4 flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-tg-accent/20 text-2xl font-semibold text-tg-accent">
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (p.name || "?").slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-tg-text">{p.name || "Без имени"}</h2>
          <p className="text-sm text-tg-text-hint">
            {p.username ? `@${p.username} · ` : ""}ID {p.telegram_id}
            {p.is_guest ? " · гость" : ""}
          </p>
          <p className="text-xs text-tg-text-hint">
            С нами с {new Date(p.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} · был(а) {timeAgo(p.last_seen_at)}
            {p.bot_blocked ? " · заблокировал(а) бота" : ""}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        <Stat value={p.chapters} label="глав" />
        <Stat value={p.endings} label="концовок" />
        <Stat value={`${p.stars}⭐`} label="потрачено" />
        <Stat value={detail.invited} label="пригласил(а)" />
      </div>

      {/* Бесплатный доступ */}
      <section className="mt-6 rounded-xl border border-tg-border bg-tg-bg-secondary p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-tg-text">Бесплатный доступ</p>
            <p className="mt-0.5 text-sm text-tg-text-hint">
              Все истории без ожидания и оплаты. Предложения купить не показываются.
              {p.free_access && p.free_access_at ? ` Выдан ${new Date(p.free_access_at).toLocaleDateString("ru-RU")}.` : ""}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${p.free_access ? "bg-green-500/15 text-green-400" : "bg-tg-bg text-tg-text-hint"}`}>
            {p.free_access ? "включён" : "выключен"}
          </span>
        </div>
        {detail.globalFree && <p className="mt-2 text-xs text-yellow-300">Сейчас бесплатно всем (FREE_ACCESS). Эта отметка заработает, когда вы вернёте оплату.</p>}
        {!p.is_guest && (
          <>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Заметка: за что выдан (тестер, блогер, конкурс…)"
              className="mt-3 w-full rounded-lg border border-tg-border bg-tg-bg px-3 py-2 text-sm text-tg-text outline-none focus:border-tg-accent"
            />
            <div className="mt-3 flex gap-2">
              {p.free_access ? (
                <>
                  <button disabled={busy} onClick={() => run(() => setFreeAccess(p.id, true, note), "Заметка сохранена")} className="flex-1 rounded-lg bg-tg-bg py-2 text-sm text-tg-text disabled:opacity-50">
                    Сохранить заметку
                  </button>
                  <button disabled={busy} onClick={() => run(() => setFreeAccess(p.id, false), "Бесплатный доступ отозван")} className="flex-1 rounded-lg bg-red-500/15 py-2 text-sm text-red-400 disabled:opacity-50">
                    Отозвать
                  </button>
                </>
              ) : (
                <button disabled={busy} onClick={() => run(() => setFreeAccess(p.id, true, note), "Бесплатный доступ открыт")} className="flex-1 rounded-lg bg-tg-accent py-2.5 text-sm font-medium text-white disabled:opacity-50">
                  Открыть бесплатно
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Пропуски */}
      <section className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-tg-border bg-tg-bg-secondary p-4">
        <div>
          <p className="font-medium text-tg-text">Пропуски ожидания: {p.skip_credits}</p>
          <p className="text-sm text-tg-text-hint">Открывают одну главу без ожидания</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button disabled={busy || p.skip_credits === 0} onClick={() => run(() => addSkipCredits(p.id, -1), "Списан 1 пропуск")} className="h-9 w-9 rounded-lg bg-tg-bg text-tg-text disabled:opacity-40">
            −
          </button>
          <button disabled={busy} onClick={() => run(() => addSkipCredits(p.id, 1), "Начислен 1 пропуск")} className="h-9 rounded-lg bg-tg-bg px-3 text-tg-text disabled:opacity-40">
            +1
          </button>
          <button disabled={busy} onClick={() => run(() => addSkipCredits(p.id, 5), "Начислено 5 пропусков")} className="h-9 rounded-lg bg-tg-bg px-3 text-tg-text disabled:opacity-40">
            +5
          </button>
        </div>
      </section>

      {msg && <p className="mt-3 text-center text-sm text-tg-accent">{msg}</p>}

      {/* Истории */}
      <h3 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-tg-text-secondary">Истории</h3>
      <div className="space-y-2">
        {detail.stories.map(s => (
          <div key={s.storyId} className="rounded-xl border border-tg-border bg-tg-bg-secondary p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-tg-text">{s.title}</p>
                <p className="text-sm text-tg-text-hint">
                  {s.completedDays === 0 && !s.currentDay
                    ? "Не начинал(а)"
                    : `Пройдено глав: ${s.completedDays} из ${s.totalDays}${s.currentDay ? ` · сейчас глава ${s.currentDay}` : ""} · ${timeAgo(s.lastPlayedAt)}`}
                </p>
              </div>
              {s.hasPass && <span className="shrink-0 rounded-full bg-tg-accent/15 px-2 py-0.5 text-[11px] text-tg-accent">пропуск</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.endings.map(e => (
                <span key={e.id} className={`rounded-full px-2 py-0.5 text-[11px] ${e.unlocked ? "bg-tg-accent/20 text-tg-text" : "bg-tg-bg text-tg-text-hint"}`}>
                  {e.unlocked ? "★ " : ""}
                  {e.title}
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {!s.hasPass && !p.is_guest && (
                <button disabled={busy} onClick={() => run(() => grantSeasonPass(p.id, s.storyId), `Пропуск на «${s.title}» подарен`)} className="rounded-lg bg-tg-bg px-3 py-1.5 text-xs text-tg-text disabled:opacity-50">
                  Подарить пропуск на историю
                </button>
              )}
              {(s.completedDays > 0 || s.currentDay) && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Сбросить прогресс «${s.title}» у этого игрока? Концовки и покупки сохранятся.`)) run(() => resetPlayerStory(p.id, s.storyId), "Прогресс сброшен");
                  }}
                  className="rounded-lg bg-tg-bg px-3 py-1.5 text-xs text-red-400 disabled:opacity-50"
                >
                  Сбросить прогресс
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Покупки */}
      <h3 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-tg-text-secondary">Покупки</h3>
      {detail.purchases.length === 0 ? (
        <p className="rounded-xl bg-tg-bg-secondary p-4 text-sm text-tg-text-hint">Покупок нет</p>
      ) : (
        <div className="divide-y divide-tg-border rounded-xl border border-tg-border bg-tg-bg-secondary">
          {detail.purchases.map(x => (
            <div key={x.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 text-tg-text">
                {PRODUCT[x.product] || x.product}
                {x.storyTitle ? ` · ${x.storyTitle}` : ""}
                {x.day_number ? ` · глава ${x.day_number}` : ""}
                <span className="block text-xs text-tg-text-hint">{new Date(x.created_at).toLocaleString("ru-RU")}</span>
              </span>
              <span className="shrink-0 text-tg-text-secondary">{x.stars > 0 ? `${x.stars} ⭐` : SOURCE[x.source] || x.source}</span>
            </div>
          ))}
        </div>
      )}

      {detail.referredBy && (
        <p className="mt-6 text-sm text-tg-text-hint">
          Пришёл(пришла) по приглашению:{" "}
          <Link href={`/admin/players/${detail.referredBy.id}`} className="text-tg-accent">
            {detail.referredBy.name}
          </Link>
        </p>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl bg-tg-bg-secondary p-3 text-center">
      <p className="text-lg font-bold text-tg-text">{value}</p>
      <p className="text-[11px] text-tg-text-hint">{label}</p>
    </div>
  );
}
