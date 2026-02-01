"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStory } from "@/lib/actions/admin";

export default function NewStoryPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    try {
      const story = await createStory({
        title: formData.get("title") as string,
        description: formData.get("description") as string || undefined,
        cover_style: formData.get("cover_style") as string || "noir",
      });
      
      router.push(`/admin/stories/${story.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold text-tg-text mb-6">Новая история</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Название *
          </label>
          <input
            type="text"
            name="title"
            required
            className="w-full bg-tg-bg-secondary border border-tg-border rounded-xl px-4 py-3 text-tg-text placeholder-tg-text-hint focus:outline-none focus:border-tg-accent"
            placeholder="Введите название истории"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Описание
          </label>
          <textarea
            name="description"
            rows={3}
            className="w-full bg-tg-bg-secondary border border-tg-border rounded-xl px-4 py-3 text-tg-text placeholder-tg-text-hint focus:outline-none focus:border-tg-accent resize-none"
            placeholder="Краткое описание истории"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Стиль оформления
          </label>
          <select
            name="cover_style"
            className="w-full bg-tg-bg-secondary border border-tg-border rounded-xl px-4 py-3 text-tg-text focus:outline-none focus:border-tg-accent"
          >
            <option value="noir">Нуар (тёмный)</option>
            <option value="romance">Романтика</option>
            <option value="thriller">Триллер</option>
            <option value="mystery">Мистика</option>
          </select>
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 bg-tg-bg-secondary text-tg-text rounded-xl font-medium"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-3 bg-tg-accent text-white rounded-xl font-medium disabled:opacity-50"
          >
            {isLoading ? "Создание..." : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
}
