import { StoryList } from "@/components/player/StoryList";
import { getPublishedStories } from "@/lib/actions/stories";
import { getUserProgress } from "@/lib/actions/progress";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  const stories = await getPublishedStories();
  const progress = user ? await getUserProgress(user.id) : [];

  return (
    <main className="min-h-screen bg-tg-bg">
      <header className="sticky top-0 z-10 bg-tg-bg/95 backdrop-blur-sm border-b border-tg-border px-4 py-3">
        <h1 className="text-xl font-bold text-tg-text">Истории</h1>
        <p className="text-sm text-tg-text-secondary mt-0.5">
          Выбери историю для погружения
        </p>
      </header>
      
      <StoryList stories={stories} progress={progress} />
    </main>
  );
}
