"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadDay, replayDay, type DayPayload } from "@/lib/actions/player";
import { useApp, useBackButton } from "@/lib/telegram/TelegramProvider";
import type { Flags, HistoryEntry } from "@/lib/types/database";
import { ChatPlayer } from "@/components/chat/ChatPlayer";
import { MessageList, DayDivider } from "@/components/chat/Messages";
import { FullscreenLoader, ErrorState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { DayComplete } from "./DayComplete";

type OkPayload = Extract<DayPayload, { ok: true }>;

export function PlayScreen({ storyId, dayNumber }: { storyId: string; dayNumber: number }) {
  const router = useRouter();
  const { ready, token, authError, retryAuth } = useApp();
  const [payload, setPayload] = useState<DayPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<"chat" | "complete" | "reread">("chat");
  const [result, setResult] = useState<{ history: HistoryEntry[]; flags: Flags; ending: string | null } | null>(null);
  const [coverStyle, setCoverStyle] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    setPayload(null);
    loadDay(token, storyId, dayNumber)
      .then(p => {
        setPayload(p);
        if (p.ok) {
          setCoverStyle(p.day.background);
          if (p.progress?.completed) {
            setResult({ history: p.progress.history, flags: p.progress.flags, ending: (p.progress.flags.__ending as string) || null });
            setMode("complete");
          } else setMode("chat");
        }
      })
      .catch(() => setFailed(true));
  }, [token, storyId, dayNumber]);

  useEffect(() => {
    if (ready && token) load();
  }, [ready, token, load]);

  const toStory = useCallback(() => router.push(`/story/${storyId}`), [router, storyId]);

  if (!ready) return <FullscreenLoader />;
  if (authError) return <ErrorState title="Не удалось войти" text="Проверьте соединение и попробуйте снова." action={retryAuth} />;
  if (failed) return <ErrorState title="Нет соединения" text="Не получилось загрузить день." action={load} />;
  if (!payload) return <FullscreenLoader label="Открываем переписку…" />;

  if (!payload.ok) {
    if (payload.reason === "locked") {
      return <ErrorState icon="lock" title="День пока закрыт" text="Сначала завершите предыдущий день — или откройте его на странице истории." href={`/story/${storyId}`} actionLabel="К истории" />;
    }
    return <ErrorState icon="book" title="День не найден" text="Возможно, он ещё не опубликован." href="/" actionLabel="На главную" />;
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
        title={`День ${p.day.number} · ${p.day.title}`}
        characters={p.characters}
        mainCharacter={p.story.meta.main_character}
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

  return (
    <ChatPlayer
      key={`${p.day.id}:${p.version}`}
      storyId={storyId}
      dayId={p.day.id}
      dayNumber={p.day.number}
      dayTitle={p.day.title}
      version={p.version}
      snapshot={p.snapshot}
      characters={p.characters}
      mainCharacter={p.story.meta.main_character}
      inheritedFlags={p.inheritedFlags}
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
  onBack,
  onReplay,
}: {
  history: HistoryEntry[];
  title: string;
  characters: OkPayload["characters"];
  mainCharacter?: string;
  onBack: () => void;
  onReplay?: () => void;
}) {
  const native = useBackButton(onBack);
  const visible = history.filter(h => !h.hidden);
  const ids = new Set(visible.filter(h => h.speaker === "npc").map(h => h.character || mainCharacter || "npc"));
  const def = mainCharacter || [...ids][0] || "npc";
  return (
    <div className="chat-bg flex h-[100dvh] flex-col">
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
      </header>
      <div className="no-scrollbar flex-1 overflow-y-auto px-3 pb-safe">
        <DayDivider label="Переписка сохранена" />
        <MessageList entries={visible} characters={{ npc: { name: "Собеседник" }, ...characters }} multiParty={ids.size > 1} defaultCharacter={def} animateFrom={Infinity} />
        <div className="h-6" />
      </div>
    </div>
  );
}
