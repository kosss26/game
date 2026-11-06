"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { publishDay } from "@/lib/actions/admin";
import type { Day, Scene } from "@/lib/types/database";
import { Icon } from "@/components/ui/Icon";
import { StudioStatus } from "./StudioUI";
export function DayPublisher({
  day,
  scenes,
  hasUnsavedChanges = false,
}: {
  day: Day;
  scenes: Scene[];
  hasUnsavedChanges?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const published = day.status === "published";
  const publish = async () => {
    if (hasUnsavedChanges) return;
    if (
      !confirm(
        "Опубликовать сохранённую версию главы? Будет создана отдельная версия для игроков.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await publishDay(day.id);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось опубликовать главу",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="studio-panel">
      <div className="studio-section-heading">
        <h2>
          {published ? "Глава опубликована" : "Последний шаг перед читателем"}
        </h2>
        <StudioStatus published={published} />
      </div>
      <p className="studio-description">
        {published
          ? "Игроки проходят опубликованную версию. Изменения сценария сначала сохраняются в черновик."
          : "Сначала сохраните сценарий, проверьте переходы и пройдите главу в тестовом плеере."}
      </p>
      <ol className="studio-publish-checklist">
        <li>
          <Icon name={scenes.length ? "check" : "file"} size={18} />
          <span>
            <b>
              {scenes.length
                ? `${scenes.length} сцен в сохранённом сценарии`
                : "Сценарий пока пуст"}
            </b>
            <small>Несохранённый текст редактора не публикуется.</small>
          </span>
        </li>
        <li>
          <Icon name="lock" size={18} />
          <span>
            <b>Прогресс читателей сохраняется</b>
            <small>Каждое прохождение использует свою версию истории.</small>
          </span>
        </li>
        <li>
          <Icon name="book" size={18} />
          <span>
            <b>Проверьте доступность истории</b>
            <small>
              История тоже должна быть опубликована, чтобы появиться в каталоге.
            </small>
          </span>
        </li>
      </ol>
      {error && (
        <p role="alert" className="studio-error">
          {error}
        </p>
      )}
      <div className="studio-form-actions">
        {published ? (
          <Link
            className="studio-button"
            href={`/play/${day.story_id}/${day.day_number}`}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="play" size={15} />
            Открыть как игрок
          </Link>
        ) : (
          <button
            className="studio-button"
            disabled={!scenes.length || busy || hasUnsavedChanges}
            onClick={publish}
          >
            {busy ? "Публикуем…" : "Опубликовать главу"}
            <Icon name="forward" size={16} />
          </button>
        )}
      </div>
    </section>
  );
}
