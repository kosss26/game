"use client";

import Link from "next/link";
import type { Story, Progress } from "@/lib/types/database";

interface StoryListProps {
  stories: Story[];
  progress: Progress[];
}

export function StoryList({ stories, progress }: StoryListProps) {
  const progressMap = new Map(
    progress.map(p => [p.story_id, p])
  );

  if (stories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-20 h-20 mb-6 rounded-full bg-tg-bg-secondary flex items-center justify-center">
          <svg className="w-10 h-10 text-tg-text-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-tg-text mb-2">Историй пока нет</h2>
        <p className="text-tg-text-secondary">Скоро здесь появятся захватывающие истории</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          progress={progressMap.get(story.id)}
        />
      ))}
    </div>
  );
}

interface StoryCardProps {
  story: Story;
  progress?: Progress;
}

function StoryCard({ story, progress }: StoryCardProps) {
  const bgStyle = story.cover_style || "noir";
  
  return (
    <Link href={`/story/${story.id}`}>
      <div className={`relative overflow-hidden rounded-2xl bg-${bgStyle} p-5 transition-transform active:scale-[0.98]`}>
        {/* Background gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${getGradientClass(bgStyle)} opacity-80`} />
        
        {/* Content */}
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white mb-1">{story.title}</h3>
          {story.description && (
            <p className="text-sm text-white/70 line-clamp-2 mb-3">{story.description}</p>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {progress ? (
                <>
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full text-white">
                    Продолжить
                  </span>
                  {progress.completed && (
                    <span className="text-xs text-white/60">✓ День завершён</span>
                  )}
                </>
              ) : (
                <span className="text-xs bg-tg-accent px-2 py-1 rounded-full text-white">
                  Начать
                </span>
              )}
            </div>
            
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

function getGradientClass(style: string): string {
  switch (style) {
    case "noir":
      return "from-slate-900 via-slate-800 to-slate-900";
    case "romance":
      return "from-rose-900 via-pink-900 to-purple-900";
    case "thriller":
      return "from-red-950 via-stone-900 to-zinc-900";
    case "mystery":
      return "from-indigo-950 via-blue-950 to-slate-900";
    default:
      return "from-slate-900 via-slate-800 to-slate-900";
  }
}
