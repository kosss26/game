"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoryView, restartStory, type StoryView } from "@/lib/actions/player";
import { useApp, useBackButton } from "@/lib/telegram/TelegramProvider";
import type { DayAccess } from "@/lib/game/access";
import { CoverArt } from "@/components/ui/CoverArt";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Countdown } from "@/components/ui/Countdown";
import { ErrorState, FullscreenLoader } from "@/components/ui/States";
import { useUnlock } from "./useUnlock";

export function StoryScreen({ storyId }: { storyId: string }) {
  const router = useRouter();
  const { ready, token, confirm, share, haptic } = useApp();
  const [view, setView] = useState<StoryView | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getStoryView(token, storyId)
      .then(setView)
      .catch(() => setFailed(true));
  }, [token, storyId]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const native = useBackButton(() => router.push("/"));
  const unlock = useUnlock(storyId, load);

  if (!ready || (view === undefined && !failed)) return <FullscreenLoader />;
  if (failed) return <ErrorState title="Нет соединения" action={load} />;
  if (!view) return <ErrorState icon="book" title="История не найдена" href="/" actionLabel="На главную" />;

  const { story, days } = view;
  const meta = story.meta;
  const current = days.find(d => d.status === "in_progress") || days.find(d => d.status === "available");
  const waiting = days.find(d => d.status === "waiting" || d.status === "not_released");
  const completed = days.filter(d => d.status === "completed").length;
  const finished = days.length > 0 && completed === days.length && view.upcomingDays === 0;
  const totalMinutes = days.reduce((a, d) => a + (d.minutes || 12), 0);
  const characters = Object.entries(meta.characters || {}).filter(([, c]) => c.bio);
  const endings = Object.entries(meta.endings || {});

  const onRestart = async () => {
    if (!(await confirm("Начать историю заново? Прогресс будет сброшен, открытые концовки сохранятся."))) return;
    haptic("warning");
    await restartStory(token, storyId);
    load();
  };

  return (
    <main className="min-h-[100dvh] bg-ink pb-[calc(110px+env(safe-area-inset-bottom))]">
      {/* Обложка */}
      <div className="grain relative h-[52vh] min-h-[340px] overflow-hidden">
        <CoverArt style={story.cover_style} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-ink" />
        {!native && (
          <Link href="/" className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur pt-safe" aria-label="Назад">
            <Icon name="back" size={22} />
          </Link>
        )}
      </div>

      <div className="relative -mt-28 px-5">
        <div className="flex flex-wrap gap-1.5">
          {meta.genre && <span className="chip bg-white/10 text-fg/85">{meta.genre}</span>}
          <span className="chip bg-white/10 text-fg/85">{days.length + view.upcomingDays} дней</span>
          <span className="chip bg-white/10 text-fg/85">~{totalMinutes} мин</span>
          {meta.age_rating && <span className="chip bg-white/10 text-fg/85">{meta.age_rating}</span>}
        </div>
        <h1 className="mt-3 font-display text-[34px] font-bold leading-[1.08] tracking-tight text-fg">{story.title}</h1>
        {meta.tagline && <p className="mt-2 text-[16px] leading-snug text-fg/80">{meta.tagline}</p>}
        {story.description && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-muted">{story.description}</p>}
      </div>

      {/* Персонажи */}
      {characters.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 px-5 text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">Персонажи</h2>
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
            {characters.map(([id, c]) => (
              <div key={id} className="card w-[210px] shrink-0 p-4">
                <div className="flex items-center gap-3">
                  <Avatar id={id} character={c} size={44} />
                  <p className="text-[16px] font-semibold text-fg">{c.name}</p>
                </div>
                <p className="mt-3 text-[13.5px] leading-snug text-muted">{c.bio}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Дни */}
      <section className="mt-8 px-4">
        <h2 className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">
          Дни · {completed}/{days.length + view.upcomingDays}
        </h2>
        <ol className="space-y-2">
          {days.map(d => (
            <DayRow key={d.dayId} day={d} storyId={storyId} view={view} unlock={unlock} onReady={load} />
          ))}
          {Array.from({ length: view.upcomingDays }, (_, i) => (
            <li key={`up${i}`} className="flex items-center gap-3 rounded-3xl border border-dashed border-white/10 px-4 py-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-faint">
                <Icon name="sparkle" size={18} />
              </span>
              <span className="text-[14.5px] text-faint">День {days.length + i + 1} · скоро</span>
            </li>
          ))}
        </ol>
        {unlock.error && <p className="mt-3 text-center text-[13px] text-danger">{unlock.error}</p>}
      </section>

      {/* Сезонный пропуск */}
      {view.paymentsEnabled && !view.hasPass && !finished && days.length > 1 && (
        <section className="mx-4 mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-accent/25 via-accent/10 to-transparent p-5 ring-1 ring-accent/30">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/30 text-white">
              <Icon name="bolt" size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-fg">Без ожидания</p>
              <p className="mt-0.5 text-[13.5px] leading-snug text-muted">Все дни этой истории открываются сразу после предыдущего. Один раз и навсегда.</p>
            </div>
          </div>
          <button className="btn-primary mt-4 w-full" disabled={unlock.busy} onClick={() => unlock.buy("season_pass")}>
            Открыть за {view.prices.seasonPass} ⭐
          </button>
        </section>
      )}
      {view.hasPass && (
        <p className="mx-4 mt-6 flex items-center justify-center gap-2 rounded-2xl bg-accent/10 py-3 text-[14px] text-fg/90">
          <Icon name="bolt" size={16} className="text-accent" /> Сезонный пропуск активен
        </p>
      )}

      {/* Концовки */}
      {endings.length > 0 && (completed > 0 || view.endingsUnlocked.length > 0) && (
        <section className="mx-4 mt-6 card p-5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">
            <Icon name="trophy" size={16} /> Концовки · {view.endingsUnlocked.length}/{endings.length}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {endings.map(([id, e]) => {
              const got = view.endingsUnlocked.includes(id);
              return (
                <span key={id} className={`chip px-3 py-1.5 text-[12.5px] ${got ? "bg-accent/20 text-fg" : "text-faint"}`}>
                  <Icon name={got ? "star" : "lock"} size={12} /> {got || !e.secret ? e.title : "???"}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Друзья и сброс */}
      <section className="mx-4 mt-6 grid grid-cols-2 gap-2">
        {!view.isGuest && view.shareLink ? (
          <button className="btn-secondary" onClick={() => share(view.shareLink, meta.share_text || `«${story.title}» — ${meta.tagline || "интерактивная история"}`)}>
            <Icon name="gift" size={18} /> Пригласить
          </button>
        ) : (
          <span />
        )}
        {completed > 0 ? (
          <button className="btn-ghost" onClick={onRestart}>
            <Icon name="refresh" size={17} /> Заново
          </button>
        ) : (
          <span />
        )}
      </section>
      {!view.isGuest && (
        <p className="mx-6 mt-2 text-center text-[12.5px] text-faint">
          Друг по вашей ссылке = бесплатный пропуск ожидания{view.credits > 0 ? ` · у вас ${view.credits}` : ""}
        </p>
      )}

      {/* Нижняя кнопка */}
      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.06] px-4 pt-3 pb-safe">
        <div className="pb-3">
          {current ? (
            <Link href={`/play/${storyId}/${current.dayNumber}`} className="btn-primary w-full text-[16px]">
              <Icon name="play" size={16} />
              {current.status === "in_progress" ? `Продолжить · День ${current.dayNumber}` : completed === 0 ? "Начать историю" : `Читать · День ${current.dayNumber}`}
            </Link>
          ) : waiting?.unlocksAt ? (
            <div className="btn-secondary w-full cursor-default">
              <Icon name="clock" size={17} /> День {waiting.dayNumber} через&nbsp;
              <Countdown until={waiting.unlocksAt} compact onDone={load} />
            </div>
          ) : finished ? (
            <Link href={`/play/${storyId}/${days[days.length - 1].dayNumber}`} className="btn-secondary w-full">
              <Icon name="trophy" size={17} /> История пройдена · итоги
            </Link>
          ) : (
            <div className="btn-secondary w-full cursor-default">Продолжение скоро</div>
          )}
        </div>
      </div>
    </main>
  );
}

function DayRow({
  day,
  storyId,
  view,
  unlock,
  onReady,
}: {
  day: DayAccess;
  storyId: string;
  view: StoryView;
  unlock: ReturnType<typeof useUnlock>;
  onReady: () => void;
}) {
  const playable = day.status === "available" || day.status === "in_progress" || day.status === "completed";
  const badge =
    day.status === "completed" ? (
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ok/15 text-ok">
        <Icon name="check" size={18} strokeWidth={2.4} />
      </span>
    ) : day.status === "available" || day.status === "in_progress" ? (
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[15px] font-bold text-white shadow-glow">{day.dayNumber}</span>
    ) : (
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-faint">
        <Icon name={day.status === "waiting" ? "clock" : "lock"} size={17} />
      </span>
    );

  const body = (
    <div className={`flex items-center gap-3 rounded-3xl px-4 py-3.5 transition ${playable ? "bg-raised/80 ring-1 ring-white/[0.06] active:scale-[0.99]" : "bg-surface/60"}`}>
      {badge}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15.5px] font-medium ${playable ? "text-fg" : "text-muted"}`}>
          <span className="text-faint">День {day.dayNumber} · </span>
          {day.title}
        </p>
        <p className="text-[12.5px] text-faint">
          {day.status === "completed" && "Пройден · перечитать"}
          {day.status === "in_progress" && "В процессе"}
          {day.status === "available" && `~${day.minutes || 12} мин`}
          {day.status === "locked" && "Откроется после предыдущего дня"}
          {day.status === "waiting" && day.unlocksAt && (
            <>
              Откроется через <Countdown until={day.unlocksAt} compact onDone={onReady} />
            </>
          )}
          {day.status === "not_released" && day.unlocksAt && (
            <>
              Выход: {new Date(day.unlocksAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
            </>
          )}
        </p>
      </div>
      {playable && <Icon name="chevron" className="text-faint" />}
    </div>
  );

  return (
    <li>
      {playable ? <Link href={`/play/${storyId}/${day.dayNumber}`}>{body}</Link> : body}
      {day.status === "waiting" && day.skippable && (view.credits > 0 || view.paymentsEnabled) && (
        <div className="mt-1.5 flex gap-2 px-1">
          {view.credits > 0 ? (
            <button className="btn-secondary min-h-[40px] flex-1 text-[14px]" disabled={unlock.busy} onClick={() => unlock.spendCredit(day.dayNumber)}>
              <Icon name="gift" size={16} /> Открыть бесплатно
            </button>
          ) : (
            <button className="btn-secondary min-h-[40px] flex-1 text-[14px]" disabled={unlock.busy} onClick={() => unlock.buy("skip_day", day.dayNumber)}>
              <Icon name="bolt" size={16} /> Открыть сейчас · {view.prices.skipDay} ⭐
            </button>
          )}
        </div>
      )}
    </li>
  );
}
