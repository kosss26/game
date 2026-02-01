"use client";

import Link from "next/link";
import type { Day } from "@/lib/types/database";

interface DaysListProps {
  days: Day[];
  storyId: string;
}

export function DaysList({ days, storyId }: DaysListProps) {
  if (days.length === 0) {
    return (
      <div className="text-center py-8 bg-tg-bg-secondary rounded-xl">
        <p className="text-tg-text-hint mb-4">Дней пока нет</p>
        <Link
          href={`/admin/stories/${storyId}/days/new`}
          className="inline-block px-6 py-3 bg-tg-accent text-white font-medium rounded-xl"
        >
          Добавить первый день
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {days.map((day) => (
        <Link
          key={day.id}
          href={`/admin/days/${day.id}`}
          className="flex items-center justify-between p-4 bg-tg-bg-secondary rounded-xl border border-tg-border hover:border-tg-accent transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
              day.status === "published"
                ? "bg-green-500/20 text-green-400"
                : "bg-tg-bg text-tg-text-secondary"
            }`}>
              {day.day_number}
            </div>
            <div>
              <p className="font-medium text-tg-text">{day.title}</p>
              <div className="flex items-center gap-2 text-xs text-tg-text-hint">
                {day.estimated_minutes && (
                  <span>~{day.estimated_minutes} мин</span>
                )}
                {day.unlock_at && (
                  <>
                    <span>•</span>
                    <span>
                      Откроется: {new Date(day.unlock_at).toLocaleDateString("ru-RU")}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              day.status === "published" 
                ? "bg-green-500/20 text-green-400"
                : "bg-yellow-500/20 text-yellow-400"
            }`}>
              {day.status === "published" ? "Опубл." : "Черновик"}
            </span>
            <svg className="w-5 h-5 text-tg-text-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
}
