"use client";

import { useState } from "react";
import { getDraftSnapshot } from "@/lib/actions/admin";
import { ChatPlayer } from "@/components/chat/ChatPlayer";
import type { Day, SnapshotData, Character, Flags } from "@/lib/types/database";

/** Предпросмотр черновика в настоящем плеере (без сохранения прогресса) */
export function DayPreview({ day, mainCharacter }: { day: Day; mainCharacter?: string }) {
  const [data, setData] = useState<{ snapshot: SnapshotData; characters: Record<string, Character> } | null>(null);
  const [flagsText, setFlagsText] = useState('{ "name": "Тестер" }');
  const [flags, setFlags] = useState<Flags>({});
  const [run, setRun] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    try {
      const parsed = JSON.parse(flagsText || "{}");
      setFlags(parsed);
    } catch {
      setError("Флаги: некорректный JSON");
      return;
    }
    try {
      const d = await getDraftSnapshot(day.id);
      if (d.snapshot.scenes.length === 0) {
        setError("В черновике нет сцен — сохраните скрипт");
        return;
      }
      setData({ snapshot: d.snapshot, characters: d.characters || {} });
      setRun(r => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  if (data && run > 0) {
    return (
      <div className="fixed inset-0 z-[60] bg-ink">
        <ChatPlayer
          key={run}
          preview
          storyId={day.story_id}
          dayId={day.id}
          dayNumber={day.day_number}
          dayTitle={day.title}
          version={0}
          snapshot={data.snapshot}
          characters={data.characters}
          mainCharacter={mainCharacter}
          inheritedFlags={flags}
          initial={null}
          onExit={() => setData(null)}
          onComplete={() => setTimeout(() => setData(null), 1500)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-tg-bg-secondary p-4">
      <p className="text-sm text-tg-text-secondary">Проиграйте черновик дня в настоящем плеере. Прогресс не сохраняется, статистика не пишется.</p>
      <label className="block text-xs text-tg-text-hint">Стартовые флаги (как будто из прошлых дней)</label>
      <textarea
        value={flagsText}
        onChange={e => setFlagsText(e.target.value)}
        rows={3}
        spellCheck={false}
        className="w-full rounded-xl border border-tg-border bg-tg-bg px-3 py-2 font-mono text-xs text-tg-text focus:border-tg-accent focus:outline-none"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={start} className="w-full rounded-xl bg-tg-accent py-3 font-medium text-white">
        ▶ Запустить предпросмотр
      </button>
      <p className="text-xs text-tg-text-hint">Совет: в меню «⋯» плеера выберите скорость «Мгновенно».</p>
    </div>
  );
}
