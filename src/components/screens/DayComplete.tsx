"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getChoiceStats, getStoryView, type StoryView } from "@/lib/actions/player";
import { useApp } from "@/lib/telegram/TelegramProvider";
import type { Flags, HistoryEntry, SnapshotData, StoryMeta } from "@/lib/types/database";
import { foundClues } from "@/components/chat/ChatPlayer";
import { isActionChoice, stripAction } from "@/lib/engine/runtime";
import { Icon } from "@/components/ui/Icon";
import { Countdown } from "@/components/ui/Countdown";
import { CoverArt } from "@/components/ui/CoverArt";
import { useUnlock } from "./useUnlock";

interface Props {
  storyId: string;
  storyTitle: string;
  storyMeta: StoryMeta;
  coverStyle: string | null;
  dayNumber: number;
  dayTitle: string;
  recap: string | null;
  teaser: string | null;
  snapshot: SnapshotData;
  history: HistoryEntry[];
  flags?: Flags;
  ending: string | null;
  isLastDay: boolean;
  onPlay: (dayNumber: number) => void;
  onStory: () => void;
  onReread: () => void;
}

interface MadeChoice {
  sceneId: string;
  choiceId: string;
  prompt: string | null;
  options: Array<{ id: string; label: string }>;
}

export function DayComplete(p: Props) {
  const { token, share, haptic } = useApp();
  const [view, setView] = useState<StoryView | null>(null);
  const [stats, setStats] = useState<Record<string, Record<string, number>> | null>(null);

  const made = useMemo<MadeChoice[]>(() => {
    const out: MadeChoice[] = [];
    for (const h of p.history) {
      const m = h.id.match(/^reply:([^:]+):(.+)$/);
      if (!m) continue;
      const scene = p.snapshot.scenes.find(s => s.id === m[1]);
      const options = p.snapshot.choices
        .filter(c => c.scene_id === m[1])
        .sort((a, b) => a.sort_index - b.sort_index)
        .map(c => ({ id: c.id, label: isActionChoice(c.label) ? stripAction(c.label) : c.label }));
      if (options.length > 1 && out.length < 4) out.push({ sceneId: m[1], choiceId: m[2], prompt: scene?.meta?.prompt || null, options });
    }
    return out;
  }, [p.history, p.snapshot]);

  const refresh = useCallback(() => {
    getStoryView(token, p.storyId).then(setView).catch(() => undefined);
  }, [token, p.storyId]);

  useEffect(() => {
    haptic("success");
    refresh();
    if (made.length) getChoiceStats(made.map(m => m.sceneId)).then(setStats).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = view?.days.find(d => d.dayNumber > p.dayNumber);
  const unlock = useUnlock(p.storyId, refresh);
  const endingMeta = p.ending ? p.storyMeta.endings?.[p.ending] : null;
  const allEndings = Object.entries(p.storyMeta.endings || {});

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[46vh] opacity-60">
        <CoverArt style={p.coverStyle} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/70 to-ink" />
      </div>

      <div className="relative mx-auto max-w-md px-5 pb-10 pt-safe">
        <div className="pt-14 text-center animate-slide-up">
          <span className="chip bg-white/10 text-fg/80">
            {p.storyTitle} · День {p.dayNumber}
          </span>
          <h1 className="mt-4 font-display text-[32px] font-bold leading-tight tracking-tight text-fg">
            {p.isLastDay && endingMeta ? endingMeta.title : `«${p.dayTitle}»`}
          </h1>
          <p className="mt-1 text-[15px] text-muted">{p.isLastDay ? "История завершена" : "День завершён"}</p>
        </div>

        {(endingMeta?.description || p.recap) && (
          <blockquote className="mt-8 rounded-3xl bg-white/[0.05] p-5 font-serif text-[17px] italic leading-relaxed text-fg/90 ring-1 ring-white/[0.06] animate-slide-up">
            {endingMeta?.description || p.recap}
          </blockquote>
        )}

        {/* Следующий день */}
        {!p.isLastDay && (
          <section className="mt-6 card p-5 animate-slide-up" style={{ animationDelay: "120ms" }}>
            {!view ? (
              <div className="h-24 skeleton rounded-2xl" />
            ) : next ? (
              <NextDay
                next={next}
                view={view}
                teaser={p.teaser}
                busy={unlock.busy}
                error={unlock.error}
                onPlay={() => p.onPlay(next.dayNumber)}
                onCredit={() => unlock.spendCredit(next.dayNumber)}
                onBuy={() => unlock.buy("skip_day", next.dayNumber)}
                onPass={() => unlock.buy("season_pass")}
                onReady={refresh}
              />
            ) : (
              <div className="text-center">
                <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">День {p.dayNumber + 1}</p>
                <p className="mt-2 text-[16px] font-medium text-fg">Скоро продолжение</p>
                <p className="mt-1 text-[14px] text-muted">Мы пришлём сообщение в Telegram, как только новый день откроется.</p>
              </div>
            )}
          </section>
        )}

        {/* Улики */}
        {p.storyMeta.clues && Object.keys(p.storyMeta.clues).length > 0 && p.flags && (
          <section className="mt-6 card p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">
              <Icon name="search" size={16} /> Улики · {foundClues(p.flags, p.storyMeta).length}/{Object.keys(p.storyMeta.clues).length}
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {foundClues(p.flags, p.storyMeta).map(id => (
                <span key={id} className="chip bg-warn/15 px-3 py-1.5 text-[12.5px] text-fg/90">
                  {p.storyMeta.clues![id].title}
                </span>
              ))}
            </div>
            {!p.isLastDay && <p className="mt-3 text-[13px] text-muted">Улики переходят в следующие дни. Иногда важнее то, о чём промолчали.</p>}
          </section>
        )}

        {/* Концовки */}
        {p.isLastDay && allEndings.length > 0 && (
          <section className="mt-6 card p-5">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">
              <Icon name="trophy" size={16} /> Концовки · {new Set([...(view?.endingsUnlocked || []), ...(p.ending ? [p.ending] : [])]).size}/{allEndings.length}
            </h2>
            <ul className="mt-3 space-y-2">
              {allEndings.map(([id, e]) => {
                const got = id === p.ending || view?.endingsUnlocked.includes(id);
                return (
                  <li key={id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${got ? "bg-accent/10" : "bg-white/[0.03]"}`}>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${got ? "bg-accent text-white" : "bg-white/[0.06] text-faint"}`}>
                      <Icon name={got ? "star" : "lock"} size={15} />
                    </span>
                    <span className={`text-[15px] ${got ? "text-fg" : "text-faint"}`}>{got || !e.secret ? e.title : "???"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[13px] text-muted">Другие решения ведут к другим финалам. Начните историю заново со страницы истории.</p>
          </section>
        )}

        {/* Статистика выборов */}
        {made.length > 0 && (
          <section className="mt-6 card p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">Как выбирали другие</h2>
            <div className="mt-4 space-y-5">
              {made.map(m => {
                const counts = stats?.[m.sceneId] || {};
                const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
                return (
                  <div key={m.sceneId}>
                    {m.prompt && <p className="mb-2 text-[13px] text-muted">{m.prompt}</p>}
                    <div className="space-y-1.5">
                      {m.options.map(o => {
                        const pct = stats ? Math.round(((counts[o.id] || 0) / total) * 100) : 0;
                        const mine = o.id === m.choiceId;
                        return (
                          <div key={o.id} className="relative overflow-hidden rounded-xl bg-white/[0.04]">
                            <div
                              className={`absolute inset-y-0 left-0 transition-[width] duration-700 ${mine ? "bg-accent/30" : "bg-white/[0.06]"}`}
                              style={{ width: `${pct}%` }}
                            />
                            <div className="relative flex items-center justify-between gap-3 px-3 py-2">
                              <span className={`truncate text-[14px] ${mine ? "font-medium text-fg" : "text-muted"}`}>
                                {mine && <Icon name="check" size={14} className="mr-1 inline text-accent" />}
                                {o.label}
                              </span>
                              <span className="shrink-0 text-[13px] tabular-nums text-faint">{stats ? `${pct}%` : "…"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Пригласить друга */}
        {view?.shareLink && !view.isGuest && (
          <button
            onClick={() => share(view.shareLink, p.storyMeta.share_text || `«${p.storyTitle}» — ${p.storyMeta.tagline || "интерактивная история в Telegram"}`)}
            className="mt-6 flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-accent/20 to-accent-2/10 p-4 text-left ring-1 ring-accent/25 active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/25 text-accent">
              <Icon name="gift" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-fg">Позовите друга</span>
              <span className="block text-[13px] text-muted">За каждого — бесплатный пропуск ожидания</span>
            </span>
            <Icon name="share" className="text-muted" />
          </button>
        )}

        <div className="mt-8 grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={p.onReread}>
            <Icon name="book" size={18} /> Переписка
          </button>
          <button className="btn-secondary" onClick={p.onStory}>
            К истории
          </button>
        </div>
      </div>
    </div>
  );
}

function NextDay({
  next,
  view,
  teaser,
  busy,
  error,
  onPlay,
  onCredit,
  onBuy,
  onPass,
  onReady,
}: {
  next: StoryView["days"][number];
  view: StoryView;
  teaser: string | null;
  busy: boolean;
  error: string | null;
  onPlay: () => void;
  onCredit: () => void;
  onBuy: () => void;
  onPass: () => void;
  onReady: () => void;
}) {
  const playable = next.status === "available" || next.status === "in_progress";
  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">Далее · День {next.dayNumber}</p>
      <p className="mt-1.5 text-[18px] font-semibold text-fg">{next.title}</p>
      {teaser && <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{teaser}</p>}

      {playable && (
        <button className="btn-primary mt-4 w-full" onClick={onPlay}>
          <Icon name="play" size={16} /> Читать дальше
        </button>
      )}

      {next.status === "waiting" && next.unlocksAt && (
        <>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
            <Icon name="clock" className="text-accent" />
            <div>
              <p className="text-[13px] text-faint">Откроется через</p>
              <p className="text-[20px] font-semibold text-fg">
                <Countdown until={next.unlocksAt} onDone={onReady} />
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {view.credits > 0 ? (
              <button className="btn-primary w-full" disabled={busy} onClick={onCredit}>
                <Icon name="gift" size={18} /> Открыть сейчас · бесплатно ({view.credits})
              </button>
            ) : view.paymentsEnabled ? (
              <button className="btn-primary w-full" disabled={busy} onClick={onBuy}>
                <Icon name="bolt" size={18} /> Не ждать · {view.prices.skipDay} ⭐
              </button>
            ) : null}
            {view.paymentsEnabled && !view.hasPass && (
              <button className="btn-secondary w-full" disabled={busy} onClick={onPass}>
                Вся история без ожидания · {view.prices.seasonPass} ⭐
              </button>
            )}
          </div>
          <p className="mt-3 text-center text-[12.5px] text-faint">Пришлём уведомление в Telegram, когда день откроется</p>
        </>
      )}

      {next.status === "not_released" && next.unlocksAt && (
        <p className="mt-4 text-[14px] text-muted">
          Выход нового дня: <Countdown until={next.unlocksAt} compact onDone={onReady} />
        </p>
      )}
      {error && <p className="mt-3 text-center text-[13px] text-danger">{error}</p>}
    </div>
  );
}
