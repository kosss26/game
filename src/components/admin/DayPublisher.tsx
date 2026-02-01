"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { publishDay } from "@/lib/actions/admin";
import type { Day, Scene } from "@/lib/types/database";

interface DayPublisherProps {
  day: Day;
  scenes: Scene[];
}

export function DayPublisher({ day, scenes }: DayPublisherProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const canPublish = scenes.length > 0;

  const handlePublish = async () => {
    if (!confirm("Опубликовать день? Будет создан неизменяемый снапшот текущих сцен.")) {
      return;
    }

    setIsLoading(true);
    try {
      await publishDay(day.id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка публикации");
    } finally {
      setIsLoading(false);
    }
  };

  if (day.status === "published") {
    return (
      <div className="space-y-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
          <span className="text-4xl">🚀</span>
          <h3 className="text-lg font-bold text-green-400 mt-3">День опубликован!</h3>
          <p className="text-sm text-green-300/70 mt-2">
            Игроки могут проходить этот день
          </p>
        </div>

        <div className="bg-tg-bg-secondary rounded-xl p-4">
          <h4 className="text-sm font-medium text-tg-text-secondary mb-3">
            Что дальше?
          </h4>
          <ul className="space-y-2 text-sm text-tg-text-hint">
            <li>• Редактирование сцен создаст новый черновик</li>
            <li>• Опубликованный снапшот останется неизменным</li>
            <li>• Для обновления нужно опубликовать заново</li>
          </ul>
        </div>

        <Link
          href={`/play/${day.story_id}/${day.day_number}`}
          target="_blank"
          className="block w-full py-4 bg-tg-accent text-white text-center font-medium rounded-xl"
        >
          👀 Открыть как игрок
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-tg-bg-secondary rounded-xl p-6 text-center">
        <span className="text-4xl">📦</span>
        <h3 className="text-lg font-bold text-tg-text mt-3">Черновик</h3>
        <p className="text-sm text-tg-text-secondary mt-2">
          {scenes.length} сцен готовы к публикации
        </p>
      </div>

      {!canPublish && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-sm text-yellow-400">
            ⚠️ Добавьте хотя бы одну сцену перед публикацией
          </p>
        </div>
      )}

      <div className="bg-tg-bg-secondary rounded-xl p-4">
        <h4 className="text-sm font-medium text-tg-text-secondary mb-3">
          При публикации:
        </h4>
        <ul className="space-y-2 text-sm text-tg-text-hint">
          <li>✓ Создаётся неизменяемый снапшот</li>
          <li>✓ День становится доступен игрокам</li>
          <li>✓ Можно продолжать редактировать черновик</li>
        </ul>
      </div>

      <button
        onClick={handlePublish}
        disabled={!canPublish || isLoading}
        className="w-full py-4 bg-tg-accent text-white font-medium rounded-xl disabled:opacity-50"
      >
        {isLoading ? "Публикация..." : "🚀 Опубликовать день"}
      </button>
    </div>
  );
}
