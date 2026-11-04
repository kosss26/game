"use client";

import { useMemo } from "react";
import type { Day, Scene, Choice } from "@/lib/types/database";
import { checkCondition } from "@/lib/engine/expressions";

interface Issue {
  type: "error" | "warning";
  message: string;
  sceneIndex?: number;
}

export function analyzeDay(scenes: Scene[], choices: Choice[]) {
  const issues: Issue[] = [];
  const sorted = [...scenes].sort((a, b) => a.sort_index - b.sort_index);
  const tagIndex = new Map<string, number>();
  sorted.forEach((s, i) => s.tag && tagIndex.set(s.tag, i));
  const byScene = new Map<string, Choice[]>();
  for (const c of choices) byScene.set(c.scene_id, [...(byScene.get(c.scene_id) || []), c]);

  const edges = (i: number): number[] => {
    const s = sorted[i];
    const m = s.meta || {};
    switch (s.type) {
      case "end":
        return [];
      case "jump": {
        const out: number[] = [];
        if (m.goto_tag) {
          const t = tagIndex.get(m.goto_tag);
          if (t === undefined) issues.push({ type: "error", message: `Переход на несуществующую метку «${m.goto_tag}»`, sceneIndex: i });
          else out.push(t);
          if (m.condition) out.push(i + 1);
        } else if (m.skip) {
          out.push(i + 1 + m.skip, i + 1);
        } else out.push(i + 1);
        if (m.condition) {
          const err = checkCondition(m.condition);
          if (err) issues.push({ type: "error", message: err, sceneIndex: i });
        }
        return out;
      }
      case "choice": {
        const list = byScene.get(s.id) || [];
        if (list.length === 0) issues.push({ type: "error", message: "Выбор без вариантов", sceneIndex: i });
        if (list.length === 1 && !list[0].condition) issues.push({ type: "warning", message: "Выбор с единственным вариантом", sceneIndex: i });
        if (list.length > 0 && list.every(c => c.condition)) issues.push({ type: "warning", message: "Все варианты условные — выбор может быть пропущен", sceneIndex: i });
        return list.map(c => {
          if (!c.goto_tag) return i + 1;
          const t = tagIndex.get(c.goto_tag);
          if (t === undefined) {
            issues.push({ type: "error", message: `Вариант «${c.label}» ведёт на несуществующую метку «${c.goto_tag}»`, sceneIndex: i });
            return -1;
          }
          return t;
        });
      }
      default:
        if (s.type === "message" && !s.text) issues.push({ type: "warning", message: "Пустая реплика", sceneIndex: i });
        return [i + 1];
    }
  };

  const seen = new Set<number>();
  const queue = sorted.length ? [0] : [];
  let reachesEnd = false;
  const endings = new Set<string>();
  while (queue.length) {
    const i = queue.shift()!;
    if (seen.has(i)) continue;
    if (i < 0) continue;
    if (i >= sorted.length) {
      reachesEnd = true;
      continue;
    }
    seen.add(i);
    if (sorted[i].type === "end") {
      reachesEnd = true;
      if (sorted[i].meta?.ending) endings.add(sorted[i].meta!.ending!);
    }
    for (const n of edges(i)) if (!seen.has(n)) queue.push(n);
  }

  const unreachable = sorted.map((s, i) => ({ s, i })).filter(({ s, i }) => !seen.has(i) && s.type !== "jump" && s.type !== "set");
  if (unreachable.length) {
    issues.push({ type: "warning", message: `Недостижимых сцен: ${unreachable.length} (первая — #${unreachable[0].i + 1}: «${(unreachable[0].s.text || unreachable[0].s.type).slice(0, 40)}»). Возможно, забыт переход «-> метка».` });
  }
  if (sorted.length && !reachesEnd) issues.push({ type: "error", message: "Ни одна ветка не доходит до конца дня (бесконечный цикл?)" });

  return { issues, endings: [...endings], reachable: seen.size, total: sorted.length };
}

export function DayValidator({ scenes, choices }: { day: Day; scenes: Scene[]; choices: Choice[] }) {
  const { issues, endings, reachable, total } = useMemo(() => analyzeDay(scenes, choices), [scenes, choices]);
  const errors = issues.filter(i => i.type === "error");
  const warnings = issues.filter(i => i.type === "warning");

  if (scenes.length === 0) {
    return <div className="rounded-xl bg-tg-bg-secondary py-12 text-center text-tg-text-hint">Сохраните скрипт, чтобы проверить день</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="ошибок" value={errors.length} tone={errors.length ? "bad" : "good"} />
        <Stat label="предупреждений" value={warnings.length} tone={warnings.length ? "warn" : "good"} />
        <Stat label="достижимо сцен" value={`${reachable}/${total}`} tone="neutral" />
      </div>

      {errors.length === 0 && warnings.length === 0 && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center text-green-400">✅ День готов к публикации</div>
      )}

      {[...errors, ...warnings].length > 0 && (
        <ul className="space-y-2 rounded-xl bg-tg-bg-secondary p-4">
          {[...errors, ...warnings].map((i, k) => (
            <li key={k} className={`text-sm ${i.type === "error" ? "text-red-300" : "text-yellow-300"}`}>
              {i.type === "error" ? "❌" : "⚠️"} {i.sceneIndex !== undefined && <span className="font-mono">#{i.sceneIndex + 1}: </span>}
              {i.message}
            </li>
          ))}
        </ul>
      )}

      {endings.length > 0 && (
        <div className="rounded-xl bg-tg-bg-secondary p-4 text-sm text-tg-text-secondary">
          Концовки в этом дне: <span className="text-tg-text">{endings.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: "good" | "bad" | "warn" | "neutral" }) {
  const color = { good: "text-green-400", bad: "text-red-400", warn: "text-yellow-400", neutral: "text-tg-accent" }[tone];
  return (
    <div className="rounded-xl bg-tg-bg-secondary p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-tg-text-hint">{label}</p>
    </div>
  );
}
