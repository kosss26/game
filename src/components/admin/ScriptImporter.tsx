"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseScript, validateScript } from "@/lib/parser/dsl-parser";
import { importScript } from "@/lib/actions/admin";
import type { Character, Day } from "@/lib/types/database";

interface ScriptImporterProps {
  day: Day;
  existingScenesCount: number;
  storyCharacters?: Record<string, Character>;
}

const CHEATSHEET = `@title Название дня     @minutes 12     @wait 12h
@recap Цитата в конце   @teaser Тизер след. дня   @push Текст уведомления
@char asya Ася | color=#e17076 | status=в сети

asya: реплика персонажа     ME: реплика игрока     SYS: системное
...   [typing 1500ms]   [delay 500ms]   [pause 2m Ася не в сети]

:: метка          -> метка          END  |  END концовка
IF trust >= 2 -> метка              SET trust += 1, met = true
[if trust >= 2] asya: условная реплика
CHOICE: Подсказка
- Ответ -> метка [set trust += 1] [if флаг]
- (Действие без сообщения)
INPUT name: Как тебя зовут?          {name} — подстановка`;

export function ScriptImporter({ day, existingScenesCount, storyCharacters = {} }: ScriptImporterProps) {
  const router = useRouter();
  const [script, setScript] = useState(day.meta?.script || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [serverErrors, setServerErrors] = useState<Array<{ line: number; message: string }>>([]);
  const [showHelp, setShowHelp] = useState(!day.meta?.script);

  const parsed = useMemo(() => {
    const r = parseScript(script, { characters: storyCharacters });
    r.errors = [...r.errors, ...(script.trim() ? validateScript(r) : [])];
    return r;
  }, [script, storyCharacters]);

  const dirty = script !== (day.meta?.script || "");
  const stats = {
    messages: parsed.scenes.filter(s => s.type === "message" || s.type === "system").length,
    choices: parsed.scenes.filter(s => s.type === "choice").length,
    labels: parsed.scenes.filter(s => s.tag).length,
    words: script.split(/\s+/).filter(Boolean).length,
  };

  const save = async () => {
    if (existingScenesCount > 0 && day.status === "published" && !confirm("Сцены черновика будут заменены. Опубликованная версия не изменится, пока вы не опубликуете заново. Продолжить?")) {
      return;
    }
    setSaving(true);
    setMessage(null);
    setServerErrors([]);
    const res = await importScript(day.id, script).catch(e => ({ ok: false, error: String(e?.message || e) }) as Awaited<ReturnType<typeof importScript>>);
    setSaving(false);
    if (res.ok) {
      setMessage({ ok: true, text: `Сохранено: ${res.scenes} сцен, ${res.choices} вариантов выбора. Не забудьте опубликовать.` });
      router.refresh();
    } else {
      setServerErrors(res.errors || []);
      setMessage({ ok: false, text: res.error || "В скрипте есть ошибки" });
    }
  };

  const errors = serverErrors.length ? serverErrors : parsed.errors;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-tg-text-secondary">
          {stats.messages} реплик · {stats.choices} выборов · {stats.labels} меток · ~{Math.round(stats.words / 180)} мин чтения
        </p>
        <button onClick={() => setShowHelp(v => !v)} className="text-sm text-tg-accent">
          {showHelp ? "Скрыть синтаксис" : "Синтаксис"}
        </button>
      </div>

      {showHelp && <pre className="overflow-x-auto rounded-xl bg-tg-bg-secondary p-3 text-[11.5px] leading-relaxed text-tg-text-secondary">{CHEATSHEET}</pre>}

      <textarea
        value={script}
        onChange={e => setScript(e.target.value)}
        rows={26}
        spellCheck={false}
        placeholder="Вставьте или напишите скрипт дня…"
        className="w-full resize-y rounded-xl border border-tg-border bg-tg-bg-secondary px-4 py-3 font-mono text-[13px] leading-relaxed text-tg-text placeholder-tg-text-hint focus:border-tg-accent focus:outline-none"
      />

      {errors.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="mb-2 text-sm font-medium text-red-400">Ошибки ({errors.length})</p>
          <ul className="space-y-1 text-sm text-red-300/90">
            {errors.slice(0, 20).map((e, i) => (
              <li key={i}>
                {e.line > 0 && <span className="font-mono text-red-400">строка {e.line}: </span>}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {parsed.warnings.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
          <p className="mb-2 text-sm font-medium text-yellow-400">Предупреждения ({parsed.warnings.length})</p>
          <ul className="space-y-1 text-sm text-yellow-300/90">
            {parsed.warnings.slice(0, 10).map((w, i) => (
              <li key={i}>
                <span className="font-mono">строка {w.line}: </span>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {message && <p className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</p>}

      <button
        onClick={save}
        disabled={saving || parsed.errors.length > 0 || !script.trim() || (!dirty && existingScenesCount > 0)}
        className="w-full rounded-xl bg-tg-accent py-3.5 font-medium text-white disabled:opacity-40"
      >
        {saving ? "Сохраняем…" : dirty || existingScenesCount === 0 ? "Сохранить скрипт" : "Сохранено"}
      </button>
    </div>
  );
}
