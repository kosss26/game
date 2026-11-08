"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadDay, replayDay, type DayPayload } from "@/lib/actions/player";
import { useApp, useBackButton } from "@/lib/telegram/TelegramProvider";
import type { ChatConfig, Flags, HistoryEntry } from "@/lib/types/database";
import { ChatPlayer } from "@/components/chat/ChatPlayer";
import { MessageList, DayDivider, previewText } from "@/components/chat/Messages";
import { storyClocks } from "@/lib/game/story-clock";
import { ThreadTabs } from "@/components/chat/ChatChrome";
import { FullscreenLoader, ErrorState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { withTimeout } from "@/lib/utils/with-timeout";
import { ReturnRecap } from "@/components/journal/ReturnRecap";
import { shouldOfferRecap, readingStampKey, type JournalSource } from "@/lib/game/journal";
import { DayComplete } from "./DayComplete";

type OkPayload = Extract<DayPayload, { ok: true }>;

export function PlayScreen({ storyId, dayNumber }: { storyId: string; dayNumber: number }) {
  const router = useRouter();
  const { ready, token, session, authError, retryAuth } = useApp();
  const [payload, setPayload] = useState<DayPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<"chat" | "complete" | "reread">("chat");
  const [result, setResult] = useState<{ history: HistoryEntry[]; flags: Flags; ending: string | null } | null>(null);
  const [showRecap,setShowRecap] = useState(false);
  const [coverStyle, setCoverStyle] = useState<string | null>(null);

  const load = useCallback((forceRecap=false) => {
    setFailed(false);
    setPayload(null);
    withTimeout(loadDay(token, storyId, dayNumber),15000)
      .then(p => {
        setPayload(p);
        if (p.ok) {
          let last=p.lastPlayedAt;
          try { const local=session?.user.id?Number(localStorage.getItem(readingStampKey(session.user.id,storyId))):0;
            if(local&&local>(Date.parse(last||'')||0))last=new Date(local).toISOString();
          } catch { /* Use confirmed server read time. */ }
          setShowRecap(!p.progress?.completed && (forceRecap===true || shouldOfferRecap(last)));
          setCoverStyle(p.day.background);
          if (p.progress?.completed) {
            setResult({ history: p.progress.history, flags: p.progress.flags, ending: (p.progress.flags.__ending as string) || null });
            setMode("complete");
          } else setMode("chat");
        }
      })
      .catch(() => setFailed(true));
  }, [token, storyId, dayNumber, session?.user.id]);

  useEffect(() => {
    if (ready && token) load();
  }, [ready, token, load]);

  const toStory = useCallback(() => router.push(`/story/${storyId}`), [router, storyId]);

  if (!ready) return <FullscreenLoader />;
  if (authError) return <ErrorState title="Не удалось войти" text="Проверьте соединение и попробуйте снова." action={retryAuth} />;
  if (failed) return <ErrorState title="Нет соединения" text="Не получилось загрузить главу." action={load} />;
  if (!payload) return <FullscreenLoader label="Открываем переписку…" />;

  if (!payload.ok) {
    if (payload.reason === "locked") {
      return <ErrorState icon="lock" title="Глава пока закрыта" text="Сначала завершите предыдущую главу — или откройте её на странице истории." href={`/story/${storyId}`} actionLabel="К истории" />;
    }
    return <ErrorState icon="book" title="Глава не найдена" text="Возможно, она ещё не опубликована." href="/" actionLabel="На главную" />;
  }

  const p = payload as OkPayload;

  if (mode === "complete" && result) {
    return (
      <DayComplete
        storyId={storyId}
        storyTitle={p.story.title}
        storyMeta={p.story.meta}
        coverStyle={coverStyle}
        dayNumber={p.day.number}
        dayTitle={p.day.title}
        recap={p.day.recap}
        teaser={p.day.teaser}
        snapshot={p.snapshot}
        history={result.history}
        flags={result.flags}
        ending={result.ending}
        isLastDay={p.isLastDay}
        onPlay={n => router.push(`/play/${storyId}/${n}`)}
        onStory={toStory}
        onReread={() => setMode("reread")}
      />
    );
  }

  if (mode === "reread" && result) {
    return (
      <Reread
        history={result.history}
        title={`Глава ${p.day.number} · ${p.day.title}`}
        characters={p.characters}
        mainCharacter={p.story.meta.main_character}
        chats={{ ...(p.story.meta.chats || {}), ...(p.snapshot.day.meta?.chats || {}) }}
        onBack={() => setMode("complete")}
        onReplay={
          p.isLastDay || !p.nextDay
            ? async () => {
                const r = await replayDay(token, storyId, p.day.id);
                if (r.ok) load();
              }
            : undefined
        }
      />
    );
  }

  if (showRecap) {
    let history=p.progress?.history||[];let flags={...p.inheritedFlags,...(p.progress?.flags||{})};
    try {
      if(p.progress?.id){
        const local=JSON.parse(localStorage.getItem(`pl_checkpoint:${p.progress.id}:${p.version}`)||'null');
        if(local&&Array.isArray(local.history)&&local.history.length>=history.length&&local.flags&&(local.pointer===null||p.snapshot.scenes.some(scene=>scene.id===local.pointer))){history=local.history;flags=local.flags;}
      }
    } catch { /* The confirmed server history remains available. */ }
    const live:JournalSource|undefined=p.progress?.id?{dayId:p.day.id,progressId:p.progress.id,number:p.day.number,title:p.day.title,history,flags,updatedAt:p.lastPlayedAt||''}:undefined;
    return <ReturnRecap storyId={storyId} title={p.story.title} dayNumber={dayNumber} onContinue={()=>setShowRecap(false)} onBack={toStory} live={live} characters={p.characters} meta={p.story.meta}/>;
  }

  return (
    <ChatPlayer
      key={`${p.day.id}:${p.version}`}
      storyId={storyId}
      dayId={p.day.id}
      dayNumber={p.day.number}
      dayTitle={p.day.title}
      progressId={p.progress?.id}
      version={p.version}
      snapshot={p.snapshot}
      characters={p.characters}
      mainCharacter={p.story.meta.main_character}
      storyMeta={p.story.meta}
      inheritedFlags={p.inheritedFlags}
      isLastDay={p.isLastDay}
      initial={
        p.progress
          ? {
              history: p.progress.history || [],
              flags: { ...p.inheritedFlags, ...(p.progress.flags || {}) },
              pointer: p.progress.scene_id,
              state: p.progress.state || {},
              completed: p.progress.completed,
            }
          : null
      }
      onReturnAfterPause={()=>load(true)}
      onExit={toStory}
      onComplete={r => {
        setResult(r);
        setMode("complete");
      }}
    />
  );
}

function Reread({
  history,
  title,
  characters,
  mainCharacter,
  chats,
  onBack,
  onReplay,
}: {
  history: HistoryEntry[];
  title: string;
  characters: OkPayload["characters"];
  mainCharacter?: string;
  chats: Record<string, ChatConfig>;
  onBack: () => void;
  onReplay?: () => void;
}) {
  const native = useBackButton(onBack);
  const threads = [...new Set(history.filter(h => !h.hidden).map(h => h.thread || "main"))];
  const [view, setView] = useState(threads[0] || "main");
  const threaded = Object.keys(chats).length > 0 && threads.length > 0;
  const getChat = (id: string): ChatConfig => chats[id] || { name: characters[mainCharacter || ""]?.name || "Собеседник", kind: "dm", character: mainCharacter };
  const visible = history.filter(h => !h.hidden && (!threaded || (h.thread || "main") === view));
  const ids = new Set(visible.filter(h => h.speaker === "npc").map(h => h.character || mainCharacter || "npc"));
  const chat = threaded ? getChat(view) : null;
  const def = chat && chat.kind !== "group" ? chat.character || mainCharacter || "npc" : mainCharacter || [...ids][0] || "npc";
  const last: Record<string, string> = {};
  for (const h of history) if (!h.hidden) last[h.thread || "main"] = previewText(h.text);
  return (
    <div className="chat-bg px-safe flex h-[100dvh] flex-col">
      <header className="glass border-b border-white/[0.06] pt-safe">
        <div className="flex h-14 items-center gap-2 px-2">
          {!native && (
            <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full text-muted" aria-label="Назад">
              <Icon name="back" size={22} />
            </button>
          )}
          <p className="flex-1 truncate pl-2 text-[16px] font-semibold text-fg">{title}</p>
          {onReplay && (
            <button onClick={onReplay} className="chip mr-1 bg-white/[0.08] text-fg/80">
              <Icon name="refresh" size={13} /> Переиграть
            </button>
          )}
        </div>
        {threaded && threads.length > 1 && (
          <ThreadTabs
            threads={threads}
            view={view}
            active={view}
            unread={{}}
            typingThread={null}
            getChat={getChat}
            characters={{ npc: { name: "Собеседник" }, ...characters }}
            last={last}
            onOpen={setView}
          />
        )}
      </header>
      <div className="no-scrollbar flex-1 overflow-y-auto px-3 pb-safe">
        <DayDivider label="Переписка сохранена" />
        <MessageList entries={visible} characters={{ npc: { name: "Собеседник" }, ...characters }} multiParty={chat ? chat.kind === "group" : ids.size > 1} defaultCharacter={def} animateFrom={Infinity} clocks={storyClocks(history)} />
        <div className="h-6" />
      </div>
    </div>
  );
}
