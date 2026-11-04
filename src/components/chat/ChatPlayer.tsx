"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Character, Flags, HistoryEntry, ProgressState, SnapshotChoice, SnapshotData } from "@/lib/types/database";
import { applyChoice, applyInput, buildRuntime, isActionChoice, nextAfter, resolve, stripAction, type Step } from "@/lib/engine/runtime";
import { saveProgress, recordChoice, completeDay } from "@/lib/actions/player";
import { useApp, useBackButton, type Speed } from "@/lib/telegram/TelegramProvider";
import { MessageList, TypingBubble, DayDivider } from "./Messages";
import { ChoicePanel, InputPanel, PausePanel, IdleComposer } from "./Composer";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

export interface ChatPlayerProps {
  storyId: string;
  dayId: string;
  dayNumber: number;
  dayTitle: string;
  version: number;
  snapshot: SnapshotData;
  characters: Record<string, Character>;
  mainCharacter?: string;
  initial: {
    history: HistoryEntry[];
    flags: Flags;
    pointer: string | null;
    state: ProgressState;
    completed: boolean;
  } | null;
  inheritedFlags: Flags;
  preview?: boolean;
  onExit: () => void;
  onComplete: (result: { history: HistoryEntry[]; flags: Flags; ending: string | null }) => void;
}

type ChoiceStep = Extract<Step, { kind: "choice" }>;
type InputStep = Extract<Step, { kind: "input" }>;

type Ui =
  | { kind: "running" }
  | { kind: "typing"; who: string }
  | { kind: "choice"; step: ChoiceStep }
  | { kind: "input"; step: InputStep }
  | { kind: "pause"; sceneId: string; until: number; total: number; label: string }
  | { kind: "ended" };

const SPEED: Record<Speed, number> = { normal: 1, fast: 0.45, instant: 0 };

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export function ChatPlayer(props: ChatPlayerProps) {
  const { storyId, dayId, dayNumber, dayTitle, version, snapshot, characters, preview, onExit, onComplete } = props;
  const { token, haptic, speed, setSpeed, webApp } = useApp();
  const rt = useMemo(() => buildRuntime(snapshot), [snapshot]);

  const defaultCharacter = useMemo(() => {
    if (props.mainCharacter && characters[props.mainCharacter]) return props.mainCharacter;
    const first = snapshot.scenes.find(s => s.meta?.character)?.meta?.character;
    return first || Object.keys(characters)[0] || "npc";
  }, [props.mainCharacter, characters, snapshot.scenes]);

  const multiParty = useMemo(() => {
    const ids = new Set(snapshot.scenes.filter(s => s.type === "message" && s.speaker === "npc").map(s => s.meta?.character || defaultCharacter));
    return ids.size > 1;
  }, [snapshot.scenes, defaultCharacter]);

  const allCharacters = useMemo<Record<string, Character>>(
    () => ({ npc: { name: "Собеседник" }, ...characters }),
    [characters]
  );

  // --- состояние ---
  const [log, setLog] = useState<HistoryEntry[]>(() => props.initial?.history || []);
  const [ui, setUi] = useState<Ui>({ kind: "running" });
  const [showSettings, setShowSettings] = useState(false);
  const animateFrom = useRef(props.initial?.history.length || 0);

  const logRef = useRef<HistoryEntry[]>(log);
  const flagsRef = useRef<Flags>(props.initial?.flags || props.inheritedFlags);
  const pointerRef = useRef<string | null>(props.initial?.pointer ?? rt.firstSceneId);
  const pauseRef = useRef<ProgressState>({});
  const lastSpeaker = useRef<string>(defaultCharacter);
  const runId = useRef(0);
  const speedRef = useRef(SPEED[speed]);
  const finished = useRef(false);
  speedRef.current = SPEED[speed];

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // --- сохранение ---
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNow = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (preview || finished.current) return;
    saveProgress(token, {
      storyId,
      dayId,
      sceneId: pointerRef.current,
      flags: flagsRef.current,
      history: logRef.current,
      state: pauseRef.current,
      version,
    }).catch(() => undefined);
  }, [preview, token, storyId, dayId, version]);

  const scheduleSave = useCallback(() => {
    if (preview || saveTimer.current) return;
    saveTimer.current = setTimeout(saveNow, 3000);
  }, [preview, saveNow]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runId.current++; // остановить раннер
      saveNow();
    };
  }, [saveNow]);

  const append = useCallback((entry: HistoryEntry) => {
    logRef.current = [...logRef.current, entry];
    setLog(logRef.current);
  }, []);

  // --- завершение ---
  const finish = useCallback(
    async (ending: string | null) => {
      if (finished.current) return;
      setUi({ kind: "ended" });
      haptic("success");
      if (!preview) {
        await completeDay(token, {
          storyId,
          dayId,
          sceneId: null,
          flags: flagsRef.current,
          history: logRef.current,
          version,
          ending,
        }).catch(() => undefined);
      }
      finished.current = true;
      await sleep(1100);
      onComplete({ history: logRef.current, flags: flagsRef.current, ending });
    },
    [haptic, preview, token, storyId, dayId, version, onComplete]
  );

  // --- основной цикл ---
  const run = useCallback(
    async (from: string | null) => {
      const my = ++runId.current;
      let pointer = from;
      const alive = () => runId.current === my;

      for (let guard = 0; guard < 10000; guard++) {
        if (!alive()) return;
        const r = resolve(rt, pointer, flagsRef.current);
        flagsRef.current = r.flags;
        const step = r.step;
        const sp = speedRef.current;

        if (step.kind === "message") {
          const isNpc = step.scene.type === "message" && step.scene.speaker === "npc";
          const who = step.scene.meta?.character || defaultCharacter;
          if (step.delayMs) await sleep(step.delayMs * sp);
          if (!alive()) return;
          if (isNpc && step.typingMs > 0 && sp > 0) {
            lastSpeaker.current = who;
            setUi({ kind: "typing", who });
            await sleep(step.typingMs * sp);
          } else {
            await sleep(sp === 0 ? 30 : step.scene.speaker === "me" ? 500 * sp : 350 * sp);
          }
          if (!alive()) return;
          append({
            id: step.scene.id,
            kind: step.scene.type === "system" ? "system" : "message",
            speaker: step.scene.type === "system" ? "system" : step.scene.speaker || "npc",
            character: isNpc ? who : null,
            text: step.text,
            at: Date.now(),
          });
          if (isNpc) haptic("light");
          pointer = nextAfter(rt, step.scene.id);
          pointerRef.current = pointer;
          setUi({ kind: "running" });
          scheduleSave();
          await sleep(sp === 0 ? 20 : 260 * sp);
          continue;
        }

        if (step.kind === "typing") {
          if (sp > 0) {
            setUi({ kind: "typing", who: lastSpeaker.current });
            await sleep(step.ms * sp);
          }
          pointer = nextAfter(rt, step.scene.id);
          pointerRef.current = pointer;
          setUi({ kind: "running" });
          continue;
        }

        if (step.kind === "pause") {
          const until = Date.now() + step.ms;
          const label = step.label || `${allCharacters[lastSpeaker.current]?.name || "Собеседник"} не в сети`;
          pointerRef.current = step.scene.id;
          pauseRef.current = { pause_until: until, pause_label: label };
          setUi({ kind: "pause", sceneId: step.scene.id, until, total: step.ms, label });
          saveNow();
          return;
        }

        if (step.kind === "choice") {
          pointerRef.current = step.scene.id;
          setUi({ kind: "choice", step });
          haptic("select");
          saveNow();
          return;
        }

        if (step.kind === "input") {
          pointerRef.current = step.scene.id;
          setUi({ kind: "input", step });
          saveNow();
          return;
        }

        // end
        pointerRef.current = null;
        await finish(step.ending);
        return;
      }
    },
    [rt, defaultCharacter, append, haptic, scheduleSave, saveNow, finish, allCharacters]
  );

  // --- старт / восстановление ---
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const init = props.initial;
    if (init && !init.completed && init.pointer && !rt.indexById.has(init.pointer)) {
      // версия сценария изменилась так, что позиция потеряна — начинаем день заново
      logRef.current = [];
      setLog([]);
      flagsRef.current = props.inheritedFlags;
      animateFrom.current = 0;
      run(rt.firstSceneId);
      return;
    }
    const lastNpc = [...(init?.history || [])].reverse().find(h => h.speaker === "npc" && h.character);
    if (lastNpc?.character) lastSpeaker.current = lastNpc.character;

    if (init?.state?.pause_until && init.pointer) {
      const until = init.state.pause_until;
      if (until > Date.now()) {
        pauseRef.current = init.state;
        const scene = rt.scenes[rt.indexById.get(init.pointer)!];
        setUi({
          kind: "pause",
          sceneId: init.pointer,
          until,
          total: scene?.meta?.pause_duration || until - Date.now(),
          label: init.state.pause_label || "Не в сети",
        });
        return;
      }
      pauseRef.current = {};
      run(nextAfter(rt, init.pointer));
      return;
    }
    if (init && !init.pointer && init.history.length > 0) {
      // день дочитан, но не отмечен завершённым (сбой сети)
      finish(null);
      return;
    }
    run(init?.pointer ?? rt.firstSceneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- пауза ---
  const endPause = useCallback(() => {
    if (ui.kind !== "pause") return;
    pauseRef.current = {};
    const next = nextAfter(rt, ui.sceneId);
    pointerRef.current = next;
    setUi({ kind: "running" });
    run(next);
  }, [ui, rt, run]);

  useEffect(() => {
    if (ui.kind !== "pause") return;
    const t = setTimeout(endPause, Math.max(0, ui.until - Date.now()));
    return () => clearTimeout(t);
  }, [ui, endPause]);

  // --- выбор / ввод ---
  const onChoice = useCallback(
    async (option: SnapshotChoice & { text: string }) => {
      if (ui.kind !== "choice") return;
      const sceneId = ui.step.scene.id;
      haptic("medium");
      const action = isActionChoice(option.text);
      await sleep(180);
      setUi({ kind: "running" });
      append({
        id: `reply:${sceneId}:${option.id}`,
        kind: "reply",
        speaker: "me",
        text: action ? stripAction(option.text) : option.text,
        at: Date.now(),
        ...(action ? { hidden: true } : {}),
      });
      if (!preview) recordChoice(token, { storyId, dayId, sceneId, choiceId: option.id }).catch(() => undefined);
      const res = applyChoice(rt, sceneId, option, flagsRef.current);
      flagsRef.current = res.flags;
      pointerRef.current = res.pointer;
      scheduleSave();
      run(res.pointer);
    },
    [ui, haptic, append, preview, token, storyId, dayId, rt, scheduleSave, run]
  );

  const onInput = useCallback(
    (value: string) => {
      if (ui.kind !== "input") return;
      const step = ui.step;
      haptic("light");
      setUi({ kind: "running" });
      append({ id: `input:${step.scene.id}`, kind: "reply", speaker: "me", text: value, at: Date.now() });
      const res = applyInput(rt, step.scene.id, step.key, value, flagsRef.current);
      flagsRef.current = res.flags;
      pointerRef.current = res.pointer;
      scheduleSave();
      run(res.pointer);
    },
    [ui, haptic, append, rt, scheduleSave, run]
  );

  // --- прокрутка ---
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: log.length - animateFrom.current > 0 ? "smooth" : "auto" });
  }, [log, ui]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };

  // Защита от случайного закрытия свайпом посреди дня
  useEffect(() => {
    if (preview) return;
    webApp?.enableClosingConfirmation?.();
    return () => webApp?.disableClosingConfirmation?.();
  }, [webApp, preview]);

  const nativeBack = useBackButton(onExit);

  // --- шапка ---
  const headerChar = defaultCharacter;
  const status =
    ui.kind === "typing"
      ? multiParty
        ? `${allCharacters[ui.who]?.name || "Собеседник"} печатает…`
        : "печатает…"
      : ui.kind === "pause"
        ? ui.label
        : ui.kind === "ended"
          ? "был(а) только что"
          : allCharacters[defaultCharacter]?.status || "в сети";
  const online = ui.kind !== "pause" && ui.kind !== "ended";
  const visibleLog = useMemo(() => log.filter(e => !e.hidden), [log]);
  const visibleAnimateFrom = useMemo(
    () => log.slice(0, animateFrom.current).filter(e => !e.hidden).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [log.length]
  );

  return (
    <div className="chat-bg relative flex h-[100dvh] flex-col overflow-hidden">
      {/* Шапка */}
      <header className="glass relative z-20 border-b border-white/[0.06] pt-safe">
        <div className="flex h-14 items-center gap-2 px-2">
          {!nativeBack ? (
            <button onClick={onExit} className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-white/5" aria-label="Назад">
              <Icon name="back" size={22} />
            </button>
          ) : (
            <span className="w-2" />
          )}
          <Avatar id={headerChar} character={allCharacters[headerChar]} size={40} online={online} />
          <div className="min-w-0 flex-1 pl-1">
            <p className="truncate text-[16px] font-semibold leading-tight text-fg">
              {allCharacters[defaultCharacter]?.name || "Собеседник"}
            </p>
            <p className={`truncate text-[13px] leading-tight ${ui.kind === "typing" ? "text-accent" : online ? "text-ok/90" : "text-faint"}`}>{status}</p>
          </div>
          {preview && <span className="chip bg-warn/15 text-warn">предпросмотр</span>}
          <button onClick={() => setShowSettings(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-white/5" aria-label="Настройки">
            <Icon name="more" size={26} strokeWidth={3} />
          </button>
        </div>
      </header>

      {/* Лента */}
      <div ref={scrollRef} onScroll={onScroll} className="no-scrollbar relative z-10 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 pt-1">
        <DayDivider label={`День ${dayNumber} · ${dayTitle}`} />
        <MessageList
          entries={visibleLog}
          characters={allCharacters}
          multiParty={multiParty}
          defaultCharacter={defaultCharacter}
          animateFrom={visibleAnimateFrom}
        />
        {ui.kind === "typing" && <TypingBubble characterId={ui.who} character={allCharacters[ui.who]} multiParty={multiParty} />}
        {ui.kind === "ended" && (
          <div className="flex justify-center py-4 animate-fade-in">
            <span className="text-[12px] uppercase tracking-[0.2em] text-faint">— конец дня —</span>
          </div>
        )}
        <div className="h-2" />
      </div>

      {/* Нижняя панель */}
      <div className="glass relative z-20 border-t border-white/[0.06] pb-safe">
        {ui.kind === "choice" && <ChoicePanel key={ui.step.scene.id} prompt={ui.step.prompt} options={ui.step.options} onSelect={onChoice} />}
        {ui.kind === "input" && <InputPanel key={ui.step.scene.id} prompt={ui.step.prompt} placeholder={ui.step.placeholder} onSubmit={onInput} />}
        {ui.kind === "pause" && <PausePanel until={ui.until} total={ui.total} label={ui.label} onSkip={endPause} />}
        {(ui.kind === "running" || ui.kind === "typing") && <IdleComposer text={ui.kind === "typing" ? status : "Сообщение"} />}
        {ui.kind === "ended" && <IdleComposer text="Собеседник вышел из сети" />}
      </div>

      {showSettings && <SettingsSheet speed={speed} onSpeed={setSpeed} onClose={() => setShowSettings(false)} onExit={onExit} />}
    </div>
  );
}

function SettingsSheet({ speed, onSpeed, onClose, onExit }: { speed: Speed; onSpeed: (s: Speed) => void; onClose: () => void; onExit: () => void }) {
  const opts: Array<{ id: Speed; title: string; hint: string }> = [
    { id: "normal", title: "Как в жизни", hint: "Реалистичный набор текста" },
    { id: "fast", title: "Быстро", hint: "Вдвое быстрее" },
    { id: "instant", title: "Мгновенно", hint: "Без анимаций — для перечитывания" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/55 animate-fade-in" onClick={onClose}>
      <div className="w-full rounded-t-[28px] bg-raised p-4 pb-safe animate-sheet-up" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <p className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">Скорость переписки</p>
        <div className="space-y-2">
          {opts.map(o => (
            <button
              key={o.id}
              onClick={() => onSpeed(o.id)}
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ring-1 transition ${
                speed === o.id ? "bg-accent/15 ring-accent/50" : "bg-white/[0.04] ring-white/[0.06]"
              }`}
            >
              <span>
                <span className="block text-[15px] font-medium text-fg">{o.title}</span>
                <span className="block text-[13px] text-faint">{o.hint}</span>
              </span>
              {speed === o.id && <Icon name="check" className="text-accent" />}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 pb-2">
          <button className="btn-secondary" onClick={onExit}>
            Выйти из чата
          </button>
          <button className="btn-primary" onClick={onClose}>
            Готово
          </button>
        </div>
        <p className="pb-2 text-center text-[12px] text-faint">Прогресс сохраняется автоматически</p>
      </div>
    </div>
  );
}
