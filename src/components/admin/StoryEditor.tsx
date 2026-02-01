"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateStory, deleteStory, publishStory } from "@/lib/actions/admin";
import type { Story } from "@/lib/types/database";

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
  });

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateStory(story.id, {
        title: formData.title,
        description: formData.description || null,
        cover_style: formData.cover_style,
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

  const handlePublish = async () => {
    if (!confirm("Опубликовать историю? Все дни должны быть опубликованы.")) return;
    
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
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-sm bg-tg-bg text-tg-text rounded-lg"
            >
              Изменить
            </button>
            {story.status !== "published" && (
              <button
                onClick={handlePublish}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-green-500/20 text-green-400 rounded-lg"
              >
                Опубликовать
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
            <option value="noir">Нуар</option>
            <option value="romance">Романтика</option>
            <option value="thriller">Триллер</option>
            <option value="mystery">Мистика</option>
          </select>
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
