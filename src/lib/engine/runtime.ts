/**
 * Чистый (без React и I/O) рантайм дня: обход сцен снапшота.
 * Используется плеером на клиенте и тестами.
 */

import type { Flags, SnapshotChoice, SnapshotData, SnapshotScene } from "@/lib/types/database";
import { applyChoiceFlags, applyOps, evaluateCondition, interpolate } from "./expressions";

export interface Runtime {
  scenes: SnapshotScene[];
  indexById: Map<string, number>;
  indexByTag: Map<string, number>;
  choices: Map<string, SnapshotChoice[]>;
  firstSceneId: string | null;
}

export function buildRuntime(snapshot: SnapshotData): Runtime {
  const scenes = [...snapshot.scenes].sort((a, b) => a.sort_index - b.sort_index);
  const indexById = new Map<string, number>();
  const indexByTag = new Map<string, number>();
  scenes.forEach((s, i) => {
    indexById.set(s.id, i);
    if (s.tag && !indexByTag.has(s.tag)) indexByTag.set(s.tag, i);
  });
  const choices = new Map<string, SnapshotChoice[]>();
  for (const c of snapshot.choices) {
    const list = choices.get(c.scene_id) || [];
    list.push(c);
    choices.set(c.scene_id, list);
  }
  for (const list of choices.values()) list.sort((a, b) => a.sort_index - b.sort_index);
  return { scenes, indexById, indexByTag, choices, firstSceneId: scenes[0]?.id ?? null };
}

export type Step =
  | { kind: "message"; scene: SnapshotScene; text: string; typingMs: number; delayMs: number }
  | { kind: "typing"; scene: SnapshotScene; ms: number }
  | { kind: "pause"; scene: SnapshotScene; ms: number; label: string | null }
  | { kind: "choice"; scene: SnapshotScene; prompt: string | null; options: Array<SnapshotChoice & { text: string }> }
  | { kind: "input"; scene: SnapshotScene; prompt: string; key: string; placeholder: string }
  | { kind: "end"; ending: string | null };

export interface Resolved {
  step: Step;
  /** id отображаемой сцены (null для конца дня) */
  pointer: string | null;
  flags: Flags;
}

const MAX_HOPS = 5000;

function idAt(rt: Runtime, index: number): string | null {
  return rt.scenes[index]?.id ?? null;
}

function targetIndex(rt: Runtime, tag: string | null | undefined, sceneId?: string | null): number | null {
  if (tag && rt.indexByTag.has(tag)) return rt.indexByTag.get(tag)!;
  if (sceneId && rt.indexById.has(sceneId)) return rt.indexById.get(sceneId)!;
  return null;
}

/** Реалистичное время набора текста */
export function typingTimeFor(text: string): number {
  const len = text.length;
  return Math.max(700, Math.min(3400, 450 + len * 30));
}

/** Вариант выбора — действие (не отправляется как сообщение) */
export function isActionChoice(label: string): boolean {
  const t = label.trim();
  return (t.startsWith("(") && t.endsWith(")")) || (t.startsWith("*") && t.endsWith("*"));
}

export function stripAction(label: string): string {
  const t = label.trim();
  return isActionChoice(t) ? t.slice(1, -1).trim() : t;
}

/**
 * Начиная со сцены pointer, пропускает служебные сцены (jump/set),
 * применяя флаги, и возвращает следующий шаг для отображения.
 */
export function resolve(rt: Runtime, pointer: string | null, flagsIn: Flags): Resolved {
  let flags = flagsIn;
  let index = pointer ? rt.indexById.get(pointer) ?? -1 : -1;

  for (let hops = 0; hops < MAX_HOPS; hops++) {
    if (index < 0 || index >= rt.scenes.length) {
      return { step: { kind: "end", ending: null }, pointer: null, flags };
    }
    const scene = rt.scenes[index];
    const meta = scene.meta || {};

    switch (scene.type) {
      case "set":
        flags = applyOps(flags, meta.ops);
        index++;
        continue;

      case "jump": {
        const ok = evaluateCondition(meta.condition, flags);
        if (!ok) {
          index++;
          continue;
        }
        if (meta.goto_tag || scene.next_scene_id) {
          const t = targetIndex(rt, meta.goto_tag, scene.next_scene_id);
          index = t ?? rt.scenes.length; // битая ссылка = конец дня
        } else {
          index += 1 + (meta.skip || 0);
        }
        continue;
      }

      case "end":
        return { step: { kind: "end", ending: meta.ending || null }, pointer: null, flags };

      case "message":
      case "system": {
        const text = interpolate(scene.text || "", flags);
        const typingMs =
          scene.type === "system" || scene.speaker === "me" || meta.past
            ? 0
            : meta.typing_delay ?? typingTimeFor(text);
        return {
          step: { kind: "message", scene, text, typingMs, delayMs: meta.message_delay ?? 0 },
          pointer: scene.id,
          flags,
        };
      }

      case "typing":
        return { step: { kind: "typing", scene, ms: meta.typing_delay ?? 1200 }, pointer: scene.id, flags };

      case "pause":
        return {
          step: { kind: "pause", scene, ms: meta.pause_duration ?? 10_000, label: meta.pause_label ? interpolate(meta.pause_label, flags) : null },
          pointer: scene.id,
          flags,
        };

      case "choice": {
        const options = (rt.choices.get(scene.id) || [])
          .filter(c => evaluateCondition(c.condition, flags))
          .map(c => ({ ...c, text: interpolate(c.label, flags) }));
        if (options.length === 0) {
          index++;
          continue;
        }
        return {
          step: { kind: "choice", scene, prompt: scene.meta?.prompt ? interpolate(scene.meta.prompt, flags) : null, options },
          pointer: scene.id,
          flags,
        };
      }

      case "input":
        return {
          step: {
            kind: "input",
            scene,
            prompt: interpolate(scene.text || "", flags),
            key: meta.input_key || "input",
            placeholder: meta.input_placeholder || "Ваш ответ…",
          },
          pointer: scene.id,
          flags,
        };

      default:
        index++;
    }
  }
  // Защита от бесконечного цикла в сценарии
  return { step: { kind: "end", ending: null }, pointer: null, flags };
}

/** Сцена, следующая по порядку */
export function nextAfter(rt: Runtime, sceneId: string): string | null {
  const i = rt.indexById.get(sceneId);
  if (i === undefined) return null;
  return idAt(rt, i + 1);
}

/** Применение выбора: новые флаги и указатель на следующую сцену */
export function applyChoice(
  rt: Runtime,
  choiceSceneId: string,
  choice: SnapshotChoice,
  flags: Flags
): { pointer: string | null; flags: Flags } {
  const nextFlags = applyChoiceFlags(flags, choice.set_flags);
  const t = targetIndex(rt, choice.goto_tag, choice.goto_scene_id);
  if (choice.goto_tag || choice.goto_scene_id) {
    return { pointer: t === null ? null : idAt(rt, t), flags: nextFlags };
  }
  return { pointer: nextAfter(rt, choiceSceneId), flags: nextFlags };
}

/** Применение ввода текста */
export function applyInput(
  rt: Runtime,
  inputSceneId: string,
  key: string,
  value: string,
  flags: Flags
): { pointer: string | null; flags: Flags } {
  const clean = value.trim().slice(0, 40);
  return { pointer: nextAfter(rt, inputSceneId), flags: { ...flags, [key]: clean } };
}

/** Количество «значимых» сцен — для прогресс-бара */
export function countVisible(rt: Runtime): number {
  return rt.scenes.filter(s => s.type === "message" || s.type === "system").length;
}
