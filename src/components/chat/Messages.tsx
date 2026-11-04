"use client";

import { memo } from "react";
import type { Character, HistoryEntry } from "@/lib/types/database";
import { Avatar, characterColor } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

function time(at: number) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface Props {
  entries: HistoryEntry[];
  characters: Record<string, Character>;
  /** Показывать имена и аватары (в дне больше одного собеседника) */
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
          return <SystemLine key={e.id + i} text={e.text} animate={animate} />;
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

function SystemLine({ text, animate }: { text: string; animate: boolean }) {
  return (
    <div className={`flex justify-center py-2 ${animate ? "animate-fade-in" : ""}`}>
      <div className="max-w-[86%] whitespace-pre-wrap rounded-2xl bg-white/[0.05] px-3.5 py-1.5 text-center text-[13px] leading-snug text-muted ring-1 ring-white/[0.05]">
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
  return (
    <div className={`flex items-end gap-2 ${tight ? "mb-0.5" : "mb-2"} ${animate ? "animate-msg-in" : ""}`} style={{ transformOrigin: "left bottom" }}>
      {reserveAvatar && (
        <div className="w-8 shrink-0">{showAvatar && <Avatar id={characterId} character={character} size={32} />}</div>
      )}
      <div className={`bubble-in relative max-w-[78%] px-3.5 pb-1.5 pt-2 ${tight ? "rounded-bl-[18px]" : ""}`}>
        {showName && (
          <div className="mb-0.5 text-[13px] font-semibold" style={{ color: characterColor(characterId, character) }}>
            {character?.name || characterId}
          </div>
        )}
        <p className="whitespace-pre-wrap break-words text-[15.5px] leading-[1.38] text-fg">
          {entry.text}
          <span className="inline-block w-[42px]" aria-hidden="true" />
        </p>
        <span className="absolute bottom-1.5 right-3 select-none text-[11px] leading-none text-faint">{time(entry.at)}</span>
      </div>
    </div>
  );
}

function OutBubble({ entry, tight, animate }: { entry: HistoryEntry; tight: boolean; animate: boolean }) {
  return (
    <div className={`flex justify-end ${tight ? "mb-0.5" : "mb-2"} ${animate ? "animate-msg-in" : ""}`} style={{ transformOrigin: "right bottom" }}>
      <div className="bubble-out relative max-w-[78%] px-3.5 pb-1.5 pt-2">
        <p className="whitespace-pre-wrap break-words text-[15.5px] leading-[1.38]">
          {entry.text}
          <span className="inline-block w-[58px]" aria-hidden="true" />
        </p>
        <span className="absolute bottom-1.5 right-3 inline-flex select-none items-center gap-0.5 text-[11px] leading-none text-white/70">
          {time(entry.at)}
          <Icon name="checks" size={14} strokeWidth={2.2} />
        </span>
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

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-3">
      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-medium text-muted backdrop-blur">{label}</span>
    </div>
  );
}
