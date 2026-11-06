"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createDay, getStoryDays } from "@/lib/actions/admin";
import { StudioBack, StudioHeading } from "@/components/admin/StudioUI";
import { useUnsavedChanges } from "@/components/admin/useUnsavedChanges";
export default function NewDayPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = use(params);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  return (
    <div className="studio-page">
      <StudioBack href={`/admin/stories/${storyId}`}>К истории</StudioBack>
      <StudioHeading
        eyebrow="Следующее сообщение"
        title="Новая глава"
        description="Номер назначится автоматически. После создания откроется редактор сценария."
      />
      <form
        className="studio-panel"
        onChange={() => setDirty(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const form = new FormData(e.currentTarget);
          try {
            const days = await getStoryDays(storyId);
            const next = days.length
              ? Math.max(...days.map((day) => day.day_number)) + 1
              : 1;
            const unlock = String(form.get("unlock_at") || "");
            const day = await createDay({
              story_id: storyId,
              day_number: next,
              title: String(form.get("title")),
              unlock_at: unlock
                ? new Date(`${unlock}Z`).toISOString()
                : undefined,
              estimated_minutes:
                Number(form.get("estimated_minutes")) || undefined,
            });
            setDirty(false);
            router.push(`/admin/days/${day.id}`);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Не удалось создать главу",
            );
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="studio-form-grid">
          <label className="studio-field wide">
            Название главы
            <input
              name="title"
              required
              placeholder="Например: Незнакомый номер"
            />
          </label>
          <label className="studio-field">
            Время чтения · минуты
            <input
              type="number"
              name="estimated_minutes"
              min={1}
              max={60}
              defaultValue={25}
              required
            />
          </label>
          <label className="studio-field">
            Дата открытия · UTC
            <input type="datetime-local" name="unlock_at" />
            <small>
              Необязательно. Без даты глава открывается по обычным правилам
              истории.
            </small>
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="studio-error mt-4">
            {error}
          </p>
        )}
        <div className="studio-form-actions">
          <Link
            className="studio-button secondary"
            href={`/admin/stories/${storyId}`}
          >
            Отмена
          </Link>
          <button type="submit" className="studio-button" disabled={busy}>
            {busy ? "Создаём…" : "Создать главу"}
          </button>
        </div>
      </form>
    </div>
  );
}
