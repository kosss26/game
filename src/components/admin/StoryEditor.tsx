"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateStory, deleteStory, publishStory } from "@/lib/actions/admin";
import type { Story, StoryMeta } from "@/lib/types/database";
import { CoverArt } from "@/components/ui/CoverArt";
import { Icon } from "@/components/ui/Icon";
import { StudioStatus } from "./StudioUI";
import { useUnsavedChanges } from "./useUnsavedChanges";

const COVERS = [
  { id: "forest", label: "Лес / санаторий" },
  { id: "winter", label: "Зимнее озеро" },
  { id: "aurora", label: "Северное сияние" },
  { id: "perseids", label: "Звездопад над башней" },
  { id: "radio", label: "Ночной эфир" },
  { id: "noir", label: "Нуар" },
  { id: "romance", label: "Романтика" },
  { id: "thriller", label: "Триллер" },
  { id: "mystery", label: "Мистика" },
];
const formFor = (story: Story) => ({
  title: story.title,
  description: story.description || "",
  cover_style: story.cover_style || "noir",
  meta: JSON.stringify(story.meta || {}, null, 2),
  sort_order: story.sort_order ?? 0,
});

export function StoryEditor({ story }: { story: Story }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(() => formFor(story));
  const dirty =
    editing && JSON.stringify(form) !== JSON.stringify(formFor(story));
  useUnsavedChanges(dirty);
  const parsedMeta = useMemo<StoryMeta | null>(() => {
    try {
      const value = JSON.parse(form.meta);
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
    } catch {
      return null;
    }
  }, [form.meta]);
  const patchMeta = (
    key: "tagline" | "genre" | "age_rating" | "synopsis",
    value: string,
  ) => {
    if (!parsedMeta) return;
    const meta = { ...parsedMeta };
    if (value) meta[key] = value;
    else delete meta[key];
    setForm({ ...form, meta: JSON.stringify(meta, null, 2) });
  };
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить изменения",
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!parsedMeta) {
      setError(
        "В дополнительных настройках указан некорректный JSON. Нужен объект в фигурных скобках.",
      );
      return;
    }
    if (!form.title.trim()) {
      setError("Укажите название истории.");
      return;
    }
    await run(async () => {
      const updated = await updateStory(story.id, {
        title: form.title,
        description: form.description || null,
        cover_style: form.cover_style,
        sort_order: Number(form.sort_order) || 0,
        meta: parsedMeta,
      });
      setForm(formFor(updated));
      setEditing(false);
      setSaved(true);
    });
  };
  const changePublication = () => {
    const published = story.status === "published";
    if (
      !confirm(
        published
          ? "Снять историю с публикации? Она исчезнет из каталога игроков."
          : "Опубликовать историю? Игроки увидят её опубликованные главы.",
      )
    )
      return;
    void run(() =>
      published
        ? updateStory(story.id, { status: "draft" })
        : publishStory(story.id),
    );
  };
  return (
    <section className="studio-panel">
      {!editing ? (
        <>
          <div className="studio-story-summary">
            <div className="studio-summary-cover">
              <CoverArt style={story.cover_style || "noir"} />
            </div>
            <div>
              <StudioStatus published={story.status === "published"} />
              <h1>{story.title}</h1>
              <p className="studio-summary-description">
                {story.meta?.tagline ||
                  story.description ||
                  "Добавьте описание, чтобы познакомить читателя с историей."}
              </p>
              <div className="studio-summary-actions">
                <button
                  className="studio-button"
                  onClick={() => {
                    setForm(formFor(story));
                    setEditing(true);
                    setError(null);
                    setSaved(false);
                  }}
                >
                  <Icon name="file" size={16} />
                  Изменить историю
                </button>
                <a
                  className="studio-button secondary"
                  href={`/story/${story.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Как видит игрок
                  <Icon name="forward" size={15} />
                </a>
              </div>
            </div>
          </div>
          <details className="studio-disclosure">
            <summary>Управление публикацией</summary>
            <div className="studio-publish-controls">
              <p>
                {story.status === "published"
                  ? "История видна в каталоге. Каждая глава публикуется отдельно в своём редакторе."
                  : "Сначала опубликуйте первую главу, затем откройте историю для игроков."}
              </p>
              <button
                className="studio-button secondary"
                disabled={busy}
                onClick={changePublication}
              >
                {busy
                  ? "Обновляем…"
                  : story.status === "published"
                    ? "Снять с публикации"
                    : "Опубликовать историю"}
              </button>
            </div>
          </details>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="studio-section-heading">
            <h2>Оформление истории</h2>
            <StudioStatus published={story.status === "published"} />
          </div>
          <fieldset disabled={busy} className="studio-form-grid">
            <label className="studio-field wide">
              Название
              <input
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="studio-field wide">
              Короткое приглашение
              <textarea
                rows={2}
                value={parsedMeta?.tagline || ""}
                disabled={!parsedMeta}
                onChange={(e) => patchMeta("tagline", e.target.value)}
              />
              <small>
                Текст на обложке в каталоге. Пара предложений без спойлеров.
              </small>
            </label>
            <label className="studio-field">
              Жанр
              <input
                value={parsedMeta?.genre || ""}
                disabled={!parsedMeta}
                onChange={(e) => patchMeta("genre", e.target.value)}
                placeholder="Мистика · Триллер"
              />
            </label>
            <label className="studio-field">
              Возрастная отметка
              <input
                value={parsedMeta?.age_rating || ""}
                disabled={!parsedMeta}
                onChange={(e) => patchMeta("age_rating", e.target.value)}
                placeholder="16+"
              />
            </label>
            <label className="studio-field wide">
              Описание
              <textarea
                rows={4}
                maxLength={1000}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
              <small>Подробное описание на странице истории.</small>
            </label>
            <label className="studio-field">
              Обложка
              <select
                value={form.cover_style}
                onChange={(e) =>
                  setForm({ ...form, cover_style: e.target.value })
                }
              >
                {!COVERS.some((c) => c.id === form.cover_style) && (
                  <option value={form.cover_style}>{form.cover_style}</option>
                )}
                {COVERS.map((cover) => (
                  <option key={cover.id} value={cover.id}>
                    {cover.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="studio-field">
              Порядок в каталоге
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm({ ...form, sort_order: Number(e.target.value) || 0 })
                }
              />
              <small>Меньше число — выше история.</small>
            </label>
          </fieldset>
          <details className="studio-disclosure">
            <summary>Дополнительные настройки · JSON</summary>
            <p>
              Персонажи, чаты, концовки и игровые параметры. Обычные поля выше
              сохраняют остальные настройки.
            </p>
            <textarea
              aria-label="Метаданные истории JSON"
              rows={14}
              spellCheck={false}
              disabled={busy}
              className="font-mono text-xs"
              value={form.meta}
              onChange={(e) => setForm({ ...form, meta: e.target.value })}
            />
          </details>
          {error && (
            <p role="alert" className="studio-error mt-4">
              {error}
            </p>
          )}
          <div className="studio-form-actions">
            <p role="status">
              {dirty
                ? "Есть несохранённые изменения"
                : "Все изменения сохранены"}
            </p>
            <button
              type="button"
              className="studio-button secondary"
              disabled={busy}
              onClick={() => {
                if (dirty && !confirm("Отменить несохранённые изменения?"))
                  return;
                setForm(formFor(story));
                setEditing(false);
                setError(null);
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="studio-button"
              disabled={busy || !dirty}
            >
              {busy ? "Сохраняем…" : "Сохранить изменения"}
            </button>
          </div>
          <details className="studio-danger">
            <summary>Удаление истории</summary>
            <p>
              Будут удалены история, её главы и связанный прогресс читателей.
              Восстановить их через студию нельзя.
            </p>
            <button
              type="button"
              className="studio-button danger"
              disabled={busy}
              onClick={() => {
                if (
                  !confirm(
                    `Удалить «${story.title}» и все её главы вместе с прогрессом читателей? Это необратимо.`,
                  )
                )
                  return;
                void run(async () => {
                  await deleteStory(story.id);
                  setEditing(false);
                  router.push("/admin/stories");
                });
              }}
            >
              <Icon name="trash" size={15} />
              Удалить историю
            </button>
          </details>
        </form>
      )}
      {!editing && error && (
        <p className="studio-error mt-4" role="alert">
          {error}
        </p>
      )}
      {saved && !editing && (
        <p className="studio-success mt-4" role="status">
          Изменения сохранены
        </p>
      )}
    </section>
  );
}
