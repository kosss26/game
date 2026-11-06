"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStory } from "@/lib/actions/admin";
import { CoverArt } from "@/components/ui/CoverArt";
import { StudioBack, StudioHeading } from "@/components/admin/StudioUI";
import { useUnsavedChanges } from "@/components/admin/useUnsavedChanges";
const COVERS = [
  ["forest", "Лес / санаторий"],
  ["winter", "Зимнее озеро"],
  ["aurora", "Северное сияние"],
  ["perseids", "Звездопад над башней"],
  ["radio", "Ночной эфир"],
  ["noir", "Нуар"],
  ["romance", "Романтика"],
  ["thriller", "Триллер"],
  ["mystery", "Мистика"],
];
export default function NewStoryPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("forest");
  const [created, setCreated] = useState(false);
  useUnsavedChanges(
    !created && (!!title || !!description || cover !== "forest"),
  );
  return (
    <div className="studio-page">
      <StudioBack href="/admin/stories">Все истории</StudioBack>
      <StudioHeading
        eyebrow="Чистый лист"
        title="У каждой истории есть начало"
        description="Начните с названия и обложки. Персонажей, главы и концовки можно добавить позже."
      />
      <div className="studio-new-story">
        <form
          className="studio-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const story = await createStory({
                title,
                description,
                cover_style: cover,
              });
              setCreated(true);
              router.push(`/admin/stories/${story.id}`);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Не удалось создать историю",
              );
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="studio-form-grid">
            <label className="studio-field wide">
              Название истории
              <input
                required
                maxLength={120}
                placeholder="Как начинается ваш мир?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="studio-field wide">
              Описание
              <textarea
                rows={5}
                maxLength={1000}
                placeholder="Что ждёт читателя?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <small>О чём история — без раскрытия главных поворотов.</small>
            </label>
            <label className="studio-field wide">
              Обложка
              <select value={cover} onChange={(e) => setCover(e.target.value)}>
                {COVERS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <small>Обложку и оформление можно изменить в любое время.</small>
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="studio-error mt-4">
              {error}
            </p>
          )}
          <div className="studio-form-actions">
            <Link href="/admin/stories" className="studio-button secondary">
              Отмена
            </Link>
            <button
              type="submit"
              className="studio-button"
              disabled={busy || !title.trim()}
            >
              {busy ? "Создаём…" : "Создать историю"}
            </button>
          </div>
        </form>
        <aside className="studio-new-preview">
          <p className="studio-eyebrow">Первое впечатление</p>
          <div className="studio-new-cover">
            <CoverArt style={cover} />
            <div>
              <span>НОВАЯ ИСТОРИЯ</span>
              <h2>{title || "Название вашей истории"}</h2>
              <p>
                {description ||
                  "Здесь будет короткое знакомство с вашим миром."}
              </p>
            </div>
          </div>
          <p className="studio-description">
            История появится у читателей только после публикации.
          </p>
        </aside>
      </div>
    </div>
  );
}
