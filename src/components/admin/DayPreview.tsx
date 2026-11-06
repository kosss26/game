"use client";
import { useState } from "react";
import { getDraftSnapshot } from "@/lib/actions/admin";
import { ChatPlayer } from "@/components/chat/ChatPlayer";
import { Icon } from "@/components/ui/Icon";
import type {
  Day,
  SnapshotData,
  Character,
  Flags,
  StoryMeta,
} from "@/lib/types/database";
export function DayPreview({
  day,
  mainCharacter,
}: {
  day: Day;
  mainCharacter?: string;
}) {
  const [data, setData] = useState<{
    snapshot: SnapshotData;
    characters: Record<string, Character>;
    storyMeta: StoryMeta;
  } | null>(null);
  const [flagsText, setFlagsText] = useState('{ "name": "Тестер" }');
  const [flags, setFlags] = useState<Flags>({});
  const [run, setRun] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setError(null);
    try {
      const parsed = JSON.parse(flagsText || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error();
      setFlags(parsed);
    } catch {
      setError(
        'Начальные значения должны быть JSON-объектом, например {"name": "Тестер"}.',
      );
      return;
    }
    setBusy(true);
    try {
      const d = await getDraftSnapshot(day.id);
      if (!d.snapshot.scenes.length) {
        setError("В черновике нет сцен. Сначала сохраните сценарий.");
        return;
      }
      setData({
        snapshot: d.snapshot,
        characters: d.characters || {},
        storyMeta: d.storyMeta,
      });
      setRun((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть плеер");
    } finally {
      setBusy(false);
    }
  };
  if (data && run > 0)
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
          storyMeta={data.storyMeta}
          inheritedFlags={flags}
          initial={null}
          onExit={() => setData(null)}
          onComplete={() => setTimeout(() => setData(null), 1500)}
        />
      </div>
    );
  return (
    <section className="studio-panel">
      <div className="studio-section-heading">
        <h2>Почувствуйте историю как читатель</h2>
      </div>
      <p className="studio-description">
        Пройдите сохранённый черновик в настоящем плеере. Тест не меняет
        прогресс игроков и статистику.
      </p>
      <details className="studio-disclosure">
        <summary>Начальные значения для теста</summary>
        <p>
          Можно задать имя, доверие и другие флаги, как будто они пришли из
          предыдущих глав.
        </p>
        <textarea
          aria-label="Начальные флаги JSON"
          value={flagsText}
          onChange={(e) => setFlagsText(e.target.value)}
          rows={4}
          spellCheck={false}
          className="font-mono text-xs"
        />
      </details>
      {error && (
        <p role="alert" className="studio-error mt-4">
          {error}
        </p>
      )}
      <div className="studio-form-actions">
        <p>Скорость переписки меняется в меню плеера.</p>
        <button
          className="studio-button"
          disabled={busy}
          onClick={() => void start()}
        >
          <Icon name="play" size={16} />
          {busy ? "Открываем…" : "Запустить тест"}
        </button>
      </div>
    </section>
  );
}
