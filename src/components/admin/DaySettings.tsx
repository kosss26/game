"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDay, deleteDay } from "@/lib/actions/admin";
import type { Day } from "@/lib/types/database";

interface DaySettingsProps {
  day: Day;
}

export function DaySettings({ day }: DaySettingsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: day.title,
    estimated_minutes: day.estimated_minutes || 25,
    unlock_at: day.unlock_at ? new Date(day.unlock_at).toISOString().slice(0, 16) : "",
    recap_text: day.meta?.recap_text || "",
  });

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateDay(day.id, {
        title: formData.title,
        estimated_minutes: formData.estimated_minutes,
        unlock_at: formData.unlock_at || null,
        meta: {
          ...day.meta,
          recap_text: formData.recap_text || undefined,
        },
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Удалить день? Все сцены будут удалены. Это действие необратимо.")) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteDay(day.id);
      router.push(`/admin/stories/${day.story_id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-tg-bg-secondary rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Название дня
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
            Примерное время (мин)
          </label>
          <input
            type="number"
            min="1"
            max="60"
            value={formData.estimated_minutes}
            onChange={(e) => setFormData({ ...formData, estimated_minutes: parseInt(e.target.value) || 25 })}
            className="w-full bg-tg-bg border border-tg-border rounded-xl px-4 py-3 text-tg-text focus:outline-none focus:border-tg-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Дата разблокировки
          </label>
          <input
            type="datetime-local"
            value={formData.unlock_at}
            onChange={(e) => setFormData({ ...formData, unlock_at: e.target.value })}
            className="w-full bg-tg-bg border border-tg-border rounded-xl px-4 py-3 text-tg-text focus:outline-none focus:border-tg-accent"
          />
          <p className="text-xs text-tg-text-hint mt-1">
            Оставьте пустым, если день доступен сразу
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-tg-text-secondary mb-2">
            Текст-клиффхенгер (показывается в конце)
          </label>
          <textarea
            value={formData.recap_text}
            onChange={(e) => setFormData({ ...formData, recap_text: e.target.value })}
            rows={2}
            placeholder="Что же случится дальше?..."
            className="w-full bg-tg-bg border border-tg-border rounded-xl px-4 py-3 text-tg-text placeholder-tg-text-hint focus:outline-none focus:border-tg-accent resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full py-3 bg-tg-accent text-white font-medium rounded-xl disabled:opacity-50"
        >
          {isLoading ? "Сохранение..." : "Сохранить настройки"}
        </button>
      </div>

      {/* Danger zone */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <h4 className="text-sm font-medium text-red-400 mb-3">Опасная зона</h4>
        <button
          onClick={handleDelete}
          disabled={isLoading}
          className="w-full py-3 bg-red-500/20 text-red-400 font-medium rounded-xl disabled:opacity-50"
        >
          🗑 Удалить день
        </button>
      </div>
    </div>
  );
}
