"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile, type ProfileStory, type ProfileView } from "@/lib/actions/player";
import { useApp, useBackButton, type Speed } from "@/lib/telegram/TelegramProvider";
import { CoverArt } from "@/components/ui/CoverArt";
import { Icon } from "@/components/ui/Icon";
import { ErrorState, FullscreenLoader } from "@/components/ui/States";
import { plural } from "@/lib/utils/plural";

const SPEEDS: Array<{ id: Speed; title: string; hint: string }> = [
  { id: "normal", title: "Как в жизни", hint: "Реалистичный набор" },
  { id: "fast", title: "Быстро", hint: "Вдвое быстрее" },
  { id: "instant", title: "Мгновенно", hint: "Для перечитывания" },
];

export function ProfileScreen() {
  const router = useRouter();
  const { ready, token, session, speed, setSpeed, timers, setTimers, share, haptic } = useApp();
  const [view, setView] = useState<ProfileView | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = () => {
    setFailed(false);
    getProfile(token)
      .then(setView)
      .catch(() => setFailed(true));
  };

  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  const native = useBackButton(() => router.push("/"));

  if (!ready || (!view && !failed)) return <FullscreenLoader />;
  if (failed || !view) return <ErrorState title="Нет соединения" action={load} />;

  const initial = (view.name || session?.user.first_name || "?").slice(0, 1).toUpperCase();
  const onInvite = () => {
    haptic("select");
    share(view.shareLink, "Играю в «Полночь» — истории, которые происходят прямо в переписке. Попробуй, потом сравним концовки 🌙");
  };

  return (
    <main className="min-h-[100dvh] bg-ink pb-[calc(32px+env(safe-area-inset-bottom))]">
      <header className="relative px-5 pt-safe">
        <div className="flex h-14 items-center">
          {!native && (
            <Link href="/" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-white/5" aria-label="Назад">
              <Icon name="back" size={22} />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-accent-2 text-[26px] font-bold text-white shadow-glow">
            {view.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={view.photo} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[26px] font-bold leading-tight text-fg">{view.name || "Гость"}</h1>
            <p className="text-[14px] text-muted">
              {view.stats.chapters > 0
                ? `${view.stats.chapters} ${plural(view.stats.chapters, "глава прочитана", "главы прочитаны", "глав прочитано")}`
                : "Пока ни одной главы. Самое интересное впереди"}
            </p>
          </div>
        </div>

        {/* Статистика */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat value={view.stats.started} label={plural(view.stats.started, "история начата", "истории начаты", "историй начато")} />
          <Stat value={view.stats.finished} label={plural(view.stats.finished, "пройдена", "пройдены", "пройдено")} />
          <Stat value={`${view.stats.endings}/${view.stats.endingsTotal}`} label="концовок" accent />
        </div>
      </header>

      {/* Концовки */}
      <section className="mt-8 px-4">
        <h2 className="mb-3 flex items-center gap-2 px-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">
          <Icon name="trophy" size={15} /> Коллекция концовок
        </h2>
        <div className="space-y-2">
          {view.stories.map(s => (
            <EndingsCard key={s.id} story={s} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} />
          ))}
        </div>
      </section>

      {/* Настройки */}
      <section className="mt-8 px-4">
        <h2 className="mb-3 flex items-center gap-2 px-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">
          <Icon name="settings" size={15} /> Настройки
        </h2>
        <div className="card p-4">
          <p className="text-[15px] font-medium text-fg">Скорость переписки</p>
          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-white/[0.04] p-1">
            {SPEEDS.map(o => (
              <button
                key={o.id}
                onClick={() => {
                  haptic("select");
                  setSpeed(o.id);
                }}
                className={`rounded-xl px-2 py-2 text-center transition ${speed === o.id ? "bg-accent text-white shadow-glow" : "text-muted"}`}
              >
                <span className="block text-[13.5px] font-semibold">{o.title}</span>
                <span className={`block text-[11px] ${speed === o.id ? "text-white/80" : "text-faint"}`}>{o.hint}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              haptic("select");
              setTimers(!timers);
            }}
            className="mt-4 flex w-full items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="block text-[15px] font-medium text-fg">Выборы на время</span>
              <span className="block text-[13px] text-faint">{timers ? "В напряжённых сценах нужно успеть ответить" : "Можно думать сколько угодно"}</span>
            </span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${timers ? "bg-accent" : "bg-white/15"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${timers ? "left-6" : "left-1"}`} />
            </span>
          </button>
        </div>
      </section>

      {/* Друзья */}
      {!view.isGuest && view.shareLink && (
        <section className="mt-8 px-4">
          <h2 className="mb-3 flex items-center gap-2 px-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-faint">
            <Icon name="users" size={15} /> Друзья
          </h2>
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-accent/20 via-accent/[0.07] to-transparent p-5 ring-1 ring-accent/25">
            <p className="text-[16px] font-semibold text-fg">Пригласите друга</p>
            <p className="mt-1 text-[13.5px] leading-snug text-muted">
              {view.freeAccess
                ? "Отправьте ссылку — пусть попробует пройти лучше вас."
                : `За каждого друга по вашей ссылке — ${view.referralBonus} ${plural(view.referralBonus, "бесплатный пропуск", "бесплатных пропуска", "бесплатных пропусков")} ожидания.`}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 rounded-2xl bg-black/20 px-3 py-2">
                <p className="text-[22px] font-bold leading-none text-fg">{view.invited}</p>
                <p className="mt-1 text-[12px] text-faint">{plural(view.invited, "друг пришёл", "друга пришли", "друзей пришло")}</p>
              </div>
              {!view.freeAccess && (
                <div className="flex-1 rounded-2xl bg-black/20 px-3 py-2">
                  <p className="text-[22px] font-bold leading-none text-fg">{view.credits}</p>
                  <p className="mt-1 text-[12px] text-faint">{plural(view.credits, "пропуск", "пропуска", "пропусков")}</p>
                </div>
              )}
            </div>
            <button className="btn-primary mt-4 w-full" onClick={onInvite}>
              <Icon name="share" size={17} /> Пригласить друга
            </button>
          </div>
        </section>
      )}

      <footer className="mt-10 px-5 text-center text-[12px] text-faint">
        <Link href="/legal" className="underline-offset-2 hover:underline">
          Условия и конфиденциальность
        </Link>
      </footer>
    </main>
  );
}

function Stat({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl px-3 py-3 ring-1 ${accent ? "bg-accent/15 ring-accent/30" : "bg-white/[0.04] ring-white/[0.06]"}`}>
      <p className="text-[22px] font-bold leading-none text-fg">{value}</p>
      <p className="mt-1.5 text-[12px] leading-tight text-faint">{label}</p>
    </div>
  );
}

function EndingsCard({ story, open, onToggle }: { story: ProfileStory; open: boolean; onToggle: () => void }) {
  const got = story.endings.filter(e => e.unlocked).length;
  const total = story.endings.length;
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
          <CoverArt style={story.cover_style} className="h-full w-full" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-semibold text-fg">{story.title}</span>
          <span className="mt-1 flex items-center gap-1">
            {story.endings.map(e => (
              <span key={e.id} className={`h-1.5 flex-1 rounded-full ${e.unlocked ? (e.secret ? "bg-warn" : "bg-accent") : "bg-white/10"}`} />
            ))}
          </span>
          <span className="mt-1 block text-[12px] text-faint">
            Концовки {got} из {total}
            {story.status === "finished" ? " · пройдено" : story.completedDays > 0 ? ` · глава ${story.completedDays} из ${story.totalDays}` : ""}
          </span>
        </span>
        <Icon name="chevron" className={`shrink-0 text-faint transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-white/[0.06] px-3 pb-3 pt-2.5">
          {story.endings.map(e => (
            <div key={e.id} className={`rounded-2xl px-3 py-2.5 ${e.unlocked ? "bg-accent/10" : "bg-white/[0.03]"}`}>
              <p className={`flex items-center gap-1.5 text-[14px] font-medium ${e.unlocked ? "text-fg" : "text-faint"}`}>
                <Icon name={e.unlocked ? "star" : "lock"} size={13} className={e.unlocked && e.secret ? "text-warn" : ""} />
                {e.unlocked || !e.secret ? e.title : "Секретная концовка"}
              </p>
              {e.unlocked && e.description && <p className="mt-1 text-[12.5px] leading-snug text-muted">{e.description}</p>}
              {!e.unlocked && <p className="mt-0.5 text-[12px] text-faint">{e.secret ? "Существует. Но как до неё дойти?" : "Ещё не открыта"}</p>}
            </div>
          ))}
          <Link href={`/story/${story.id}`} className="btn-secondary mt-1 w-full min-h-[40px] text-[14px]">
            К истории
          </Link>
        </div>
      )}
    </div>
  );
}
