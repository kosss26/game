"use client";

import { useMemo } from "react";
import type { Day, Scene, Choice } from "@/lib/types/database";

interface DayValidatorProps {
  day: Day;
  scenes: Scene[];
  choices: Choice[];
}

interface ValidationIssue {
  type: "error" | "warning";
  message: string;
  sceneIndex?: number;
}

export function DayValidator({ day: _day, scenes, choices }: DayValidatorProps) {
  const issues = useMemo(() => validateDay(scenes, choices), [scenes, choices]);

  const errors = issues.filter(i => i.type === "error");
  const warnings = issues.filter(i => i.type === "warning");

  if (scenes.length === 0) {
    return (
      <div className="text-center py-12 bg-tg-bg-secondary rounded-xl">
        <p className="text-tg-text-hint">
          Добавьте сцены для проверки
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-4 text-center ${
          errors.length === 0 
            ? "bg-green-500/10 border border-green-500/30"
            : "bg-red-500/10 border border-red-500/30"
        }`}>
          <p className={`text-2xl font-bold ${errors.length === 0 ? "text-green-400" : "text-red-400"}`}>
            {errors.length}
          </p>
          <p className="text-xs text-tg-text-hint">ошибок</p>
        </div>
        <div className={`rounded-xl p-4 text-center ${
          warnings.length === 0 
            ? "bg-green-500/10 border border-green-500/30"
            : "bg-yellow-500/10 border border-yellow-500/30"
        }`}>
          <p className={`text-2xl font-bold ${warnings.length === 0 ? "text-green-400" : "text-yellow-400"}`}>
            {warnings.length}
          </p>
          <p className="text-xs text-tg-text-hint">предупреждений</p>
        </div>
      </div>

      {/* Status */}
      {errors.length === 0 && warnings.length === 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
          <span className="text-2xl">✅</span>
          <p className="text-green-400 font-medium mt-2">День готов к публикации!</p>
          <p className="text-sm text-green-300/70 mt-1">
            {scenes.length} сцен, {choices.length} вариантов выбора
          </p>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <h4 className="text-sm font-medium text-red-400 mb-3">
            ❌ Ошибки ({errors.length})
          </h4>
          <ul className="space-y-2">
            {errors.map((issue, i) => (
              <li key={i} className="text-sm text-red-300/80 flex items-start gap-2">
                <span className="text-red-400">•</span>
                <span>
                  {issue.sceneIndex !== undefined && (
                    <span className="text-red-400 font-mono">Сцена #{issue.sceneIndex + 1}: </span>
                  )}
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <h4 className="text-sm font-medium text-yellow-400 mb-3">
            ⚠️ Предупреждения ({warnings.length})
          </h4>
          <ul className="space-y-2">
            {warnings.map((issue, i) => (
              <li key={i} className="text-sm text-yellow-300/80 flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <span>
                  {issue.sceneIndex !== undefined && (
                    <span className="text-yellow-400 font-mono">Сцена #{issue.sceneIndex + 1}: </span>
                  )}
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stats */}
      <div className="bg-tg-bg-secondary rounded-xl p-4">
        <h4 className="text-sm font-medium text-tg-text-secondary mb-3">
          📊 Статистика дня
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-tg-text-hint">Всего сцен</p>
            <p className="text-tg-text font-medium">{scenes.length}</p>
          </div>
          <div>
            <p className="text-tg-text-hint">Сообщений</p>
            <p className="text-tg-text font-medium">
              {scenes.filter(s => s.type === "message").length}
            </p>
          </div>
          <div>
            <p className="text-tg-text-hint">Выборов</p>
            <p className="text-tg-text font-medium">
              {scenes.filter(s => s.type === "choice").length}
            </p>
          </div>
          <div>
            <p className="text-tg-text-hint">Пауз</p>
            <p className="text-tg-text font-medium">
              {scenes.filter(s => s.type === "pause").length}
            </p>
          </div>
          <div>
            <p className="text-tg-text-hint">Тегов</p>
            <p className="text-tg-text font-medium">
              {scenes.filter(s => s.tag).length}
            </p>
          </div>
          <div>
            <p className="text-tg-text-hint">Вариантов ответа</p>
            <p className="text-tg-text font-medium">{choices.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function validateDay(scenes: Scene[], choices: Choice[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (scenes.length === 0) {
    issues.push({ type: "error", message: "День не содержит сцен" });
    return issues;
  }

  // Build tag map
  const tagToSceneIndex = new Map<string, number>();
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].tag) {
      tagToSceneIndex.set(scenes[i].tag!, i);
    }
  }

  // Build choice map
  const choicesByScene = new Map<string, Choice[]>();
  for (const choice of choices) {
    const existing = choicesByScene.get(choice.scene_id) || [];
    existing.push(choice);
    choicesByScene.set(choice.scene_id, existing);
  }

  // Check each scene
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Check choice scenes have choices
    if (scene.type === "choice") {
      const sceneChoices = choicesByScene.get(scene.id) || [];
      if (sceneChoices.length === 0) {
        issues.push({
          type: "error",
          message: "Сцена выбора не имеет вариантов ответа",
          sceneIndex: i,
        });
      } else if (sceneChoices.length === 1) {
        issues.push({
          type: "warning",
          message: "Сцена выбора имеет только 1 вариант",
          sceneIndex: i,
        });
      }

      // Check choice goto targets
      for (const choice of sceneChoices) {
        if (choice.goto_tag && !tagToSceneIndex.has(choice.goto_tag)) {
          issues.push({
            type: "error",
            message: `Вариант "${choice.label}" ссылается на несуществующий тег: ${choice.goto_tag}`,
            sceneIndex: i,
          });
        }
      }
    }

    // Check input scenes have goto
    if (scene.type === "input") {
      const sceneChoices = choicesByScene.get(scene.id) || [];
      if (sceneChoices.length === 0 || !sceneChoices[0].goto_scene_id) {
        issues.push({
          type: "warning",
          message: "Сцена ввода не имеет перехода после ответа",
          sceneIndex: i,
        });
      }
    }

    // Check message scenes have text
    if (scene.type === "message" && !scene.text) {
      issues.push({
        type: "warning",
        message: "Сообщение без текста",
        sceneIndex: i,
      });
    }
  }

  // Check for unreachable scenes (not first, no tag, no incoming goto)
  const reachableIndices = new Set<number>([0]);
  
  // Add all scenes reachable by sequential flow
  for (let i = 0; i < scenes.length - 1; i++) {
    const scene = scenes[i];
    if (scene.type !== "choice" && scene.type !== "input") {
      reachableIndices.add(i + 1);
    }
  }

  // Add all scenes reachable by goto
  for (const choice of choices) {
    if (choice.goto_tag) {
      const targetIndex = tagToSceneIndex.get(choice.goto_tag);
      if (targetIndex !== undefined) {
        reachableIndices.add(targetIndex);
        // Also mark subsequent scenes as reachable
        for (let j = targetIndex + 1; j < scenes.length; j++) {
          const s = scenes[j - 1];
          if (s.type !== "choice" && s.type !== "input") {
            reachableIndices.add(j);
          } else {
            break;
          }
        }
      }
    }
  }

  // Check for potential dead ends
  const lastScene = scenes[scenes.length - 1];
  if (lastScene.type === "choice") {
    const lastChoices = choicesByScene.get(lastScene.id) || [];
    if (lastChoices.every(c => !c.goto_tag && !c.goto_scene_id)) {
      issues.push({
        type: "warning",
        message: "Последняя сцена — выбор без переходов. Это конец дня?",
        sceneIndex: scenes.length - 1,
      });
    }
  }

  return issues;
}
