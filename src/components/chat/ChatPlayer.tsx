"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Character, ChatConfig, Flags, HistoryEntry, ProgressState, SnapshotChoice, SnapshotData, SnapshotScene, StoryMeta } from "@/lib/types/database";
import { applyChoice, applyInput, buildRuntime, isActionChoice, nextAfter, resolve, stripAction, type Step } from "@/lib/engine/runtime";
import { saveProgress, recordChoice, completeDay } from "@/lib/actions/player";
import { useApp, useBackButton, type Speed } from "@/lib/telegram/TelegramProvider";
import { MessageList, TypingBubble, DayDivider, previewText } from "./Messages";
import { ThreadTabs, ClueSheet, Toast, MeterBar, type ToastData } from "./ChatChrome";
import { ChoicePanel, InputPanel, PausePanel, IdleComposer } from "./Composer";
import { SaveQueue } from "@/lib/game/save-queue";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

export interface ChatPlayerProps {
  storyId: string;
  dayId: string;
  dayNumber: number;
  dayTitle: string;
  version: number;
  progressId?: string;
  snapshot: SnapshotData;
  characters: Record<string, Character>;
  mainCharacter?: string;
  storyMeta?: StoryMeta;
  initial: {
    history: HistoryEntry[];
    flags: Flags;
    pointer: string | null;
    state: ProgressState;
    completed: boolean;
  } | null;
  inheritedFlags: Flags;
  preview?: boolean;
  /** Последняя глава истории: кнопка «К финалу» вместо «Завершить главу» */
  isLastDay?: boolean;
  onExit: () => void;
  onComplete: (result: { history: HistoryEntry[]; flags: Flags; ending: string | null }) => void;
}

type ChoiceStep = Extract<Step, { kind: "choice" }>;
type InputStep = Extract<Step, { kind: "input" }>;

type Ui =
  | { kind: "running" }
  | { kind: "typing"; who: string; thread: string }
  | { kind: "choice"; step: ChoiceStep }
  | { kind: "input"; step: InputStep }
  | { kind: "pause"; sceneId: string; until: number; total: number; label: string }
  | { kind: "ended" };

const SPEED: Record<Speed, number> = { normal: 1, fast: 0.45, instant: 0 };
const MAIN = "main";

const threadOf = (scene: SnapshotScene | undefined | null) => scene?.meta?.thread || MAIN;

export function foundClues(flags: Flags, meta?: StoryMeta): string[] {
  return Object.keys(meta?.clues || {}).filter(id => {
    const v = flags[`clue_${id}`];
    return v !== undefined && v !== false && v !== 0 && v !== "";
  });
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export function ChatPlayer(props: ChatPlayerProps) {
  const { storyId, dayId, dayNumber, dayTitle, version, snapshot, characters, preview, onExit, onComplete } = props;
  const { token, haptic, speed, setSpeed, timers, setTimers, webApp } = useApp();
  const checkpointKey = !preview && props.progressId ? `pl_checkpoint:${props.progressId}:${version}` : null;
  const [initial] = useState(() => {
    if (!checkpointKey || props.initial?.completed) return props.initial;
    try {
      const local = JSON.parse(localStorage.getItem(checkpointKey) || "null");
      if (local && Array.isArray(local.history) && local.history.length >= (props.initial?.history.length || 0)
        && local.flags && (local.pointer === null || snapshot.scenes.some(s => s.id === local.pointer))) return local as NonNullable<ChatPlayerProps["initial"]>;
    } catch { /* storage may be unavailable */ }
    return props.initial;
  });
  const [saveFailed, setSaveFailed] = useState(false);
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

  // --- чаты ---
  const chats = useMemo<Record<string, ChatConfig>>(
    () => ({ ...(props.storyMeta?.chats || {}), ...(snapshot.day.meta?.chats || {}) }),
    [props.storyMeta?.chats, snapshot.day.meta?.chats]
  );
  const threaded = Object.keys(chats).length > 0;
  const getChat = useCallback(
    (id: string): ChatConfig =>
      chats[id] || { name: allCharacters[defaultCharacter]?.name || "Собеседник", kind: "dm", character: defaultCharacter },
    [chats, allCharacters, defaultCharacter]
  );

  // --- состояние ---
  const [log, setLog] = useState<HistoryEntry[]>(() => initial?.history || []);
  const [ui, setUi] = useState<Ui>({ kind: "running" });
  const [showSettings, setShowSettings] = useState(false);
  const [endReady, setEndReady] = useState(false);
  const endResult = useRef<{ history: HistoryEntry[]; flags: Flags; ending: string | null } | null>(null);
  const [showClues, setShowClues] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [activeThread, setActiveThread] = useState<string>(() => {
    const h = initial?.history || [];
    if (h.length) return h[h.length - 1].thread || MAIN;
    return threadOf(rt.scenes[0]);
  });
  // Чат, который открыт у игрока. Сюжет может уйти в другой чат — тогда
  // там появляется счётчик и уведомление, но экран сам не переключается.
  const [view, setView] = useState<string>(activeThread);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const viewRef = useRef(view);
  viewRef.current = view;
  const [clueIds, setClueIds] = useState<string[]>(() => foundClues(initial?.flags || props.inheritedFlags, props.storyMeta));
  const clueRef = useRef(clueIds);
  const [hudFlags, setHudFlags] = useState<Flags>(() => initial?.flags || props.inheritedFlags);
  const animateFrom = useRef(initial?.history.length || 0);

  const logRef = useRef<HistoryEntry[]>(log);
  const flagsRef = useRef<Flags>(initial?.flags || props.inheritedFlags);
  const pointerRef = useRef<string | null>(initial?.pointer ?? rt.firstSceneId);
  const pauseRef = useRef<ProgressState>({});
  const lastSpeaker = useRef<string>(defaultCharacter);
  const runId = useRef(0);
  const speedRef = useRef(SPEED[speed]);
  const finished = useRef(false);
  speedRef.current = SPEED[speed];

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // --- сохранение ---
  type Checkpoint = { history: HistoryEntry[]; flags: Flags; pointer: string | null; state: ProgressState; completed: boolean; ending?: string | null };
  const [queue] = useState(() => new SaveQueue<Checkpoint>(async value => {
    const input = { progressId: props.progressId, storyId, dayId, sceneId: value.pointer, flags: value.flags, history: value.history, state: value.state, version, ending: value.ending };
    const result = value.completed ? await completeDay(token, input) : await saveProgress(token, input);
    if (result.ok) {
      if (value.completed) setEndReady(true);
      try { if (checkpointKey && localStorage.getItem(checkpointKey) === JSON.stringify(value)) localStorage.removeItem(checkpointKey); } catch {}
    }
    return result.ok;
  }, ok => setSaveFailed(!ok)));
  const remember = useCallback((value: Checkpoint) => {
    try { if (checkpointKey) localStorage.setItem(checkpointKey, JSON.stringify(value)); } catch { /* server saving remains available */ }
  }, [checkpointKey]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNow = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (preview || finished.current) return;
    const value: Checkpoint = { pointer: pointerRef.current, flags: flagsRef.current, history: logRef.current, state: pauseRef.current, completed: false };
    remember(value);
    queue.push(value);
  }, [preview, queue, remember]);
  useEffect(() => {
    const retry = () => { void queue.flush(); };
    const interval = setInterval(retry, 5000);
    window.addEventListener("online", retry);
    return () => { clearInterval(interval); window.removeEventListener("online", retry); };
  }, [queue]);

  const scheduleSave = useCallback(() => {
    if (preview) return;
    remember({ pointer: pointerRef.current, flags: flagsRef.current, history: logRef.current, state: pauseRef.current, completed: false });
    if (saveTimer.current) return;
    saveTimer.current = setTimeout(saveNow, 3000);
  }, [preview, saveNow, remember]);

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

  const append = useCallback(
    (entry: HistoryEntry) => {
      logRef.current = [...logRef.current, entry];
      setLog(logRef.current);
      const t = entry.thread || MAIN;
      if (threaded && t !== viewRef.current && !entry.hidden) {
        setUnread(u => ({ ...u, [t]: (u[t] || 0) + 1 }));
        if (entry.kind !== "system") {
          const who = entry.speaker === "me" ? "Вы" : allCharacters[entry.character || defaultCharacter]?.name || "";
          setToast({ id: entry.id + entry.at, kind: "message", thread: t, title: getChat(t).name, text: `${getChat(t).kind === "group" && who ? `${who}: ` : ""}${previewText(entry.text)}` });
        }
      }
    },
    [threaded, allCharacters, defaultCharacter, getChat]
  );

  /** Новые улики → тост */
  const syncClues = useCallback(
    (flags: Flags) => {
      if (props.storyMeta?.meters) setHudFlags(flags);
      const now = foundClues(flags, props.storyMeta);
      const fresh = now.filter(id => !clueRef.current.includes(id));
      if (now.length !== clueRef.current.length) {
        clueRef.current = now;
        setClueIds(now);
      }
      if (fresh.length) {
        haptic("success");
        const c = props.storyMeta?.clues?.[fresh[fresh.length - 1]];
        setToast({ id: `clue:${fresh.join(",")}`, kind: "clue", title: fresh.length > 1 ? `Новые улики · ${fresh.length}` : "Новая улика", text: c?.title || "" });
      }
    },
    [props.storyMeta, haptic]
  );

  // --- завершение ---
  const finish = useCallback(
    async (ending: string | null) => {
      if (finished.current) return;
      finished.current = true;
      setUi({ kind: "ended" });
      haptic("success");
      if (!preview) {
        const value: Checkpoint = { pointer: null, flags: flagsRef.current, history: logRef.current, state: {}, completed: true, ending };
        remember(value);
        queue.push(value);
        // A failed completion stays queued and must be confirmed before leaving.
        await queue.flush();

      }
      // Не закрываем чат сам: игрок дочитывает и нажимает «Завершить главу»
      endResult.current = { history: logRef.current, flags: flagsRef.current, ending };
      if (preview) setEndReady(true);
    },
    [haptic, preview, queue, remember]
  );

  const closeChapter = useCallback(() => {
    if (!endResult.current || saveFailed) return;
    haptic("select");
    onComplete(endResult.current);
  }, [haptic, onComplete, saveFailed]);

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
        syncClues(r.flags);
        const step = r.step;
        const sp = speedRef.current;
        const thread = step.kind === "end" ? null : threadOf(step.scene);
        if (thread) setActiveThread(thread);

        if (step.kind === "message") {
          const isNpc = step.scene.type === "message" && step.scene.speaker === "npc";
          const who = step.scene.meta?.character || defaultCharacter;
          if (step.delayMs) await sleep(step.delayMs * sp);
          if (!alive()) return;
          const isBot = !!allCharacters[who]?.bot;
          if (isNpc && !isBot && step.typingMs > 0 && sp > 0) {
            lastSpeaker.current = who;
            setUi({ kind: "typing", who, thread: thread || MAIN });
            await sleep(step.typingMs * sp);
          } else {
            await sleep(sp === 0 || step.scene.meta?.past ? 30 : step.scene.speaker === "me" ? 500 * sp : isBot ? 900 * sp : 350 * sp);
          }
          if (!alive()) return;
          append({
            id: step.scene.id,
            kind: step.scene.type === "system" ? "system" : "message",
            speaker: step.scene.type === "system" ? "system" : step.scene.speaker || "npc",
            character: isNpc ? who : null,
            text: step.text,
            at: Date.now(),
            ...(thread && thread !== MAIN ? { thread } : {}),
            ...(step.scene.meta?.past ? { past: true } : {}),
          });
          if (isNpc && !step.scene.meta?.past) haptic("light");
          pointer = nextAfter(rt, step.scene.id);
          pointerRef.current = pointer;
          setUi({ kind: "running" });
          scheduleSave();
          await sleep(sp === 0 || step.scene.meta?.past ? 20 : 260 * sp);
          continue;
        }

        if (step.kind === "typing") {
          if (sp > 0) {
            setUi({ kind: "typing", who: lastSpeaker.current, thread: thread || MAIN });
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
    [rt, defaultCharacter, append, haptic, scheduleSave, saveNow, finish, allCharacters, syncClues]
  );

  // --- старт / восстановление ---
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const init = initial;
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
      finish((init as typeof init & { ending?: string | null }).ending || null);
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
    async (option: SnapshotChoice & { text: string }, timedOut?: boolean) => {
      if (ui.kind !== "choice") return;
      const sceneId = ui.step.scene.id;
      haptic(timedOut ? "warning" : "medium");
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
        ...(threadOf(ui.step.scene) !== MAIN ? { thread: threadOf(ui.step.scene) } : {}),
      });
      if (!preview) recordChoice(token, { storyId, dayId, sceneId, choiceId: option.id }).catch(() => undefined);
      const res = applyChoice(rt, sceneId, option, flagsRef.current);
      flagsRef.current = res.flags;
      syncClues(res.flags);
      pointerRef.current = res.pointer;
      scheduleSave();
      run(res.pointer);
    },
    [ui, haptic, append, preview, token, storyId, dayId, rt, scheduleSave, run, syncClues]
  );

  const onInput = useCallback(
    (value: string) => {
      if (ui.kind !== "input") return;
      const step = ui.step;
      haptic("light");
      setUi({ kind: "running" });
      append({
        id: `input:${step.scene.id}`,
        kind: "reply",
        speaker: "me",
        text: value,
        at: Date.now(),
        ...(threadOf(step.scene) !== MAIN ? { thread: threadOf(step.scene) } : {}),
      });
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
    const smooth = speedRef.current > 0 && log.length - animateFrom.current > 0;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    // после отрисовки и анимаций — ещё раз, без анимации
    const t = setTimeout(() => {
      if (stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    }, smooth ? 380 : 40);
    return () => clearTimeout(t);
  }, [log, ui, view]);

  // Высота ленты меняется (панель выбора, клавиатура) — держимся у последнего сообщения
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  // Переключение чата: в конец ленты, сбросить непрочитанные
  useEffect(() => {
    stickToBottom.current = true;
    const toBottom = () => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    };
    toBottom();
    const raf = requestAnimationFrame(toBottom);
    const t = setTimeout(toBottom, 120);
    setUnread(u => (u[view] ? { ...u, [view]: 0 } : u));
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [view]);

  const openThread = useCallback(
    (t: string) => {
      haptic("select");
      setView(t);
      setToast(null);
    },
    [haptic]
  );

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
  const chat = threaded ? getChat(view) : null;
  const isGroup = chat?.kind === "group";
  const headerId = threaded ? (isGroup ? `chat:${view}` : chat?.character || defaultCharacter) : defaultCharacter;
  const headerChar: Character | undefined = threaded
    ? isGroup
      ? { name: chat!.name, color: chat!.color || "#6b7a99", initials: chat!.initials || chat!.name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1) }
      : allCharacters[chat?.character || defaultCharacter]
    : allCharacters[defaultCharacter];
  const title = threaded ? chat!.name : allCharacters[defaultCharacter]?.name || "Собеседник";
  const typingHere = ui.kind === "typing" && (!threaded || ui.thread === view);
  const pauseHere = ui.kind === "pause";
  const viewMultiParty = threaded ? isGroup : multiParty;
  const status = typingHere
    ? viewMultiParty
      ? `${allCharacters[(ui as { who: string }).who]?.name || "Собеседник"} печатает…`
      : "печатает…"
    : pauseHere
      ? ui.label
      : ui.kind === "ended"
        ? isGroup
          ? "все не в сети"
          : "был(а) только что"
        : isGroup
          ? `${(chat?.members?.length || 0) + 1} участников`
          : chat?.status || headerChar?.status || "в сети";
  const online = !isGroup && ui.kind !== "pause" && ui.kind !== "ended" && !/^был/i.test(status);

  const threadLog = useMemo(
    () => (threaded ? log.filter(e => (e.thread || MAIN) === view) : log),
    [log, threaded, view]
  );
  const visibleLog = useMemo(() => threadLog.filter(e => !e.hidden), [threadLog]);
  const visibleAnimateFrom = useMemo(() => {
    const cut = new Set(log.slice(0, animateFrom.current).map(e => e));
    return visibleLog.filter(e => cut.has(e)).length;
  }, [log, visibleLog]);

  const threadsSeen = useMemo(() => {
    if (!threaded) return [];
    const order: string[] = [];
    for (const e of log) {
      const t = e.thread || MAIN;
      if (!order.includes(t)) order.push(t);
    }
    if (!order.includes(activeThread)) order.push(activeThread);
    return order;
  }, [log, threaded, activeThread]);

  const lastByThread = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of log) if (!e.hidden) m[e.thread || MAIN] = previewText(e.text);
    return m;
  }, [log]);

  const hasClues = Object.keys(props.storyMeta?.clues || {}).length > 0;
  // Куда звать игрока из чата, который он сейчас читает: туда, где ждут ответа
  // или идёт переписка, иначе — в последний чат с непрочитанными.
  const busyThere = ui.kind === "choice" || ui.kind === "input" || ui.kind === "pause" || (ui.kind === "typing" && ui.thread === activeThread);
  const lastUnread = useMemo(() => {
    for (let i = log.length - 1; i >= 0; i--) {
      const t = log[i].thread || MAIN;
      if (t !== view && (unread[t] || 0) > 0) return t;
    }
    return null;
  }, [log, unread, view]);
  const target = !threaded
    ? null
    : activeThread !== view && (busyThere || (unread[activeThread] || 0) > 0)
      ? activeThread
      : lastUnread;
  const waitingElsewhere = ui.kind !== "ended" && !!target && (view !== activeThread || ui.kind === "running" || ui.kind === "typing");
  const elsewhereLabel =
    target === activeThread && (ui.kind === "choice" || ui.kind === "input")
      ? "Ответить"
      : target === activeThread && ui.kind === "pause"
        ? "Вернуться"
        : "Новые сообщения";

  return (
    <div className="chat-bg px-safe relative flex h-[100dvh] flex-col overflow-hidden">
      {saveFailed && <div role="alert" className="relative z-30 bg-raised px-4 py-3 text-sm text-fg">Не удалось сохранить прогресс. Проверьте связь. <button className="underline" onClick={() => void queue.flush()}>Повторить</button></div>}
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
          <Avatar key={`av:${headerId}`} id={headerId} character={headerChar} size={40} online={threaded && isGroup ? undefined : online} className="animate-fade-in" />
          <div key={`title:${view}`} className="min-w-0 flex-1 pl-1 animate-fade-in">
            <p className="truncate text-[16px] font-semibold leading-tight text-fg">{title}</p>
            <p className={`truncate text-[13px] leading-tight ${typingHere ? "text-accent" : online ? "text-ok/90" : "text-faint"}`}>{status}</p>
          </div>
          {preview && <span className="chip bg-warn/15 text-warn">предпросмотр</span>}
          {hasClues && (
            <button
              onClick={() => setShowClues(true)}
              className="relative flex h-10 items-center gap-1 rounded-full bg-white/[0.06] px-3 text-[13px] font-semibold text-fg/85 active:scale-95"
              aria-label="Улики"
            >
              <Icon name="search" size={16} />
              {clueIds.length}
            </button>
          )}
          <button onClick={() => setShowSettings(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted active:bg-white/5" aria-label="Настройки">
            <Icon name="more" size={26} strokeWidth={3} />
          </button>
        </div>
        {props.storyMeta?.meters && <MeterBar meters={props.storyMeta.meters} flags={hudFlags} />}
        {threaded && threadsSeen.length > 1 && (
          <ThreadTabs
            threads={threadsSeen}
            view={view}
            active={activeThread}
            unread={unread}
            typingThread={ui.kind === "typing" ? ui.thread : null}
            getChat={getChat}
            characters={allCharacters}
            last={lastByThread}
            onOpen={openThread}
          />
        )}
      </header>

      {/* Лента */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      {toast && (
        <Toast
          data={toast}
          onClose={() => setToast(null)}
          onOpen={toast.kind === "message" && toast.thread ? () => openThread(toast.thread!) : () => setShowClues(true)}
        />
      )}
      <div ref={scrollRef} onScroll={onScroll} className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-3 pb-2 pt-1">
        <div>
        <DayDivider label={`Глава ${dayNumber} · ${dayTitle}`} />
        <MessageList
          entries={visibleLog}
          characters={allCharacters}
          multiParty={viewMultiParty}
          defaultCharacter={threaded && !isGroup ? chat?.character || defaultCharacter : defaultCharacter}
          animateFrom={visibleAnimateFrom}
        />
        {typingHere && ui.kind === "typing" && <TypingBubble characterId={ui.who} character={allCharacters[ui.who]} multiParty={viewMultiParty} />}
        {ui.kind === "ended" && (
          <div className="flex justify-center py-4 animate-fade-in">
            <span className="text-[12px] uppercase tracking-[0.2em] text-faint">— конец главы —</span>
          </div>
        )}
        <div className="h-2" />
        </div>
      </div>
      </div>

      {/* Нижняя панель */}
      <div className="glass relative z-20 border-t border-white/[0.06] pb-safe">
        {waitingElsewhere ? (
          <div className="px-3 pb-3 pt-2">
            <button onClick={() => openThread(target!)} className="btn-primary w-full">
              {elsewhereLabel} в «{getChat(target!).name}»
              {(unread[target!] || 0) > 0 && <span className="ml-1.5 rounded-full bg-white/25 px-1.5 text-[12px]">{unread[target!]}</span>}
            </button>
          </div>
        ) : (
          <>
            {ui.kind === "choice" && (
              <ChoicePanel
                key={ui.step.scene.id}
                prompt={ui.step.prompt}
                options={ui.step.options}
                onSelect={onChoice}
                timerMs={timers && !preview ? ui.step.timerMs : null}
                defaultId={ui.step.defaultId}
                onTick={() => haptic("rigid")}
              />
            )}
            {ui.kind === "input" && <InputPanel key={ui.step.scene.id} prompt={ui.step.prompt} placeholder={ui.step.placeholder} onSubmit={onInput} />}
            {ui.kind === "pause" && <PausePanel until={ui.until} total={ui.total} label={ui.label} onSkip={endPause} />}
            {(ui.kind === "running" || ui.kind === "typing") && <IdleComposer text={typingHere ? status : "Сообщение"} />}
            {ui.kind === "ended" && (
              <div className="px-3 pb-3 pt-2.5 animate-fade-in">
                <button onClick={closeChapter} disabled={!endReady} className="btn-primary min-h-[52px] w-full text-[16px]">
                  <Icon name="check" size={18} strokeWidth={2.4} />
                  {endReady ? (props.isLastDay ? "Завершить историю" : "Завершить главу") : "Сохраняем…"}
                </button>
                <p className="mt-1.5 text-center text-[12px] text-faint">Можно спокойно дочитать и пролистать чаты</p>
              </div>
            )}
          </>
        )}
      </div>

      {showSettings && (
        <SettingsSheet speed={speed} onSpeed={setSpeed} timers={timers} onTimers={setTimers} onClose={() => setShowSettings(false)} onExit={onExit} />
      )}
      {showClues && <ClueSheet meta={props.storyMeta} found={clueIds} onClose={() => setShowClues(false)} />}
    </div>
  );
}

function SettingsSheet({
  speed,
  onSpeed,
  timers,
  onTimers,
  onClose,
  onExit,
}: {
  speed: Speed;
  onSpeed: (s: Speed) => void;
  timers: boolean;
  onTimers: (v: boolean) => void;
  onClose: () => void;
  onExit: () => void;
}) {
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
        <button
          onClick={() => onTimers(!timers)}
          className="mt-3 flex w-full items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 text-left ring-1 ring-white/[0.06]"
        >
          <span>
            <span className="block text-[15px] font-medium text-fg">Выборы на время</span>
            <span className="block text-[13px] text-faint">{timers ? "Включены — в напряжённых сценах надо успеть ответить" : "Выключены — можно думать сколько угодно"}</span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${timers ? "bg-accent" : "bg-white/15"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${timers ? "left-6" : "left-1"}`} />
          </span>
        </button>
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
