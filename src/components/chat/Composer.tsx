"use client";

import { useEffect, useRef, useState } from "react";
import type { SnapshotChoice } from "@/lib/types/database";
import { isActionChoice, stripAction } from "@/lib/engine/runtime";
import { Icon } from "@/components/ui/Icon";
import { formatDuration, useNow } from "@/components/ui/Countdown";

type Option = SnapshotChoice & { text: string };

export function ChoicePanel({
  prompt,
  options,
  onSelect,
  timerMs,
  defaultId,
  onTick,
}: {
  prompt: string | null;
  options: Option[];
  onSelect: (o: Option, timedOut?: boolean) => void;
  timerMs?: number | null;
  defaultId?: string | null;
  onTick?: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [started] = useState(() => Date.now());
  const now = useNow(timerMs ? 100 : 60_000);
  const left = timerMs ? Math.max(0, timerMs - (now - started)) : 0;
  const secLeft = Math.ceil(left / 1000);
  const lastSec = useRef<number | null>(null);

  useEffect(() => {
    if (!timerMs || picked) return;
    if (secLeft !== lastSec.current) {
      lastSec.current = secLeft;
      if (secLeft <= 3 && secLeft > 0) onTick?.();
    }
    if (left <= 0) {
      const def = options.find(o => o.id === defaultId) || options[options.length - 1];
      setPicked(def.id);
      onSelect(def, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, timerMs, picked]);

  return (
    <div className="animate-sheet-up px-3 pb-3 pt-2">
      {timerMs ? (
        <div className="mb-2.5 px-1">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-danger/90">{prompt || "Решай быстро"}</p>
            <span className={`text-[13px] font-bold tabular-nums ${secLeft <= 3 ? "animate-pulse-soft text-danger" : "text-fg/80"}`}>{secLeft}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className={`h-full rounded-full ${left / timerMs < 0.3 ? "bg-danger" : "bg-warn"}`}
              style={{ width: `${(left / timerMs) * 100}%`, transition: "width 100ms linear" }}
            />
          </div>
        </div>
      ) : (
        prompt && <p className="mb-2 px-1 text-center text-[12.5px] font-medium uppercase tracking-[0.08em] text-faint">{prompt}</p>
      )}
      <div className="flex flex-col gap-2">
        {options.map((o, i) => {
          const action = isActionChoice(o.text);
          return (
            <button
              key={o.id}
              disabled={picked !== null}
              onClick={() => {
                setPicked(o.id);
                onSelect(o);
              }}
              className={`group relative w-full overflow-hidden rounded-2xl px-4 py-3.5 text-left text-[15px] leading-snug transition active:scale-[0.98] animate-slide-up ${
                picked === o.id ? "bg-accent text-white" : "bg-white/[0.06] text-fg ring-1 ring-white/[0.08] hover:bg-white/[0.09]"
              } ${picked !== null && picked !== o.id ? "opacity-40" : ""}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className={action ? "italic text-muted group-disabled:text-inherit" : ""}>{action ? stripAction(o.text) : o.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InputPanel({ prompt, placeholder, onSubmit }: { prompt: string; placeholder: string; onSubmit: (v: string) => void }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);
  const clean = value.trim();
  return (
    <form
      className="animate-sheet-up px-3 pb-3 pt-2"
      onSubmit={e => {
        e.preventDefault();
        if (clean) onSubmit(clean);
      }}
    >
      {prompt && <p className="mb-2 px-1 text-center text-[12.5px] font-medium uppercase tracking-[0.08em] text-faint">{prompt}</p>}
      <div className="flex items-center gap-2 rounded-full bg-white/[0.07] p-1.5 pl-4 ring-1 ring-white/[0.08] focus-within:ring-accent/60">
        <input
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value.slice(0, 40))}
          placeholder={placeholder}
          enterKeyHint="send"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-fg placeholder:text-faint focus:outline-none"
        />
        <button
          type="submit"
          disabled={!clean}
          aria-label="Отправить"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white transition active:scale-90 disabled:bg-white/10 disabled:text-faint"
        >
          <Icon name="send" size={18} />
        </button>
      </div>
    </form>
  );
}

export function PausePanel({ until, total, label, onSkip }: { until: number; total: number; label: string; onSkip: () => void }) {
  const now = useNow(250);
  const left = Math.max(0, until - now);
  const progress = total > 0 ? 1 - left / total : 1;
  return (
    <div className="animate-sheet-up px-3 pb-3 pt-2">
      <div className="rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-fg">{label}</p>
            <p className="text-[12.5px] text-faint">
              Ответит через <span className="tabular-nums text-muted">{formatDuration(left)}</span>
            </p>
          </div>
          <button onClick={onSkip} className="shrink-0 rounded-full bg-white/[0.07] px-3 py-1.5 text-[13px] font-medium text-muted active:scale-95">
            Не ждать
          </button>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-accent/70 transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Неактивная строка ввода (пока собеседник пишет) */
export function IdleComposer({ text }: { text: string }) {
  return (
    <div className="px-3 pb-3 pt-2">
      <div className="flex items-center gap-2 rounded-full bg-white/[0.04] p-1.5 pl-4 ring-1 ring-white/[0.05]">
        <span className="flex-1 truncate text-[15px] text-faint">{text}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-faint">
          <Icon name="send" size={18} />
        </span>
      </div>
    </div>
  );
}
