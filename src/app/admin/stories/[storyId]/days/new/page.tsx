"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createDay, getStoryDays } from "@/lib/actions/admin";

interface PageProps {
  params: Promise<{ storyId: string }>;
}

export default function NewDayPage({ params }: PageProps) {
  const { storyId } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    try {
      // Get next day number
      const days = await getStoryDays(storyId);
      const nextDayNumber = days.length > 0 
        ? Math.max(...days.map(d => d.day_number)) + 1 
        : 1;

      const day = await createDay({
        story_id: storyId,
        day_number: nextDayNumber,
        title: formData.get("title") as string,
        unlock_at: formData.get("unlock_at") as string || undefined,
        estimated_minutes: parseInt(formData.get("estimated_minutes") as string) || undefined,
      });
      
      router.push(`/admin/days/${day.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="flex items-center gap-2 text-sm text-tg-text-secondary mb-4">
        <Link href={`/admin/stories/${storyId}`} className="hover:text-tg-accent">
          ← Назад к истории
        </Link>
      </div>

      <h2 className="text-xl font-bold text-tg-text mb-6">Новый день</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Название дня *
          </label>
          <input
            type="text"
            name="title"
            required
            className="w-full bg-tg-bg-secondary border border-tg-border rounded-xl px-4 py-3 text-tg-text placeholder-tg-text-hint focus:outline-none focus:border-tg-accent"
            placeholder="Например: Знакомство"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Дата разблокировки
          </label>
          <input
            type="datetime-local"
            name="unlock_at"
            className="w-full bg-tg-bg-secondary border border-tg-border rounded-xl px-4 py-3 text-tg-text focus:outline-none focus:border-tg-accent"
          />
          <p className="text-xs text-tg-text-hint mt-1">
            Оставьте пустым, если день доступен сразу
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Примерное время прохождения (мин)
          </label>
          <input
            type="number"
            name="estimated_minutes"
            min="1"
            max="60"
            defaultValue="25"
            className="w-full bg-tg-bg-secondary border border-tg-border rounded-xl px-4 py-3 text-tg-text focus:outline-none focus:border-tg-accent"
          />
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
