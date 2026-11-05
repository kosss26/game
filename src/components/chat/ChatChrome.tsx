"use client";

import { useEffect } from "react";
import type { Character, ChatConfig, StoryMeta } from "@/lib/types/database";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

// ---------------------------------------------------------------------------
// Вкладки чатов
// ---------------------------------------------------------------------------

export function ThreadTabs({
  threads,
  view,
  active,
  unread,
  typingThread,
  getChat,
  characters,
  last,
  onOpen,
}: {
  threads: string[];
  view: string;
  active: string;
  unread: Record<string, number>;
  typingThread: string | null;
  getChat: (id: string) => ChatConfig;
  characters: Record<string, Character>;
  last: Record<string, string>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-2 pb-2">
      {threads.map(t => {
        const c = getChat(t);
        const group = c.kind === "group";
        const ch: Character | undefined = group
          ? { name: c.name, color: c.color || "#6b7a99", initials: c.initials || c.name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1) }
          : characters[c.character || ""] || { name: c.name };
        const selected = t === view;
        const n = unread[t] || 0;
        const typing = typingThread === t && !selected;
        return (
          <button
            key={t}
            onClick={() => onOpen(t)}
            className={`relative flex max-w-[180px] shrink-0 items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-3 text-left transition active:scale-95 ${
              selected ? "bg-white/[0.11] ring-1 ring-white/15" : "bg-white/[0.04]"
            }`}
          >
            <Avatar id={group ? `chat:${t}` : c.character || t} character={ch} size={26} />
            <span className="min-w-0">
              <span className={`block truncate text-[13px] font-semibold leading-tight ${selected ? "text-fg" : "text-fg/80"}`}>{c.name}</span>
              <span className={`block truncate text-[11px] leading-tight ${typing ? "text-accent" : "text-faint"}`}>
                {typing ? "печатает…" : t === active && !selected ? "сейчас здесь" : last[t] || ""}
              </span>
            </span>
            {n > 0 && !selected && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Тосты: новое сообщение в другом чате / новая улика
// ---------------------------------------------------------------------------

export interface ToastData {
  id: string;
  kind: "message" | "clue";
  thread?: string;
  title: string;
  text: string;
}

export function Toast({ data, onClose, onOpen }: { data: ToastData; onClose: () => void; onOpen: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, data.kind === "clue" ? 3600 : 3000);
    return () => clearTimeout(t);
  }, [data, onClose]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center px-3">
      <button
        key={data.id}
        onClick={() => {
          onOpen();
          onClose();
        }}
        className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left shadow-card backdrop-blur-xl animate-slide-up ${
          data.kind === "clue" ? "bg-warn/15 ring-1 ring-warn/40" : "bg-elevated/95 ring-1 ring-white/10"
        }`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${data.kind === "clue" ? "bg-warn/25 text-warn" : "bg-accent/20 text-accent"}`}>
          <Icon name={data.kind === "clue" ? "search" : "send"} size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] font-semibold ${data.kind === "clue" ? "text-warn" : "text-fg"}`}>{data.title}</span>
          <span className="block truncate text-[13.5px] text-fg/80">{data.text}</span>
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Блокнот улик
// ---------------------------------------------------------------------------

export function ClueSheet({ meta, found, onClose }: { meta?: StoryMeta; found: string[]; onClose: () => void }) {
  const all = Object.entries(meta?.clues || {});
  const got = all.filter(([id]) => found.includes(id));
  const missing = all.length - got.length;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/55 animate-fade-in" onClick={onClose}>
      <div className="max-h-[85dvh] w-full overflow-y-auto rounded-t-[28px] bg-raised p-4 pb-safe animate-sheet-up" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <div className="mb-3 flex items-baseline justify-between px-1">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">Улики</p>
          <p className="text-[13px] tabular-nums text-muted">
            {got.length} из {all.length}
          </p>
        </div>
        {got.length === 0 && <p className="px-1 py-6 text-center text-[14.5px] text-muted">Пока ничего. Задавайте вопросы и сравнивайте ответы.</p>}
        <ol className="space-y-2">
          {got.map(([id, c], i) => (
            <li key={id} className="rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/[0.06]">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warn/20 text-[12px] font-bold text-warn">{i + 1}</span>
                {c.title}
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{c.text}</p>
            </li>
          ))}
        </ol>
        {missing > 0 && got.length > 0 && (
          <p className="mt-3 px-1 text-center text-[13px] text-faint">
            Не найдено: {missing}. Кто-то знает больше, чем говорит.
          </p>
        )}
        <button className="btn-secondary mt-4 w-full" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
