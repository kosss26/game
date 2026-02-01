"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTelegram } from "@/lib/telegram/TelegramProvider";
import { completeDay, getChoiceStats } from "@/lib/actions/progress";
import type { SnapshotData, ChoiceStats } from "@/lib/types/database";

interface DayCompleteProps {
  storyId: string;
  dayId: string;
  snapshot: SnapshotData;
  flags: Record<string, string | boolean>;
}

interface ChoiceWithStats {
  sceneText: string;
  stats: ChoiceStats[];
}

export function DayComplete({ storyId, dayId, snapshot, flags }: DayCompleteProps) {
  const { haptic } = useTelegram();
  const [choiceStats, setChoiceStats] = useState<ChoiceWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    haptic?.notificationOccurred("success");
    
    // Mark day as complete
    completeDay(storyId, dayId, flags);
    
    // Load choice statistics
    loadChoiceStats();
  }, []);

  const loadChoiceStats = async () => {
    const choiceScenes = snapshot.scenes.filter(s => s.type === "choice");
    const stats: ChoiceWithStats[] = [];
    
    for (const scene of choiceScenes) {
      const sceneStats = await getChoiceStats(scene.id);
      if (sceneStats.length > 0) {
        stats.push({
          sceneText: scene.text || "Выбор",
          stats: sceneStats,
        });
      }
    }
    
    setChoiceStats(stats);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-tg-bg flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-tg-accent to-blue-600 flex items-center justify-center animate-pulse">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-tg-text mb-2">
          День {snapshot.day.day_number} завершён!
        </h1>
        <p className="text-tg-text-secondary mb-8">
          {snapshot.day.title}
        </p>

        {/* Cliffhanger text */}
        {snapshot.day.meta?.recap_text && (
          <div className="bg-tg-bg-secondary rounded-2xl p-6 mb-8 max-w-sm">
            <p className="text-tg-text italic">
              &ldquo;{snapshot.day.meta.recap_text}&rdquo;
            </p>
          </div>
        )}

        {/* Choice statistics */}
        {!isLoading && choiceStats.length > 0 && (
          <div className="w-full max-w-sm mb-8">
            <h2 className="text-sm font-medium text-tg-text-secondary mb-4 uppercase tracking-wide">
              Как выбирали другие игроки
            </h2>
            
            {choiceStats.map((item, index) => (
              <div key={index} className="mb-6">
                <p className="text-sm text-tg-text-hint mb-3 line-clamp-2">
                  {item.sceneText}
                </p>
                <div className="space-y-2">
                  {item.stats.map((stat) => (
                    <div key={stat.choice_id} className="flex items-center gap-3">
                      <div className="flex-1 bg-tg-bg-tertiary rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-tg-accent transition-all duration-500"
                          style={{ width: `${stat.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-tg-text-secondary w-12 text-right">
                        {stat.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Next day timer */}
        <NextDayTimer storyId={storyId} currentDayNumber={snapshot.day.day_number} />
      </div>

      {/* Footer */}
      <div className="p-4 safe-area-bottom">
        <Link
          href={`/story/${storyId}`}
          className="block w-full bg-tg-accent text-white text-center py-4 rounded-xl font-medium active:scale-[0.98] transition-transform"
        >
          К списку дней
        </Link>
      </div>
    </div>
  );
}

function NextDayTimer({ storyId: _storyId, currentDayNumber }: { storyId: string; currentDayNumber: number }) {
  // В реальном приложении здесь загружается unlock_at следующего дня
  // Для демо показываем заглушку
  
  return (
    <div className="bg-tg-bg-secondary rounded-2xl p-4 max-w-sm w-full">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-tg-accent/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-tg-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-tg-text">
            День {currentDayNumber + 1}
          </p>
          <p className="text-xs text-tg-text-secondary">
            Скоро откроется
          </p>
        </div>
      </div>
    </div>
  );
}
