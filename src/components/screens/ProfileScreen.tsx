"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile, type ProfileStory, type ProfileView } from "@/lib/actions/player";
import { useInviteFriend } from "@/lib/telegram/useInviteFriend";
import { useApp, useBackButton, type Speed } from "@/lib/telegram/TelegramProvider";
import { CoverArt } from "@/components/ui/CoverArt";
import { Icon } from "@/components/ui/Icon";
import { ErrorState, FullscreenLoader } from "@/components/ui/States";
import { LibraryAvatar, LibraryNav } from "@/components/ui/LibraryChrome";
import { plural } from "@/lib/utils/plural";

const SPEEDS: Array<{ id: Speed; title: string; hint: string }> = [
  { id: "normal", title: "Обычная", hint: "Сообщения приходят как в живом чате" },
  { id: "fast", title: "Быстрая", hint: "Переписка идёт вдвое быстрее" },
  { id: "instant", title: "Без пауз", hint: "Сообщения появляются без ожидания" },
];

export function ProfileScreen() {
  const router = useRouter();
  const { ready, token, session, speed, setSpeed, timers, setTimers, haptic, authError, retryAuth } = useApp();
  const invitation = useInviteFriend();
  const [view, setView] = useState<ProfileView | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => {
    setFailed(false);
    getProfile(token).then(setView).catch(() => setFailed(true));
  };
  useEffect(() => {
    if (ready) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);
  useBackButton(() => router.push("/"));

  if (authError) return <main className="library-shell"><ErrorState title="Не удалось войти" action={retryAuth} /><LibraryNav active="profile" /></main>;
  if (!ready || (!view && !failed)) return <FullscreenLoader />;
  if (failed || !view) return <main className="library-shell"><ErrorState title="Нет соединения" action={load} /><LibraryNav active="profile" /></main>;

  const name = view.name || (!view.isGuest ? session?.user.first_name : null) || "Гость";
  const stories = [...view.stories].sort((a, b) => Number(b.completedDays > 0 || b.status === "in_progress") - Number(a.completedDays > 0 || a.status === "in_progress"));


  return (
    <main className="library-shell library-profile">
      <div className="library-content">
        <div className="library-profile-identity"><LibraryAvatar large name={name} photo={view.photo} /><div><h1>{name}</h1><p>У каждой истории — твой финал</p></div></div>
        <div className="library-stats" aria-label="Ваша статистика"><Stat value={view.stats.started} label="Начато" /><Stat value={view.stats.finished} label="Пройдено" /><Stat value={view.stats.endings} label="Концовки" /></div>
        <section className="library-reading" aria-labelledby="reading-heading">
          <h2 id="reading-heading" className="library-section-title">Настройки чтения</h2>
          <div className="library-settings library-panel">
            <h3 id="speed-label">Скорость переписки</h3>
            <div className="library-speed" role="group" aria-labelledby="speed-label" aria-describedby="speed-hint">
              {SPEEDS.map(option => <button key={option.id} type="button" aria-pressed={speed === option.id} onClick={() => { haptic("select"); setSpeed(option.id); }} className={speed === option.id ? "is-selected" : ""}>{option.title}</button>)}
            </div>
            <p id="speed-hint" className="library-setting-hint" aria-live="polite">{SPEEDS.find(option => option.id === speed)?.hint}</p>
            <div className="library-timer-setting"><div><h3 id="timer-label">Выборы на время</h3><p id="timer-hint">{timers ? "Ограниченное время для ответа" : "Можно думать сколько угодно"}</p></div><button type="button" role="switch" aria-checked={timers} aria-labelledby="timer-label" aria-describedby="timer-hint" className={`library-switch${timers ? " is-on" : ""}`} onClick={() => { haptic("select"); setTimers(!timers); }}><span /></button></div>
          </div>
        </section>
        <section className="library-collection" aria-labelledby="collection-heading">
          <div className="library-section-heading"><h2 id="collection-heading" className="library-section-title">Коллекция концовок</h2><span>{view.stats.endings} из {view.stats.endingsTotal}</span></div>
          {stories.length ? <div className="library-endings-list">{stories.map(story => <EndingsCard key={story.id} story={story} open={open === story.id} onToggle={() => { haptic("select"); setOpen(open === story.id ? null : story.id); }} />)}</div> : <p className="library-empty-copy">Здесь появятся концовки ваших историй.</p>}
        </section>
        {!view.isGuest && view.shareLink && <section className="library-invitation">
          <button className="library-invite library-panel" disabled={invitation.busy} aria-busy={invitation.busy} onClick={() => invitation.invite(view.shareLink)}><span className="library-invite-icon"><Icon name="share" size={23} /></span><span><span className="library-invite-title">Пригласить друга</span><span className="library-invite-hint">Сравните ваши концовки</span></span><Icon name="chevron" size={20} /></button>
          {!view.freeAccess && <p className="library-referral-copy">За друга — {view.referralBonus} {plural(view.referralBonus, "пропуск ожидания", "пропуска ожидания", "пропусков ожидания")}. Доступно: {view.credits}.</p>}
          {view.invited > 0 && <p className="library-referral-copy">С вами уже {view.invited} {plural(view.invited, "друг", "друга", "друзей")}</p>}
        </section>}
        <footer className="library-legal"><Link href="/legal">Условия и конфиденциальность</Link>{session?.isAdmin && <Link href="/admin" className="library-admin-link">Студия</Link>}</footer>
      </div>
      <LibraryNav active="profile" />
    </main>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="library-stat library-panel"><p>{value}</p><span>{label}</span></div>;
}

function EndingsCard({ story, open, onToggle }: { story: ProfileStory; open: boolean; onToggle: () => void }) {
  const id = useId();
  const unlocked = story.endings.filter(ending => ending.unlocked).length;
  return <div className="library-ending-card library-panel">
    <button onClick={onToggle} className="library-ending-trigger" aria-expanded={open} aria-controls={id}>
      <span className="library-ending-cover"><CoverArt style={story.cover_style} thumbnail /></span>
      <span className="library-ending-copy"><span className="library-ending-title">{story.title}</span><span className="library-ending-progress" aria-hidden="true">{story.endings.map(ending => <span key={ending.id} className={ending.unlocked ? ending.secret ? "is-secret" : "is-found" : ""} />)}</span></span>
      <span className="library-ending-total">{unlocked} из {story.endings.length}</span><Icon name="chevron" size={20} className={open ? "library-chevron-open" : ""} />
    </button>
    <div id={id} hidden={!open} className="library-ending-details">
      {story.endings.map(ending => <div key={ending.id} className={`library-ending-detail${ending.unlocked ? " is-found" : ""}`}><p><Icon name={ending.unlocked ? "star" : "lock"} size={14} />{ending.unlocked ? ending.title : ending.secret ? "Секретная концовка" : "Неоткрытая концовка"}</p>{ending.unlocked && ending.description ? <span>{ending.description}</span> : !ending.unlocked ? <span>{ending.secret ? "Существует. Но как до неё дойти?" : "Попробуйте другой путь в истории"}</span> : null}</div>)}
      <Link href={`/story/${story.id}`} className="library-secondary">К истории</Link>
    </div>
  </div>;
}
