import Link from "next/link";
import { notFound } from "next/navigation";
import { getStory, getStoryDays } from "@/lib/actions/admin";
import { StoryEditor } from "@/components/admin/StoryEditor";
import { DaysList } from "@/components/admin/DaysList";

interface PageProps {
  params: Promise<{ storyId: string }>;
}

export default async function StoryEditorPage({ params }: PageProps) {
  const { storyId } = await params;
  const story = await getStory(storyId);
  
  if (!story) {
    notFound();
  }

  const days = await getStoryDays(storyId);

  return (
    <div className="px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-tg-text-secondary mb-4">
        <Link href="/admin/stories" className="hover:text-tg-accent">
          Истории
        </Link>
        <span>/</span>
        <span className="text-tg-text">{story.title}</span>
      </div>

      {/* Story Editor */}
      <StoryEditor story={story} />

      {/* Days Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-tg-text">Дни истории</h3>
          <Link
            href={`/admin/stories/${storyId}/days/new`}
            className="px-4 py-2 bg-tg-accent text-white text-sm font-medium rounded-xl"
          >
            + Добавить день
          </Link>
        </div>
        
        <DaysList days={days} storyId={storyId} />
      </div>
    </div>
  );
}
