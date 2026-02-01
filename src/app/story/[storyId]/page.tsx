import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoryWithDays, isDayUnlocked } from "@/lib/actions/stories";
import { getTimeUntilUnlock } from "@/lib/utils/time";
import { getUserProgress } from "@/lib/actions/progress";
import { getCurrentUser } from "@/lib/auth/session";
import type { Day, Progress } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ storyId: string }>;
}

export default async function StoryPage({ params }: PageProps) {
  const { storyId } = await params;
  const story = await getStoryWithDays(storyId);
  
  if (!story) {
    notFound();
  }

  const user = await getCurrentUser();
  const userProgress = user ? await getUserProgress(user.id) : [];
  const progressMap = new Map(
    userProgress.filter(p => p.story_id === storyId).map(p => [p.day_id, p])
  );

  return (
    <main className="min-h-screen bg-tg-bg">
      {/* Header with story info */}
      <header className="relative px-4 pt-6 pb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-tg-text-secondary mb-4">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Назад</span>
        </Link>
        
        <h1 className="text-2xl font-bold text-tg-text mb-2">{story.title}</h1>
        {story.description && (
          <p className="text-tg-text-secondary">{story.description}</p>
        )}
        
        <div className="flex items-center gap-4 mt-4 text-sm text-tg-text-hint">
          <span>{story.days.length} дней</span>
          <span>•</span>
          <span>~{story.days.reduce((acc, d) => acc + (d.estimated_minutes || 25), 0)} мин</span>
        </div>
      </header>

      {/* Days list */}
      <div className="px-4 pb-8 space-y-3">
        {story.days.map((day, index) => (
          <DayCard
            key={day.id}
            day={day}
            storyId={storyId}
            progress={progressMap.get(day.id)}
            previousCompleted={index === 0 || progressMap.get(story.days[index - 1]?.id)?.completed}
          />
        ))}
      </div>
    </main>
  );
}

interface DayCardProps {
  day: Day;
  storyId: string;
  progress?: Progress;
  previousCompleted?: boolean;
}

async function DayCard({ day, storyId, progress, previousCompleted }: DayCardProps) {
  const unlocked = await isDayUnlocked(day);
  const timeUntil = getTimeUntilUnlock(day);
  const canPlay = unlocked && previousCompleted;

  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${
        canPlay
          ? "bg-tg-bg-secondary border-tg-border"
          : "bg-tg-bg-tertiary border-transparent opacity-60"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              progress?.completed
                ? "bg-green-500/20 text-green-400"
                : canPlay
                ? "bg-tg-accent/20 text-tg-accent"
                : "bg-tg-bg text-tg-text-hint"
            }`}
          >
            {progress?.completed ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <span className="font-bold">{day.day_number}</span>
            )}
          </div>
          
          <div>
            <h3 className="font-medium text-tg-text">{day.title}</h3>
            <p className="text-xs text-tg-text-hint">
              {day.estimated_minutes ? `~${day.estimated_minutes} мин` : "День " + day.day_number}
            </p>
          </div>
        </div>

        {canPlay ? (
          <Link
            href={`/play/${storyId}/${day.day_number}`}
            className="px-4 py-2 bg-tg-accent text-white text-sm font-medium rounded-xl active:scale-95 transition-transform"
          >
            {progress && !progress.completed ? "Продолжить" : "Играть"}
          </Link>
        ) : timeUntil ? (
          <div className="text-right">
            <p className="text-xs text-tg-text-hint">Откроется через</p>
            <p className="text-sm text-tg-text-secondary font-medium">
              {formatTimeUntil(timeUntil)}
            </p>
          </div>
        ) : (
          <div className="w-6 h-6 text-tg-text-hint">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeUntil(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} д.`;
  }
  
  if (hours > 0) {
    return `${hours} ч. ${minutes} мин.`;
  }
  
  return `${minutes} мин.`;
}
