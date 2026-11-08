"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { withTimeout } from "@/lib/utils/with-timeout";
import { getHome, type CatalogItem, type HomeView } from "@/lib/actions/player";
import { useInviteFriend } from "@/lib/telegram/useInviteFriend";
import { useApp } from "@/lib/telegram/TelegramProvider";
import { CoverArt } from "@/components/ui/CoverArt";
import { Icon } from "@/components/ui/Icon";
import { ErrorState } from "@/components/ui/States";
import { LibraryNav } from "@/components/ui/LibraryChrome";
import { Countdown } from "@/components/ui/Countdown";
import { catalogGenre } from "@/lib/game/genres";
import { chaptersLabel } from "@/lib/utils/plural";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
}

function continueStory(items: CatalogItem[]): CatalogItem | null {
  return items.filter(item => (item.status === "in_progress" || item.status === "waiting") && item.lastPlayedAt)
    .sort((a, b) => (b.lastPlayedAt || "").localeCompare(a.lastPlayedAt || ""))[0] || null;
}

export function HomeScreen() {
  const { ready, token, session, authError, retryAuth } = useApp();
  const [greetingText, setGreetingText] = useState("Добро пожаловать");
  useEffect(() => { setGreetingText(greeting()); }, []);
  const invitation = useInviteFriend();
  const [filter, setFilter] = useState("all");
  const [genre, setGenre] = useState("");
  const [home, setHome] = useState<HomeView | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const load = () => {
    const id = ++request.current;
    setFailed(false);
    withTimeout(getHome(token), 15_000).then(result => {
      if (id === request.current) setHome(result);
    }).catch(() => {
      if (id === request.current) setFailed(true);
    });
  };
  useEffect(() => {
    const requests = request;
    if (ready && !authError) load();
    return () => { requests.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, authError]);

  const user = session?.user && !session.user.is_guest ? session.user : null;
  const items = home?.items || null;
  const resume = items ? continueStory(items) : null;
  // Тому, кто ещё ничего не начинал, сверху — бесплатная история: в неё можно войти без оплаты и ожидания
  const firstVisit = !!items?.length && items.every(item => item.status === "new" || item.status === "coming");
  const entryFree = firstVisit ? items?.find(item => item.isFree && item.status === "new") : undefined;
  const featured = entryFree
    || items?.find(item => item.isNew && item.id !== resume?.id)
    || items?.find(item => item.status === "new" && item.id !== resume?.id)
    || items?.find(item => item.id !== resume?.id) || null;
  const filtering = filter !== "all" || !!genre;
  const genres = Array.from(new Set((items || []).map(item => catalogGenre(item.meta.genre)).filter(Boolean))) as string[];
  const filtered = (items || []).filter(item => (filter === "all" || filter === "new" && item.status === "new" || filter === "active" && ["in_progress", "waiting"].includes(item.status) || filter === "finished" && item.status === "finished") && (!genre || catalogGenre(item.meta.genre) === genre));
  const rest = filtering ? filtered : items?.filter(item => item.id !== featured?.id && item.id !== resume?.id) || [];


  return (
    <main className="library-shell library-home">
      <div className="library-content">
        <div className="library-greeting">
          <h1>{greetingText}{user ? `, ${user.first_name}` : ""}</h1>
          <p>Кто-то уже набирает сообщение…</p>
        </div>
        {authError ? <ErrorState title="Не удалось войти" text="Проверьте соединение." action={retryAuth} />
          : failed ? <ErrorState title="Нет соединения" text="Не получилось загрузить истории." action={() => window.location.reload()} />
          : !items ? <div className="library-loading" aria-label="Загружаем истории" aria-busy="true"><div className="skeleton" /><div className="skeleton" /></div>
          : !items.length ? <ErrorState icon="moon" title="Историй пока нет" text="Первая глава готовится к выходу. Загляните позже." />
          : <>
            {!filtering && resume && <ResumeCard item={resume} />}
            {!filtering && featured && <section className="library-feature-section" aria-labelledby="featured-heading">
              <h2 id="featured-heading" className="library-section-title">{featured === entryFree ? "Начните с этой истории" : featured.isNew ? "Новая история" : "Ваша следующая история"}</h2>
              <FeaturedCard item={featured} />
            </section>}
            <section className="library-catalog" aria-label="Фильтры историй">
              <div className="catalog-filters" role="group" aria-label="Статус прохождения">
                {[["all", "Все"], ["new", "Не начаты"], ["active", "Продолжаю"], ["finished", "Пройдены"]].map(([id, title]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{title}</button>)}
              </div>
              <label className="catalog-genre">Жанр <select value={genre} onChange={event => setGenre(event.target.value)}><option value="">Все жанры</option>{genres.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              {filtering && !rest.length && <p className="library-empty-copy">Таких историй пока нет. <button className="underline" onClick={() => { setFilter("all"); setGenre(""); }}>Сбросить фильтры</button></p>}
            </section>
            {rest.length > 0 && <section className="library-catalog" aria-labelledby="catalog-heading">
              <h2 id="catalog-heading" className="library-section-title">{filtering ? "Подходящие истории" : "Все истории"}</h2>
              <div className="library-story-list">{rest.map(item => <StoryRow key={item.id} item={item} />)}</div>
            </section>}
            {!home?.isGuest && home?.shareLink && <button className="library-home-invite" disabled={invitation.busy} aria-busy={invitation.busy} onClick={() => invitation.invite(home.shareLink)}><Icon name="share" size={16} /> Пригласить друга</button>}
          </>}
        <footer className="library-legal"><Link href="/legal">Условия и конфиденциальность</Link></footer>
      </div>
      <LibraryNav active="stories" />
    </main>
  );
}

function chapterStatus(item: CatalogItem) {
  if (item.status === "finished") return `Пройдено · концовки ${item.endingsFound} из ${item.endingsTotal}`;
  if (item.status === "coming") return "Скоро в приложении";
  if (item.status === "waiting") return item.nextDay ? `Глава ${item.nextDay} · скоро` : "Продолжение скоро";
  return item.nextDay ? `Глава ${item.nextDay} из ${item.totalDays}` : chaptersLabel(item.totalDays);
}

function ResumeCard({ item }: { item: CatalogItem }) {
  const href = item.status === "in_progress" && item.nextDay ? `/play/${item.id}/${item.nextDay}` : `/story/${item.id}`;
  const progress = item.totalDays ? Math.min(100, item.completedDays / item.totalDays * 100) : 0;
  return <Link href={href} className="library-resume library-panel" aria-label={`Продолжить ${item.title}. ${chapterStatus(item)}`}>
    <div className="library-resume-cover"><CoverArt style={item.cover_style} thumbnail priority /></div>
    <div className="library-resume-copy">
      <span className="library-eyebrow">{item.status === "waiting" ? "Продолжение скоро" : "Продолжить"}{item.isFree && <span className="library-free library-free-sm">Бесплатно</span>}</span>
      <h2>{item.title}</h2><p>{chapterStatus(item)}</p>
      <div className="library-resume-progress" role="progressbar" aria-label="Прочитанные главы" aria-valuenow={item.completedDays} aria-valuemin={0} aria-valuemax={Math.max(1, item.totalDays)}><span style={{ width: `${progress}%` }} /></div>
    </div>
    <span className="library-play"><Icon name={item.status === "waiting" ? "clock" : "play"} size={22} /></span>
  </Link>;
}

function FeaturedCard({ item }: { item: CatalogItem }) {
  const label = item.status === "new" ? "Начать историю" : item.status === "finished" ? "Открыть историю" : item.status === "coming" ? "Скоро" : item.status === "waiting" ? "К истории" : "Продолжить историю";
  const genre = item.meta.genre?.split(" · ").pop();
  return <Link href={`/story/${item.id}`} className="library-feature library-panel" aria-label={`${item.title} — ${label}`}>
    <CoverArt style={item.cover_style} priority className="library-feature-art" />
    <div className="library-feature-shade" />
    <div className="library-feature-badges">{item.isNew && <span className="library-new">Новинка</span>}{item.isFree && <span className="library-free">Бесплатно</span>}{item.meta.age_rating && <span className="library-age">{item.meta.age_rating}</span>}</div>
    <div className="library-feature-copy">
      <h3>{item.title}</h3>
      {item.meta.tagline && <p className="library-feature-tagline">{item.meta.tagline}</p>}
      <p className="library-feature-meta">{chaptersLabel(item.totalDays)}{genre ? ` · ${genre.charAt(0).toUpperCase()}${genre.slice(1)}` : ""}{item.minutesPerDay ? ` · ≈${item.minutesPerDay} мин/глава` : ""}</p>
      <span className="library-primary">{label}</span>
      {item.status === "waiting" && item.unlocksAt && <span className="library-feature-wait">Откроется через <Countdown until={item.unlocksAt} compact /></span>}
    </div>
  </Link>;
}

function StoryRow({ item }: { item: CatalogItem }) {
  const active = item.status !== "new" && item.status !== "coming";
  return <Link href={`/story/${item.id}`} className="library-story-row library-panel">
    <div className="library-row-cover"><CoverArt style={item.cover_style} thumbnail /></div>
    <div className="library-row-copy"><h3>{item.title}{item.isNew && <span className="library-new library-free-sm">Новинка</span>}{item.isFree && <span className="library-free library-free-sm">Бесплатно</span>}</h3><p>{active ? chapterStatus(item) : item.meta.genre || item.meta.tagline || chaptersLabel(item.totalDays)}{item.minutesPerDay ? ` · ≈${item.minutesPerDay} мин/глава` : ""}</p></div>
    <Icon name="chevron" size={20} />
  </Link>;
}
