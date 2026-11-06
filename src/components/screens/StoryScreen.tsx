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
import { chaptersLabel, plural } from "@/lib/utils/plural";

export function StoryScreen({ storyId }: { storyId: string }) {
  const router = useRouter();
  const { ready, token, confirm, share, haptic, authError, retryAuth } = useApp();
  const [view, setView] = useState<StoryView | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [restartBusy, setRestartBusy] = useState(false);
  const [restartError, setRestartError] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    getStoryView(token, storyId).then(setView).catch(() => setFailed(true));
  }, [token, storyId]);
  useEffect(() => { if (ready) load(); }, [ready, load]);
  const native = useBackButton(() => router.push("/"));
  const unlock = useUnlock(storyId, load);

  if (authError) return <ErrorState title="Не удалось войти" action={retryAuth} />;
  if (!ready || (view === undefined && !failed)) return <FullscreenLoader />;
  if (failed) return <ErrorState title="Нет соединения" action={load} />;
  if (!view) return <ErrorState icon="book" title="История не найдена" href="/" actionLabel="На главную" />;

  const { story, days } = view;
  const meta = story.meta;
  const current = days.find(day => day.status === "in_progress") || days.find(day => day.status === "available");
  const waiting = days.find(day => day.status === "waiting" || day.status === "not_released");
  const completed = days.filter(day => day.status === "completed").length;
  const finished = days.length > 0 && completed === days.length && view.upcomingDays === 0;
  const characters = Object.entries(meta.characters || {}).filter(([, character]) => character.bio);
  const endings = Object.entries(meta.endings || {});
  const preview = meta.preview_message;
  const speaker = preview && meta.characters?.[preview.character];
  const genre = meta.genre?.split(" · ").pop();
  const synopsis = meta.synopsis || story.description?.split(/\n\s*\n/)[0];
  const onShare = () => { if (view.shareLink) { haptic("select"); share(view.shareLink, meta.share_text || `«${story.title}» — ${meta.tagline || "интерактивная история"}`); } };
  const onRestart = async () => {
    if (!(await confirm("Начать историю заново? Прогресс будет сброшен, открытые концовки сохранятся."))) return;
    haptic("warning"); setRestartBusy(true); setRestartError(false);
    try { const result = await restartStory(token, storyId); if (!result.ok) throw new Error("restart failed"); load(); } catch { setRestartError(true); } finally { setRestartBusy(false); }
  };

  return <main className="library-shell story-detail">
    <div className="story-hero">
      <CoverArt style={story.cover_style} className="story-hero-art" priority />
      <div className="story-hero-shade" />
      <header className="story-toolbar">
        {!native ? <Link href="/" className="story-round-button" aria-label="Назад к историям"><Icon name="back" size={25} /></Link> : <span />}
        <span>История</span>
        {view.shareLink ? <button type="button" className="story-round-button" aria-label="Поделиться историей" onClick={onShare}><Icon name="forward" size={24} /></button> : <span />}
      </header>
      {meta.age_rating && <span className="story-age">{meta.age_rating}</span>}
      <div className="story-hero-copy">
        <span className="story-hero-tags">{genre && <span className="story-genre">{genre}</span>}{view.storyFree && <span className="library-free">Бесплатно</span>}</span>
        <h1 className={story.title.length > 12 ? "story-long-title" : ""}>{story.title}</h1>
        {meta.tagline && <p>{meta.tagline}</p>}
      </div>
    </div>
    <div className="story-detail-content">
      <div className="story-facts" aria-label="Об истории">
        <span><Icon name="book" size={19} />{chaptersLabel(days.length + view.upcomingDays)}</span>
        {endings.length > 0 && <span><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="5" r="3" /><circle cx="4" cy="19" r="3" /><circle cx="20" cy="19" r="3" /><path d="m10.5 7.5-5 9m8-9 5 9M7 19h10" /></svg>{endings.length} {plural(endings.length, "концовка", "концовки", "концовок")}</span>}
        <span><Icon name="chat" size={21} />История в чате</span>
      </div>
      {view.storyFree && <section className="story-free library-panel" aria-label="Бесплатная история">
        <span className="story-free-icon"><Icon name="gift" size={22} /></span>
        <span><strong>Вся история — бесплатно</strong><span>Все {chaptersLabel(days.length + view.upcomingDays)} открываются сразу, без ожидания и оплаты.</span></span>
      </section>}
      {preview && <aside className="story-preview library-panel" aria-label="Сообщение из истории">
        <p className="story-preview-sender"><span style={{ backgroundColor: speaker?.color || "#b08af7" }} />{speaker?.name || "Неизвестный номер"}</p>
        <p className="story-preview-text">{preview.text}</p>
        {preview.time && <span className="story-preview-time">{preview.time}</span>}
      </aside>}
      {(synopsis || story.description) && <section className="story-about" aria-labelledby="story-about-heading">
        <h2 id="story-about-heading">Об истории</h2>
        {synopsis && <p className="story-synopsis">{synopsis}</p>}
        {story.description && <details className="story-description"><summary><span className="story-read-more">Читать полностью</span><span className="story-read-less">Свернуть описание</span><Icon name="chevron" size={19} /></summary><p>{story.description}</p></details>}
      </section>}
      <section className="story-chapters" aria-labelledby="story-chapters-heading">
        <div className="story-section-heading"><h2 id="story-chapters-heading">Главы</h2><span>{completed} из {days.length + view.upcomingDays} пройдено</span></div>
        <ol className="story-chapter-list library-panel">
          {days.map(day => <DayRow key={day.dayId} day={day} storyId={storyId} view={view} unlock={unlock} current={day.dayId === current?.dayId} onReady={load} />)}
          {Array.from({ length: view.upcomingDays }, (_, index) => <li key={`upcoming-${index}`} className="story-chapter-row is-unavailable"><span className="story-chapter-number">{String(days.length + index + 1).padStart(2, "0")}</span><span className="story-chapter-name">Глава {days.length + index + 1}</span><span className="story-chapter-status">Скоро</span></li>)}
        </ol>
        {days.length === 0 && !view.upcomingDays && <p className="story-help">Главы готовятся к выходу.</p>}
        {unlock.error && <p role="alert" className="story-error">{unlock.error}</p>}
      </section>
      {view.paymentsEnabled && !view.hasPass && !finished && days.length > 1 && <section className="story-pass library-panel"><h2>Без ожидания</h2><p>Все главы этой истории открываются сразу после предыдущей.</p><button className="story-secondary" disabled={unlock.busy} onClick={() => unlock.buy("season_pass")}>Открыть за {view.prices.seasonPass} ⭐</button></section>}
      {view.hasPass && <p className="story-help"><Icon name="bolt" size={15} /> Сезонный пропуск активен</p>}
      {characters.length > 0 && <details className="story-extras"><summary>Персонажи<Icon name="chevron" size={17} /></summary><div className="story-character-list">{characters.map(([id, character]) => <div key={id}><Avatar id={id} character={character} size={36} /><p><strong>{character.name}</strong><span>{character.bio}</span></p></div>)}</div></details>}
      {endings.length > 0 && (completed > 0 || view.endingsUnlocked.length > 0) && <details className="story-extras"><summary>Коллекция концовок<span>{view.endingsUnlocked.length} из {endings.length}</span><Icon name="chevron" size={17} /></summary><div className="story-ending-list">{endings.map(([id, ending]) => { const found = view.endingsUnlocked.includes(id); return <span key={id} className={found ? "is-found" : ""}><Icon name={found ? "star" : "lock"} size={13} />{found ? ending.title : ending.secret ? "Секретная концовка" : "Неоткрытая концовка"}</span>; })}</div></details>}
      {completed > 0 && <button className="story-restart" disabled={restartBusy} onClick={onRestart}><Icon name="refresh" size={16} />{restartBusy ? "Сбрасываем прогресс…" : "Начать заново"}</button>}
      {restartError && <p role="alert" className="story-error">Не удалось сбросить прогресс. Попробуйте ещё раз.</p>}
      {!view.isGuest && !view.freeAccess && <p className="story-help">Друг по вашей ссылке — бесплатный пропуск ожидания{view.credits > 0 ? ` · у вас ${view.credits}` : ""}</p>}
    </div>
    <div className="story-start-bar">
      {current ? <Link href={`/play/${storyId}/${current.dayNumber}`} className="story-start-button"><Icon name="play" size={19} />{current.status === "in_progress" || completed > 0 ? `Продолжить · Глава ${current.dayNumber}` : "Начать историю"}</Link>
        : waiting?.unlocksAt ? <div className="story-waiting-button" role="status"><Icon name="clock" size={18} />Глава {waiting.dayNumber} через <Countdown until={waiting.unlocksAt} compact onDone={load} /></div>
        : finished ? <Link href={`/play/${storyId}/${days[days.length - 1].dayNumber}`} className="story-start-button"><Icon name="trophy" size={18} />История пройдена · итоги</Link>
        : <div className="story-waiting-button" role="status">Продолжение скоро</div>}
      <p>{current ? completed === 0 && current.dayNumber === 1 ? "С первой главы · прогресс сохраняется" : "Ваша история продолжается · прогресс сохраняется" : finished ? "Открытые концовки остаются в коллекции" : "Вернитесь, когда откроется следующая глава"}</p>
    </div>
  </main>;
}

function DayRow({ day, storyId, view, unlock, current, onReady }: { day: DayAccess; storyId: string; view: StoryView; unlock: ReturnType<typeof useUnlock>; current: boolean; onReady: () => void }) {
  const playable = day.status === "available" || day.status === "in_progress" || day.status === "completed";
  const body = <>
    <span className="story-chapter-number">{String(day.dayNumber).padStart(2, "0")}</span>
    <span className="story-chapter-name">Глава {day.dayNumber}<span className="sr-only"> · {day.title}</span>{day.status === "waiting" && day.unlocksAt && <span className="story-chapter-wait">Через <Countdown until={day.unlocksAt} compact onDone={onReady} /></span>}{day.status === "not_released" && <span className="story-chapter-wait">{day.unlocksAt ? `Выход ${new Date(day.unlocksAt).toLocaleDateString("ru-RU")}` : "Скоро"}</span>}</span>
    {current && <span className="story-chapter-status"><i />{day.status === "in_progress" ? "Продолжить" : "Начать"}</span>}
    {day.status === "completed" ? <Icon name="check" size={18} className="story-chapter-check" /> : <Icon name="chevron" size={20} />}
  </>;
  return <li className={current ? "is-current" : ""}>
    {playable ? <Link href={`/play/${storyId}/${day.dayNumber}`} className="story-chapter-row" aria-current={current ? "step" : undefined}>{body}</Link> : <div className="story-chapter-row is-unavailable" aria-label={`Глава ${day.dayNumber}: ${day.status === "locked" ? "откроется после предыдущей главы" : "пока недоступна"}`}>{body}</div>}
    {day.status === "waiting" && day.skippable && (view.credits > 0 || view.paymentsEnabled) && <div className="story-unlock-actions">{view.credits > 0 ? <button className="story-secondary" disabled={unlock.busy} onClick={() => unlock.spendCredit(day.dayNumber)}>Открыть бесплатно</button> : <button className="story-secondary" disabled={unlock.busy} onClick={() => unlock.buy("skip_day", day.dayNumber)}>Открыть сейчас · {view.prices.skipDay} ⭐</button>}</div>}
  </li>;
}
