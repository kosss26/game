import { notFound, redirect } from "next/navigation";
import { getDay, isDayUnlocked } from "@/lib/actions/stories";
import { getPublishedSnapshot } from "@/lib/actions/scenes";
import { getDayProgress } from "@/lib/actions/progress";
import { getCurrentUser } from "@/lib/auth/session";
import { ChatPlayer } from "@/components/player/ChatPlayer";

interface PageProps {
  params: Promise<{ storyId: string; dayNumber: string }>;
}

export default async function PlayPage({ params }: PageProps) {
  const { storyId, dayNumber } = await params;
  const dayNum = parseInt(dayNumber, 10);
  
  if (isNaN(dayNum)) {
    notFound();
  }

  const day = await getDay(storyId, dayNum);
  
  if (!day) {
    notFound();
  }

  // Check if day is unlocked
  const unlocked = await isDayUnlocked(day);
  if (!unlocked) {
    redirect(`/story/${storyId}`);
  }

  // Get published snapshot
  const snapshot = await getPublishedSnapshot(day.id);
  
  if (!snapshot) {
    return (
      <div className="min-h-screen bg-tg-bg flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-tg-text mb-2">День не опубликован</h1>
          <p className="text-tg-text-secondary">Этот день ещё не готов к просмотру</p>
        </div>
      </div>
    );
  }

  // Get user progress
  const user = await getCurrentUser();
  const progress = user ? await getDayProgress(user.id, storyId, day.id) : null;

  return (
    <ChatPlayer
      storyId={storyId}
      dayId={day.id}
      snapshot={snapshot}
      initialProgress={progress}
    />
  );
}
