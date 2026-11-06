"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateStory, deleteStory, publishStory } from "@/lib/actions/admin";
import type { Story, StoryMeta } from "@/lib/types/database";

interface StoryEditorProps {
  story: Story;
}

export function StoryEditor({ story }: StoryEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: story.title,
    description: story.description || "",
    cover_style: story.cover_style || "noir",
    meta: JSON.stringify(story.meta || {}, null, 2),
    sort_order: story.sort_order ?? 0,
  });

  const handleSave = async () => {
    let meta: StoryMeta;
    try {
      meta = JSON.parse(formData.meta || "{}");
    } catch {
      alert("Метаданные: некорректный JSON");
      return;
    }
    setIsLoading(true);
    try {
      await updateStory(story.id, {
        title: formData.title,
        description: formData.description || null,
        cover_style: formData.cover_style,
        sort_order: Number(formData.sort_order) || 0,
        meta,
      });
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Удалить историю? Это действие необратимо.")) return;
    
    setIsLoading(true);
    try {
      await deleteStory(story.id);
      router.push("/admin/stories");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!confirm("Снять историю с публикации? Игроки перестанут её видеть.")) return;
    setIsLoading(true);
    try {
      await updateStory(story.id, { status: "draft" });
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm("Опубликовать историю? Игроки увидят все опубликованные дни.")) return;
    
    setIsLoading(true);
    try {
      await publishStory(story.id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка публикации");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="bg-tg-bg-secondary rounded-xl p-4 border border-tg-border">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-tg-text">{story.title}</h2>
            {story.description && (
              <p className="text-tg-text-secondary mt-1">{story.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3">
              <span className={`text-xs px-2 py-1 rounded-full ${
                story.status === "published" 
                  ? "bg-green-500/20 text-green-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {story.status === "published" ? "Опубликовано" : "Черновик"}
              </span>
              <span className="text-xs text-tg-text-hint">
                Стиль: {story.cover_style}
              </span>
              <a href={`/story/${story.id}`} target="_blank" className="text-xs text-tg-accent">
                Открыть как игрок ↗
              </a>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-sm bg-tg-bg text-tg-text rounded-lg"
            >
              Изменить
            </button>
            {story.status !== "published" ? (
              <button
                onClick={handlePublish}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-green-500/20 text-green-400 rounded-lg"
              >
                Опубликовать
              </button>
            ) : (
              <button
                onClick={handleUnpublish}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-yellow-500/15 text-yellow-400 rounded-lg"
              >
                Снять
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-tg-bg-secondary rounded-xl p-4 border border-tg-accent">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Название
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full bg-tg-bg border border-tg-border rounded-xl px-4 py-3 text-tg-text focus:outline-none focus:border-tg-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Описание
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className="w-full bg-tg-bg border border-tg-border rounded-xl px-4 py-3 text-tg-text focus:outline-none focus:border-tg-accent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Стиль
          </label>
          <select
            value={formData.cover_style}
            onChange={(e) => setFormData({ ...formData, cover_style: e.target.value })}
            className="w-full bg-tg-bg border border-tg-border rounded-xl px-4 py-3 text-tg-text focus:outline-none focus:border-tg-accent"
          >
            <option value="forest">Лес / санаторий</option>
            <option value="winter">Зимнее озеро</option>
            <option value="aurora">Ночной город, сияние</option>
            <option value="perseids">Звездопад над башней</option>
            <option value="radio">Ночной эфир</option>
            <option value="noir">Нуар</option>
            <option value="romance">Романтика</option>
            <option value="thriller">Триллер</option>
            <option value="mystery">Мистика</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Порядок в каталоге
          </label>
          <input
            type="number"
            value={formData.sort_order}
            onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
            className="w-full bg-tg-bg border border-tg-border rounded-xl px-4 py-3 text-tg-text focus:outline-none focus:border-tg-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Метаданные (JSON): tagline, genre, age_rating, main_character, characters, endings
          </label>
          <textarea
            value={formData.meta}
            onChange={(e) => setFormData({ ...formData, meta: e.target.value })}
            rows={12}
            spellCheck={false}
            className="w-full bg-tg-bg border border-tg-border rounded-xl px-4 py-3 font-mono text-xs text-tg-text focus:outline-none focus:border-tg-accent"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => setIsEditing(false)}
            className="flex-1 py-2 bg-tg-bg text-tg-text rounded-xl"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 py-2 bg-tg-accent text-white rounded-xl disabled:opacity-50"
          >
            {isLoading ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
