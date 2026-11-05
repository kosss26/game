/**
 * DSL-парсер сценариев дня (v2, обратно совместим с v1).
 *
 * Заголовок дня
 *   @title Неизвестный номер        название дня
 *   @minutes 15                     оценка длительности
 *   @wait 12h | 30m                 через сколько откроется после предыдущего дня
 *   @recap Текст                    цитата на экране завершения
 *   @teaser Текст                   тизер следующего дня
 *   @push Ася: Ты не спишь?         текст уведомления, когда день откроется
 *   @bg noir                        стиль фона (также [bg noir])
 *   @char asya Ася | color=#e17076 | initials=А | status=в сети
 *
 * Реплики
 *   asya: Привет                    реплика объявленного персонажа
 *   NPC: Привет                     реплика собеседника по умолчанию
 *   ME: Привет                      реплика игрока (заданная)
 *   SYS: 03:12                      системное сообщение по центру
 *   {name}                          подстановка флага в любой текст
 *
 * Темп
 *   ...  |  ... 2s                  индикатор «печатает»
 *   [typing 1500ms]                 время набора следующей реплики
 *   [delay 800ms]                   задержка перед следующей репликой
 *   [pause 30s]                     пауза (реальное время)
 *   [pause 5m Ася не в сети]        пауза со статусом
 *
 * Ветвление
 *   :: label   |  == label ==        метка (также «#tag:label» в конце реплики)
 *   -> label   |  GOTO label         переход
 *   END  |  END ending_id            конец дня (опционально — концовка истории)
 *   IF trust >= 2 -> label          условный переход
 *   [if trust >= 2] asya: Спасибо   условная реплика
 *   SET trust += 1, met = true      изменение флагов
 *
 *   CHOICE: Что ответить?
 *   - Кто ты? -> who [set trust -= 1]
 *   - Я помогу [set trust += 1]     без перехода — продолжение после блока
 *   - (Промолчать) -> silent        в скобках — действие, не отправляется в чат
 *   - Секрет [if knows_secret]      вариант виден только при условии
 *
 *   INPUT name: Как тебя зовут?     ввод текста в флаг name
 *   INPUT: Вопрос -> goto tag [set x=1]   (формат v1)
 */

import type { Character, ChatConfig, Flags, SceneMeta, SceneType, Speaker } from "@/lib/types/database";
import { checkCondition, checkOp } from "@/lib/engine/expressions";

export interface ParsedScene {
  type: SceneType;
  speaker: Speaker | null;
  text: string | null;
  meta: SceneMeta;
  tag: string | null;
  line?: number;
}

export interface ParsedChoice {
  sceneIndex: number;
  label: string;
  gotoTag: string | null;
  setFlags: Flags;
  condition: string | null;
  sortIndex: number;
}

export interface ParsedDayMeta {
  backgroundStyle?: string;
  title?: string;
  minutes?: number;
  waitHours?: number;
  recap?: string;
  teaser?: string;
  push?: string;
  characters: Record<string, Character>;
  chats: Record<string, ChatConfig>;
}

export interface ParseResult {
  scenes: ParsedScene[];
  choices: ParsedChoice[];
  dayMeta: ParsedDayMeta;
  errors: ParseError[];
  warnings: ParseWarning[];
}

export interface ParseError {
  line: number;
  message: string;
  content: string;
}

export interface ParseWarning {
  line: number;
  message: string;
}

export interface ParseOptions {
  /** Персонажи истории (объявленные на уровне истории) */
  characters?: Record<string, Character>;
  /** Чаты истории */
  chats?: Record<string, ChatConfig>;
}

const RE = {
  directive: /^@(\w+)\s*(.*)$/,
  speaker: /^([\p{L}_][\p{L}\p{N}_]*)\s*:\s*(.*)$/u,
  typing: /^\.\.\.(?:\s+(\d+(?:\.\d+)?)\s*(ms|s)?)?$/i,
  pause: /^\[pause\s+(\d+(?:\.\d+)?)\s*(ms|s|m|h)?(?:\s+(.+))?\]$/i,
  delay: /^\[delay\s+(\d+(?:\.\d+)?)\s*(ms|s)?\]$/i,
  typingMeta: /^\[typing\s+(\d+(?:\.\d+)?)\s*(ms|s)?\]$/i,
  background: /^\[bg\s+([\w-]+)\]$/i,
  chat: /^\[chat\s+([\p{L}\p{N}_]+)\]$/iu,
  historyOpen: /^\[history\]$/i,
  historyClose: /^\[\/history\]$/i,
  label: /^(?:::\s*([\p{L}\p{N}_]+)|==\s*([\p{L}\p{N}_]+)\s*==)$/u,
  jump: /^(?:->|GOTO\s+)\s*(?:goto\s+)?([\p{L}\p{N}_]+)$/iu,
  end: /^END(?:\s+([\p{L}\p{N}_]+))?$/iu,
  ifJump: /^IF\s+(.+?)\s*->\s*(?:goto\s+)?([\p{L}\p{N}_]+)$/iu,
  inlineIf: /^\[if\s+(.+?)\]\s*(.+)$/i,
  set: /^(?:SET\s+(.+)|\[set\s+(.+)\])$/i,
  choice: /^CHOICE\s*:\s*(.*)$/i,
  option: /^[-*]\s+(.+)$/,
  inputV2: /^INPUT\s+([\p{L}_][\p{L}\p{N}_]*)\s*:\s*(.+)$/iu,
  inputV1: /^INPUT\s*:\s*(.+?)(?:\s*->\s*(?:goto\s+)?([\p{L}\p{N}_]+))?(?:\s+\[set\s+(.+)\])?$/iu,
  trailingTag: /\s*#tag:([\p{L}\p{N}_]+)\s*$/iu,
};

const RESERVED_SPEAKERS: Record<string, Speaker> = { npc: "npc", me: "me", sys: "system", system: "system" };

function toMs(value: string, unit: string | undefined, defaultUnit: "ms" | "s"): number {
  const n = parseFloat(value);
  const u = (unit || defaultUnit).toLowerCase();
  if (u === "h") return Math.round(n * 3_600_000);
  if (u === "m") return Math.round(n * 60_000);
  if (u === "s") return Math.round(n * 1000);
  return Math.round(n);
}

function parseHours(value: string): number | null {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*(h|ч|m|м|d|д)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = (m[2] || "h").toLowerCase();
  if (u === "m" || u === "м") return n / 60;
  if (u === "d" || u === "д") return n * 24;
  return n;
}

function parseCharacter(rest: string): { id: string; character: Character } | null {
  const parts = rest.split("|").map(s => s.trim());
  const head = parts.shift();
  if (!head) return null;
  const m = head.match(/^([\p{L}_][\p{L}\p{N}_]*)\s+(.+)$/u);
  if (!m) return null;
  const character: Character = { name: m[2].trim() };
  for (const p of parts) {
    const [k, ...v] = p.split("=");
    const value = v.join("=").trim();
    const key = k.trim().toLowerCase();
    if (key === "color") character.color = value;
    else if (key === "initials") character.initials = value;
    else if (key === "status") character.status = value;
    else if (key === "bio") character.bio = value;
  }
  return { id: m[1], character };
}

function parseChat(rest: string): { id: string; chat: ChatConfig } | null {
  const parts = rest.split("|").map(s => s.trim());
  const head = parts.shift();
  if (!head) return null;
  const m = head.match(/^([\p{L}\p{N}_]+)\s+(.+)$/u);
  if (!m) return null;
  const chat: ChatConfig = { name: m[2].trim() };
  for (const p of parts) {
    const [k, ...v] = p.split("=");
    const value = v.join("=").trim();
    const key = k.trim().toLowerCase();
    if (key === "kind") chat.kind = value === "group" ? "group" : "dm";
    else if (key === "character") chat.character = value;
    else if (key === "members") chat.members = value.split(/[,\s]+/).filter(Boolean);
    else if (key === "color") chat.color = value;
    else if (key === "initials") chat.initials = value;
    else if (key === "status") chat.status = value;
  }
  return { id: m[1], chat };
}

/** Разбор "[set a=1, b+=2]" → { a: 1, b: "+=2" } */
export function parseFlagsString(flagsStr: string | undefined): Flags {
  const flags: Flags = {};
  if (!flagsStr) return flags;
  for (const raw of splitOps(flagsStr)) {
    const pair = raw.replace(/^flag:/i, "").trim();
    if (!pair) continue;
    const m = pair.match(/^(!)?\s*([\p{L}_][\p{L}\p{N}_.]*)\s*(?:(\+=|-=|=)\s*(.*))?$/u);
    if (!m) continue;
    const [, neg, key, op, value] = m;
    if (!op) {
      flags[key] = !neg;
    } else if (op === "+=" || op === "-=") {
      flags[key] = `${op}${value.trim()}`;
    } else {
      const v = value.trim();
      if (v === "true" || v === "") flags[key] = true;
      else if (v === "false") flags[key] = false;
      else if (/^-?\d+(\.\d+)?$/.test(v)) flags[key] = parseFloat(v);
      else flags[key] = v.replace(/^["'«](.*)["'»]$/, "$1");
    }
  }
  return flags;
}

function splitOps(s: string): string[] {
  // Разделитель — запятая вне кавычек
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (const ch of s) {
    if (quote) {
      cur += ch;
      if (ch === quote || (quote === "«" && ch === "»")) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "«") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Разбор строки варианта выбора */
function parseOption(body: string): { label: string; gotoTag: string | null; setFlags: Flags; condition: string | null; errors: string[] } {
  let rest = body.trim();
  let setFlags: Flags = {};
  let condition: string | null = null;
  const errors: string[] = [];

  // Извлекаем [set …] и [if …] в любом месте строки
  rest = rest.replace(/\[(set|if)\s+([^\]]+)\]/gi, (_whole, kind: string, body: string) => {
    if (kind.toLowerCase() === "set") {
      for (const op of splitOps(body)) {
        const err = checkOp(op);
        if (err) errors.push(err);
      }
      setFlags = { ...setFlags, ...parseFlagsString(body) };
    } else {
      const err = checkCondition(body);
      if (err) errors.push(err);
      condition = condition ? `(${condition}) && (${body.trim()})` : body.trim();
    }
    return " ";
  }).replace(/\s+/g, " ").trim();

  let gotoTag: string | null = null;
  const g = rest.match(/\s*->\s*(?:goto\s+)?([\p{L}\p{N}_]+)\s*$/iu);
  if (g) {
    gotoTag = g[1];
    rest = rest.slice(0, g.index).trim();
  }

  return { label: rest, gotoTag, setFlags, condition, errors };
}

export function parseScript(script: string, options: ParseOptions = {}): ParseResult {
  const lines = script.replace(/\r\n?/g, "\n").split("\n");
  const scenes: ParsedScene[] = [];
  const choices: ParsedChoice[] = [];
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const dayMeta: ParsedDayMeta = { characters: {}, chats: {} };
  const knownChats = new Set<string>(Object.keys(options.chats || {}));
  let currentThread: string | null = null;
  let inHistory = false;

  const characters = new Map<string, string>(); // lower → id
  for (const id of Object.keys(options.characters || {})) characters.set(id.toLowerCase(), id);

  let pendingDelay: number | null = null;
  let pendingTyping: number | null = null;
  let pendingTags: Array<{ tag: string; line: number }> = [];
  let choiceSceneIndex: number | null = null;
  let choiceSort = 0;

  const err = (line: number, message: string, content: string) => errors.push({ line, message, content });

  const push = (scene: Omit<ParsedScene, "tag">, line: number): number => {
    let tag: string | null = null;
    if (pendingTags.length > 0) {
      // Несколько меток подряд: все, кроме последней, ставим на пустые переходы
      // (jump без цели и условия — «проход насквозь»)
      for (const extra of pendingTags.slice(0, -1)) {
        scenes.push({ type: "jump", speaker: null, text: null, meta: {}, tag: extra.tag, line: extra.line });
      }
      tag = pendingTags[pendingTags.length - 1].tag;
      pendingTags = [];
    }
    if (currentThread) scene.meta = { ...scene.meta, thread: currentThread };
    if (inHistory && (scene.type === "message" || scene.type === "system")) scene.meta = { ...scene.meta, past: true };
    scenes.push({ ...scene, tag, line });
    return scenes.length - 1;
  };

  const resolveSpeaker = (prefix: string): { speaker: Speaker; character: string | null } | null => {
    const lower = prefix.toLowerCase();
    if (RESERVED_SPEAKERS[lower]) return { speaker: RESERVED_SPEAKERS[lower], character: null };
    const id = characters.get(lower);
    if (id) return { speaker: "npc", character: id };
    return null;
  };

  const addMessage = (speaker: Speaker, character: string | null, rawText: string, line: number) => {
    let text = rawText.trim();
    const tagMatch = text.match(RE.trailingTag);
    if (tagMatch) {
      pendingTags.push({ tag: tagMatch[1], line });
      text = text.replace(RE.trailingTag, "").trim();
    }
    const meta: SceneMeta = {};
    if (character) meta.character = character;
    if (pendingDelay) meta.message_delay = pendingDelay;
    if (pendingTyping) meta.typing_delay = pendingTyping;
    pendingDelay = null;
    pendingTyping = null;
    if (!text) {
      warnings.push({ line, message: "Пустая реплика" });
    }
    push({ type: speaker === "system" ? "system" : "message", speaker, text, meta }, line);
  };

  const endChoiceBlock = () => {
    if (choiceSceneIndex !== null && choiceSort === 0) {
      err(scenes[choiceSceneIndex].line || 0, "Блок CHOICE без вариантов", "CHOICE:");
    }
    choiceSceneIndex = null;
    choiceSort = 0;
  };

  /** Обработка одной «обычной» строки. Возвращает false, если строка не распознана. */
  const handleStatement = (line: string, lineNumber: number): boolean => {
    let m: RegExpMatchArray | null;

    if ((m = line.match(RE.ifJump))) {
      const cErr = checkCondition(m[1]);
      if (cErr) err(lineNumber, cErr, line);
      push({ type: "jump", speaker: null, text: null, meta: { condition: m[1].trim(), goto_tag: m[2] } }, lineNumber);
      return true;
    }
    if ((m = line.match(RE.end))) {
      push({ type: "end", speaker: null, text: null, meta: m[1] ? { ending: m[1] } : {} }, lineNumber);
      return true;
    }
    if ((m = line.match(RE.jump))) {
      if (m[1].toUpperCase() === "END") {
        push({ type: "end", speaker: null, text: null, meta: {} }, lineNumber);
      } else {
        push({ type: "jump", speaker: null, text: null, meta: { goto_tag: m[1] } }, lineNumber);
      }
      return true;
    }
    if ((m = line.match(RE.set))) {
      const ops = splitOps(m[1] || m[2]);
      for (const op of ops) {
        const e = checkOp(op);
        if (e) err(lineNumber, e, line);
      }
      push({ type: "set", speaker: null, text: null, meta: { ops } }, lineNumber);
      return true;
    }
    if ((m = line.match(RE.inputV2))) {
      push(
        {
          type: "input",
          speaker: null,
          text: m[2].trim(),
          meta: { input_key: m[1], input_placeholder: m[1] === "name" ? "Ваше имя" : "Ваш ответ…" },
        },
        lineNumber
      );
      return true;
    }
    if ((m = line.match(RE.inputV1))) {
      let prompt = m[1].trim();
      const tagMatch = prompt.match(RE.trailingTag);
      if (tagMatch) {
        pendingTags.push({ tag: tagMatch[1], line: lineNumber });
        prompt = prompt.replace(RE.trailingTag, "").trim();
      }
      push({ type: "input", speaker: null, text: prompt, meta: { input_key: "input", input_placeholder: "Ваш ответ…" } }, lineNumber);
      if (m[3]) {
        push({ type: "set", speaker: null, text: null, meta: { ops: splitOps(m[3]) } }, lineNumber);
      }
      if (m[2]) {
        push({ type: "jump", speaker: null, text: null, meta: { goto_tag: m[2] } }, lineNumber);
      }
      return true;
    }
    if ((m = line.match(RE.speaker))) {
      const who = resolveSpeaker(m[1]);
      if (who) {
        addMessage(who.speaker, who.character, m[2], lineNumber);
        return true;
      }
      // Похоже на реплику, но персонаж не объявлен
      if (/^[\p{Ll}_][\p{L}\p{N}_]*$/u.test(m[1]) || /^[A-Z_]+$/.test(m[1])) {
        err(lineNumber, `Неизвестный персонаж «${m[1]}». Объявите его: @char ${m[1]} Имя`, line);
        return true;
      }
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i].trim();

    if (!line) continue;
    if (line.startsWith("//")) continue;
    if (line.startsWith("#") && !/^#tag:/i.test(line)) continue;

    try {
      let m: RegExpMatchArray | null;

      // Варианты выбора
      if (choiceSceneIndex !== null && (m = line.match(RE.option))) {
        const opt = parseOption(m[1]);
        for (const e of opt.errors) err(lineNumber, e, line);
        if (!opt.label) {
          err(lineNumber, "Пустой текст варианта", line);
          continue;
        }
        choices.push({
          sceneIndex: choiceSceneIndex,
          label: opt.label,
          gotoTag: opt.gotoTag,
          setFlags: opt.setFlags,
          condition: opt.condition,
          sortIndex: choiceSort++,
        });
        continue;
      }
      if (choiceSceneIndex !== null) endChoiceBlock();

      if ((m = line.match(RE.option))) {
        err(lineNumber, "Вариант выбора вне блока CHOICE:", line);
        continue;
      }

      // Директивы заголовка
      if ((m = line.match(RE.directive))) {
        const [, name, value] = m;
        switch (name.toLowerCase()) {
          case "title":
            dayMeta.title = value.trim();
            break;
          case "minutes":
            dayMeta.minutes = parseInt(value, 10) || undefined;
            break;
          case "wait": {
            const h = parseHours(value);
            if (h === null) err(lineNumber, "Формат: @wait 12h или @wait 30m", line);
            else dayMeta.waitHours = h;
            break;
          }
          case "recap":
            dayMeta.recap = value.trim();
            break;
          case "teaser":
            dayMeta.teaser = value.trim();
            break;
          case "push":
            dayMeta.push = value.trim();
            break;
          case "bg":
            dayMeta.backgroundStyle = value.trim().toLowerCase();
            break;
          case "chat": {
            const c = parseChat(value);
            if (!c) err(lineNumber, "Формат: @chat id Название | kind=group | character=id | members=a,b", line);
            else {
              dayMeta.chats[c.id] = c.chat;
              knownChats.add(c.id);
            }
            break;
          }
          case "char": {
            const c = parseCharacter(value);
            if (!c) err(lineNumber, "Формат: @char id Имя | color=#hex", line);
            else {
              dayMeta.characters[c.id] = c.character;
              characters.set(c.id.toLowerCase(), c.id);
            }
            break;
          }
          default:
            warnings.push({ line: lineNumber, message: `Неизвестная директива @${name}` });
        }
        continue;
      }

      if ((m = line.match(RE.chat))) {
        if (!knownChats.has(m[1])) err(lineNumber, `Неизвестный чат «${m[1]}». Объявите его: @chat ${m[1]} Название`, line);
        currentThread = m[1];
        continue;
      }
      if (RE.historyOpen.test(line)) {
        inHistory = true;
        continue;
      }
      if (RE.historyClose.test(line)) {
        inHistory = false;
        continue;
      }
      if ((m = line.match(RE.background))) {
        dayMeta.backgroundStyle = m[1].toLowerCase();
        continue;
      }
      if ((m = line.match(RE.delay))) {
        pendingDelay = toMs(m[1], m[2], "ms");
        continue;
      }
      if ((m = line.match(RE.typingMeta))) {
        pendingTyping = toMs(m[1], m[2], "ms");
        continue;
      }
      if ((m = line.match(RE.typing))) {
        const ms = m[1] ? toMs(m[1], m[2], "s") : pendingTyping || 1200;
        pendingTyping = null;
        push({ type: "typing", speaker: null, text: null, meta: { typing_delay: ms } }, lineNumber);
        continue;
      }
      if ((m = line.match(RE.pause))) {
        const meta: SceneMeta = { pause_duration: toMs(m[1], m[2], "s") };
        if (m[3]) meta.pause_label = m[3].trim();
        push({ type: "pause", speaker: null, text: null, meta }, lineNumber);
        continue;
      }
      if ((m = line.match(RE.label))) {
        pendingTags.push({ tag: m[1] || m[2], line: lineNumber });
        continue;
      }
      if (/^#tag:/i.test(line)) {
        const t = line.match(/^#tag:([\p{L}\p{N}_]+)$/iu);
        if (t) pendingTags.push({ tag: t[1], line: lineNumber });
        continue;
      }
      if ((m = line.match(RE.choice))) {
        const prompt = m[1].trim();
        choiceSceneIndex = push(
          { type: "choice", speaker: null, text: prompt || null, meta: prompt ? { prompt } : {} },
          lineNumber
        );
        choiceSort = 0;
        continue;
      }
      if ((m = line.match(RE.inlineIf))) {
        const cond = m[1].trim();
        const cErr = checkCondition(cond);
        if (cErr) err(lineNumber, cErr, line);
        const jumpIdx = push({ type: "jump", speaker: null, text: null, meta: { condition: `!(${cond})` } }, lineNumber);
        const before = scenes.length;
        if (!handleStatement(m[2].trim(), lineNumber)) {
          err(lineNumber, "После [if …] ожидается реплика или команда", line);
        }
        scenes[jumpIdx].meta.skip = scenes.length - before;
        continue;
      }

      if (handleStatement(line, lineNumber)) continue;

      warnings.push({
        line: lineNumber,
        message: `Непонятная строка, проигнорирована: "${line.substring(0, 60)}"`,
      });
    } catch (e) {
      err(lineNumber, e instanceof Error ? e.message : "Неизвестная ошибка", line);
    }
  }
  if (choiceSceneIndex !== null) endChoiceBlock();

  // Висящие метки в конце файла → конец дня
  if (pendingTags.length > 0) {
    push({ type: "end", speaker: null, text: null, meta: {} }, lines.length);
  }

  // Проверка меток
  const tagLines = new Map<string, number>();
  for (const s of scenes) {
    if (!s.tag) continue;
    if (tagLines.has(s.tag)) {
      err(s.line || 0, `Метка «${s.tag}» объявлена дважды (строки ${tagLines.get(s.tag)} и ${s.line})`, s.tag);
    } else {
      tagLines.set(s.tag, s.line || 0);
    }
  }
  for (const c of choices) {
    if (c.gotoTag && !tagLines.has(c.gotoTag)) {
      err(scenes[c.sceneIndex].line || 0, `Метка «${c.gotoTag}» не найдена`, `Выбор: "${c.label}"`);
    }
  }
  for (const s of scenes) {
    if (s.type === "jump" && s.meta.goto_tag && !tagLines.has(s.meta.goto_tag)) {
      err(s.line || 0, `Метка «${s.meta.goto_tag}» не найдена`, `-> ${s.meta.goto_tag}`);
    }
  }

  return { scenes, choices, dayMeta, errors, warnings };
}

/**
 * Дополнительная проверка структуры
 */
export function validateScript(result: ParseResult): ParseError[] {
  const errors: ParseError[] = [];

  if (result.scenes.filter(s => s.type !== "jump" && s.type !== "set").length === 0) {
    errors.push({ line: 0, message: "Скрипт пустой или не содержит распознанных сцен", content: "" });
    return errors;
  }

  for (let i = 0; i < result.scenes.length; i++) {
    const scene = result.scenes[i];
    if (scene.type === "choice") {
      const count = result.choices.filter(c => c.sceneIndex === i).length;
      if (count === 0) {
        errors.push({ line: scene.line || 0, message: `Сцена выбора #${i + 1} не имеет вариантов ответа`, content: scene.text || "" });
      }
    }
  }
  return errors;
}

export interface DbSceneInput {
  type: SceneType;
  speaker?: Speaker | null;
  text?: string;
  meta?: SceneMeta | null;
  tag?: string;
}

export interface DbChoiceInput {
  scene_index: number;
  label: string;
  goto_tag?: string;
  set_flags?: Flags;
  condition?: string;
  sort_index: number;
}

export function convertToDbFormat(result: ParseResult): { scenes: DbSceneInput[]; choices: DbChoiceInput[] } {
  return {
    scenes: result.scenes.map(s => ({
      type: s.type,
      speaker: s.speaker,
      text: s.text ?? undefined,
      meta: s.meta,
      tag: s.tag || undefined,
    })),
    choices: result.choices.map(c => ({
      scene_index: c.sceneIndex,
      label: c.label,
      goto_tag: c.gotoTag || undefined,
      set_flags: Object.keys(c.setFlags).length > 0 ? c.setFlags : undefined,
      condition: c.condition || undefined,
      sort_index: c.sortIndex,
    })),
  };
}
