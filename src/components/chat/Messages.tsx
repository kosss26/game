"use client";

import { memo, useEffect, useState } from "react";
import type { Character, HistoryEntry } from "@/lib/types/database";
import { PhotoAttachment } from "./PhotoAttachment";
import { Avatar, characterColor } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";

function time(at: number) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Вложения: префикс в тексте реплики
//   [фото] подпись              [голосовое 0:23] расшифровка
//   [гео] место                 [файл имя.pdf] описание
//   [пересланное Имя] текст     [удалено] текст (исчезает через пару секунд)
// ---------------------------------------------------------------------------

type Attachment =
  | { kind: "photo"; body: string; source?: string }
  | { kind: "voice"; duration: string; body: string }
  | { kind: "geo"; body: string }
  | { kind: "file"; name: string; body: string }
  | { kind: "fwd"; from: string; body: string }
  | { kind: "deleted"; body: string }
  | { kind: "cam"; label: string; body: string }
  | { kind: "call"; duration: string; body: string }
  | { kind: "missed"; body: string }
  | { kind: "text"; body: string };

export function parseAttachment(text: string): Attachment {
  const m = text.match(/^\[([^\]\s]+)(?:\s+([^\]]+))?\]\s*([\s\S]*)$/);
  if (!m) return { kind: "text", body: text };
  const [, tag, arg = "", body] = m;
  switch (tag.toLowerCase()) {
    case "фото":
    case "photo":
      return { kind: "photo", body, ...(arg ? { source: arg } : {}) };
    case "голосовое":
    case "voice":
      return { kind: "voice", duration: arg || "0:07", body };
    case "гео":
    case "геолокация":
    case "location":
      return { kind: "geo", body };
    case "файл":
    case "file":
      return { kind: "file", name: arg || "файл", body };
    case "пересланное":
    case "fwd":
      return { kind: "fwd", from: arg || "", body };
    case "удалено":
    case "deleted":
      return { kind: "deleted", body };
    case "камера":
    case "cam":
      return { kind: "cam", label: arg || "КАМ", body };
    case "звонок":
    case "call":
      return { kind: "call", duration: arg || "", body };
    case "пропущенный":
    case "missed":
      return { kind: "missed", body };
    default:
      return { kind: "text", body: text };
  }
}

/** Текст сообщения для превью (уведомления, список чатов) */
export function previewText(text: string): string {
  const a = parseAttachment(text);
  switch (a.kind) {
    case "photo":
      return "📷 Фото";
    case "voice":
      return `🎤 Голосовое ${a.duration}`;
    case "geo":
      return "📍 Геопозиция";
    case "file":
      return `📎 ${a.name}`;
    case "fwd":
      return `↪ ${a.body}`;
    case "deleted":
      return "Сообщение удалено";
    case "cam":
      return `📹 Камера ${a.label}`;
    case "call":
      return `📞 Звонок ${a.duration}`;
    case "missed":
      return "📵 Пропущенный звонок";
    default:
      return a.body;
  }
}

function hash(s: string) {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function Waveform({ seed, light }: { seed: string; light?: boolean }) {
  let h = hash(seed);
  return (
    <span className="flex h-6 flex-1 items-center gap-[2px]">
      {Array.from({ length: 28 }, (_, i) => {
        h = (h * 1103515245 + 12345) & 0x7fffffff;
        const v = 4 + (h % 18);
        return <span key={i} className={`w-[3px] rounded-full ${light ? "bg-white/70" : "bg-accent/70"}`} style={{ height: v }} />;
      })}
    </span>
  );
}

function AttachmentBody({ a, out, fresh, at }: { a: Attachment; out?: boolean; fresh: boolean; at: number }) {
  const muted = out ? "text-white/75" : "text-muted";
  switch (a.kind) {
    case "photo":
      return (
        <PhotoAttachment body={a.body} source={a.source} />
      );
    case "voice":
      return (
        <div className="w-[min(250px,64vw)]">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${out ? "bg-white/25" : "bg-accent"} text-white`}>
              <Icon name="play" size={15} />
            </span>
            <Waveform seed={a.body} light={out} />
            <span className={`text-[12px] tabular-nums ${muted}`}>{a.duration}</span>
          </div>
          <span className="voice-label">Расшифровка голосового</span>
          {a.body && <p className={`mt-1.5 whitespace-pre-wrap text-[14px] italic leading-snug ${out ? "text-white/90" : "text-fg/85"}`}>{a.body}</p>}
        </div>
      );
    case "geo":
      return (
        <div className="-mx-1.5 -mt-0.5 mb-1 w-[min(240px,62vw)] overflow-hidden rounded-2xl ring-1 ring-white/5">
          <div
            className="relative h-28"
            style={{
              backgroundColor: "#1b2433",
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px), radial-gradient(60% 50% at 30% 70%, #23405a 0%, transparent 70%)",
              backgroundSize: "18px 18px, 18px 18px, 100% 100%",
            }}
          >
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-danger drop-shadow">
              <Icon name="pin" size={30} strokeWidth={2.2} />
            </span>
          </div>
          <p className="bg-black/20 px-3 py-2 text-[13px] text-fg/85">{a.body}</p>
        </div>
      );
    case "file":
      return (
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${out ? "bg-white/20" : "bg-accent/20 text-accent"}`}>
            <Icon name="file" size={20} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] font-medium">{a.name}</span>
            {a.body && <span className={`block text-[13px] ${muted}`}>{a.body}</span>}
          </span>
        </div>
      );
    case "fwd":
      return (
        <div className={`border-l-2 pl-2.5 ${out ? "border-white/50" : "border-accent"}`}>
          <p className={`mb-0.5 flex items-center gap-1 text-[12.5px] font-medium ${out ? "text-white/80" : "text-accent"}`}>
            <Icon name="forward" size={12} /> Переслано{a.from ? ` от ${a.from}` : ""}
          </p>
          <AttachmentBody a={parseAttachment(a.body)} out={out} fresh={fresh} at={at} />
        </div>
      );
    case "deleted":
      return <Deleted body={a.body} fresh={fresh} at={at} />;
    case "cam":
      return <CamFrame label={a.label} body={a.body} at={at} />;
    case "call":
      return (
        <div className="w-[min(250px,64vw)]">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${out ? "bg-white/20" : "bg-ok/20 text-ok"}`}>
              <Icon name="phone" size={18} />
            </span>
            <span>
              <span className="block text-[14.5px] font-medium">{out ? "Исходящий звонок" : "Входящий звонок"}</span>
              {a.duration && <span className={`block text-[12.5px] ${muted}`}>{a.duration}</span>}
            </span>
          </div>
          {a.body && <p className={`mt-2 whitespace-pre-wrap text-[14px] leading-snug ${out ? "text-white/90" : "text-fg/85"}`}>{a.body}</p>}
        </div>
      );
    case "missed":
      return (
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/20 text-danger">
            <Icon name="phoneMissed" size={18} />
          </span>
          <span>
            <span className="block text-[14.5px] font-medium">Пропущенный звонок</span>
            {a.body && <span className={`block text-[12.5px] ${muted}`}>{a.body}</span>}
          </span>
        </div>
      );
    default:
      return <>{a.body}</>;
  }
}

/** Удалённое сообщение: свежим его можно успеть прочитать */
function Deleted({ body, fresh, at }: { body: string; fresh: boolean; at: number }) {
  const [gone, setGone] = useState(() => !fresh || Date.now() - at > 3200);
  useEffect(() => {
    if (gone) return;
    const t = setTimeout(() => setGone(true), Math.max(0, 3200 - (Date.now() - at)));
    return () => clearTimeout(t);
  }, [gone, at]);
  if (!gone) return <span className="transition-opacity">{body}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 italic text-faint">
      <Icon name="trash" size={14} /> Сообщение удалено
    </span>
  );
}

function isRich(a: Attachment) {
  return ["photo", "voice", "geo", "file", "fwd", "cam", "call", "missed"].includes(a.kind);
}

/** Кадр камеры видеонаблюдения */
function CamFrame({ label, body, at }: { label: string; body: string; at: number }) {
  const d = new Date(at);
  const ts = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  return (
    <div className="-mx-1.5 -mt-0.5 mb-1 w-[min(260px,66vw)] overflow-hidden rounded-xl ring-1 ring-white/10">
      <div
        className="relative min-h-[120px] p-3 font-mono text-[12.5px] leading-snug text-[#c8e6c0]"
        style={{
          background: "radial-gradient(120% 90% at 50% 40%, #1d2a22 0%, #0b100d 100%)",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px), radial-gradient(120% 90% at 50% 40%, #1d2a22 0%, #0b100d 100%)",
        }}
      >
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-[#9fc79a]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-danger" /> REC · {label}
          </span>
          <span className="tabular-nums">{ts}</span>
        </div>
        <p className="whitespace-pre-wrap">{body}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface Props {
  entries: HistoryEntry[];
  characters: Record<string, Character>;
  /** Показывать имена и аватары (в чате больше одного собеседника) */
  multiParty: boolean;
  defaultCharacter: string;
  /** Анимировать только новые сообщения */
  animateFrom: number;
}

export const MessageList = memo(function MessageList({ entries, characters, multiParty, defaultCharacter, animateFrom }: Props) {
  return (
    <>
      {entries.map((e, i) => {
        const prev = entries[i - 1];
        const next = entries[i + 1];
        const who = e.character || defaultCharacter;
        const sameAsPrev = prev && prev.kind !== "system" && prev.speaker === e.speaker && (prev.character || defaultCharacter) === who;
        const sameAsNext = next && next.kind !== "system" && next.speaker === e.speaker && (next.character || defaultCharacter) === who;
        const animate = i >= animateFrom;

        if (e.kind === "system") {
          return <SystemLine key={e.id + i} text={e.text} animate={animate} past={!!e.past} />;
        }
        if (e.speaker === "me") {
          return <OutBubble key={e.id + i} entry={e} tight={!!sameAsNext} animate={animate} />;
        }
        return (
          <InBubble
            key={e.id + i}
            entry={e}
            characterId={who}
            character={characters[who]}
            showName={multiParty && !sameAsPrev}
            showAvatar={multiParty && !sameAsNext}
            reserveAvatar={multiParty}
            tight={!!sameAsNext}
            animate={animate}
          />
        );
      })}
    </>
  );
});

function SystemLine({ text, animate, past }: { text: string; animate: boolean; past: boolean }) {
  return (
    <div className={`flex justify-center py-2 ${animate ? "animate-fade-in" : ""}`}>
      <div
        className={`max-w-[86%] whitespace-pre-wrap rounded-2xl px-3.5 py-1.5 text-center text-[13px] leading-snug ring-1 ring-white/[0.05] ${
          past ? "bg-transparent text-faint" : "bg-white/[0.05] text-muted"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function InBubble({
  entry,
  characterId,
  character,
  showName,
  showAvatar,
  reserveAvatar,
  tight,
  animate,
}: {
  entry: HistoryEntry;
  characterId: string;
  character?: Character;
  showName: boolean;
  showAvatar: boolean;
  reserveAvatar: boolean;
  tight: boolean;
  animate: boolean;
}) {
  const a = parseAttachment(entry.text);
  const rich = isRich(a);
  return (
    <div className={`flex items-end gap-2 ${tight ? "mb-0.5" : "mb-2"} ${animate ? "animate-msg-in" : ""} ${entry.past ? "opacity-75" : ""}`} style={{ transformOrigin: "left bottom" }}>
      {reserveAvatar && <div className="w-8 shrink-0">{showAvatar && <Avatar id={characterId} character={character} size={32} />}</div>}
      <div className={`bubble-in relative max-w-[78%] px-3.5 pb-1.5 pt-2 ${tight ? "rounded-bl-[18px]" : ""}`}>
        {showName && (
          <div className="mb-0.5 text-[13px] font-semibold" style={{ color: characterColor(characterId, character) }}>
            {character?.name || characterId}
          </div>
        )}
        <div className="message-copy whitespace-pre-wrap break-words text-[15.5px] leading-[1.5] text-fg">
          <AttachmentBody a={a} fresh={animate} at={entry.at} />
          {!entry.past && <span className={rich ? "block h-3" : "inline-block w-[42px]"} aria-hidden="true" />}
        </div>
        {!entry.past && <span className="absolute bottom-1.5 right-3 select-none text-[11px] leading-none text-faint">{time(entry.at)}</span>}
      </div>
    </div>
  );
}

function OutBubble({ entry, tight, animate }: { entry: HistoryEntry; tight: boolean; animate: boolean }) {
  const a = parseAttachment(entry.text);
  const rich = isRich(a);
  return (
    <div className={`flex justify-end ${tight ? "mb-0.5" : "mb-2"} ${animate ? "animate-msg-in" : ""} ${entry.past ? "opacity-75" : ""}`} style={{ transformOrigin: "right bottom" }}>
      <div className="bubble-out relative max-w-[78%] px-3.5 pb-1.5 pt-2">
        <div className="message-copy whitespace-pre-wrap break-words text-[15.5px] leading-[1.5]">
          <AttachmentBody a={a} out fresh={animate} at={entry.at} />
          {!entry.past && <span className={rich ? "block h-3" : "inline-block w-[58px]"} aria-hidden="true" />}
        </div>
        {!entry.past && (
          <span className="absolute bottom-1.5 right-3 inline-flex select-none items-center gap-0.5 text-[11px] leading-none text-white/70">
            {time(entry.at)}
            <Icon name="checks" size={14} strokeWidth={2.2} />
          </span>
        )}
      </div>
    </div>
  );
}

export function TypingBubble({ characterId, character, multiParty }: { characterId: string; character?: Character; multiParty: boolean }) {
  return (
    <div className="mb-2 flex items-end gap-2 animate-msg-in" style={{ transformOrigin: "left bottom" }}>
      {multiParty && (
        <div className="w-8 shrink-0">
          <Avatar id={characterId} character={character} size={32} />
        </div>
      )}
      <div className="bubble-in px-4 py-3.5">
        <div className="typing-dots flex items-center gap-1">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export function DayDivider({ label, icon }: { label: string; icon?: IconName }) {
  return (
    <div className="flex items-center justify-center py-3">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-medium text-muted backdrop-blur">
        {icon && <Icon name={icon} size={12} />}
        {label}
      </span>
    </div>
  );
}
