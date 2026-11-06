"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateDay, deleteDay } from "@/lib/actions/admin";
import type { Day } from "@/lib/types/database";
import { useUnsavedChanges } from "./useUnsavedChanges";
const formFor = (day: Day) => ({
  title: day.title,
  estimated_minutes: day.estimated_minutes || 25,
  unlock_at: day.unlock_at
    ? new Date(day.unlock_at).toISOString().slice(0, 16)
    : "",
  recap_text: day.meta?.recap_text || "",
});
export function DaySettings({
  day,
  onDirtyChange,
}: {
  day: Day;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [form, setForm] = useState(() => formFor(day));
  const [baseline, setBaseline] = useState(() => JSON.stringify(formFor(day)));
  const dirty = JSON.stringify(form) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useUnsavedChanges(dirty);
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!form.title.trim()) throw new Error("Укажите название главы");
      await updateDay(day.id, {
        title: form.title,
        estimated_minutes: form.estimated_minutes,
        unlock_at: form.unlock_at ? `${form.unlock_at}:00Z` : null,
        meta: { ...day.meta, recap_text: form.recap_text || undefined },
      });
      setBaseline(JSON.stringify(form));
      setMessage({ ok: true, text: "Настройки главы сохранены" });
      router.refresh();
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Не удалось сохранить",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="studio-panel">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="studio-section-heading">
          <h2>Настройки главы</h2>
        </div>
        <fieldset disabled={busy} className="studio-form-grid">
          <label className="studio-field wide">
            Название
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="studio-field">
            Время чтения · минуты
            <input
              type="number"
              min={1}
              max={60}
              required
              value={form.estimated_minutes}
              onChange={(e) =>
                setForm({
                  ...form,
                  estimated_minutes: Number(e.target.value) || 1,
                })
              }
            />
          </label>
          <label className="studio-field">
            Дата открытия · UTC
            <input
              type="datetime-local"
              value={form.unlock_at}
              onChange={(e) => setForm({ ...form, unlock_at: e.target.value })}
            />
            <small>
              Оставьте пустым, чтобы не ограничивать доступ датой. Ожидание
              между главами настраивается в сценарии.
            </small>
          </label>
          <label className="studio-field wide">
            Цитата в конце главы
            <textarea
              rows={3}
              value={form.recap_text}
              onChange={(e) => setForm({ ...form, recap_text: e.target.value })}
              placeholder="Что читатель унесёт с собой?"
            />
          </label>
        </fieldset>
        {message && (
          <p
            className={`mt-4 ${message.ok ? "studio-success" : "studio-error"}`}
            role={message.ok ? "status" : "alert"}
          >
            {message.text}
          </p>
        )}
        <div className="studio-form-actions">
          <p>
            {dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}
          </p>
          <button
            type="submit"
            className="studio-button"
            disabled={busy || !dirty}
          >
            {busy ? "Сохраняем…" : "Сохранить настройки"}
          </button>
        </div>
      </form>
      <details className="studio-danger">
        <summary>Удаление главы</summary>
        <p>
          Глава, её сцены и связанный прогресс читателей будут удалены. Это
          действие нельзя отменить.
        </p>
        <button
          type="button"
          className="studio-button danger"
          disabled={busy}
          onClick={async () => {
            if (
              !confirm(
                "Удалить главу, все её сцены и связанный прогресс читателей? Это необратимо.",
              )
            )
              return;
            setBusy(true);
            try {
              await deleteDay(day.id);
              setBaseline(JSON.stringify(form));
              router.push(`/admin/stories/${day.story_id}`);
            } catch (e) {
              setMessage({
                ok: false,
                text:
                  e instanceof Error ? e.message : "Не удалось удалить главу",
              });
              setBusy(false);
            }
          }}
        >
          Удалить главу
        </button>
      </details>
    </div>
  );
}
