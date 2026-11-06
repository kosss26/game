import Link from "next/link";
import { notFound } from "next/navigation";
import { getStory, getStoryDays } from "@/lib/actions/admin";
import { StoryEditor } from "@/components/admin/StoryEditor";
import { DaysList } from "@/components/admin/DaysList";
import { StudioBack } from "@/components/admin/StudioUI";
export default async function StoryEditorPage({
  params,
}: {
  params: Promise<{ storyId: string }>;
}) {
  const { storyId } = await params;
  const story = await getStory(storyId);
  if (!story) notFound();
  const days = await getStoryDays(storyId);
  return (
    <div className="studio-page">
      <StudioBack href="/admin/stories">Все истории</StudioBack>
      <StoryEditor key={story.id} story={story} />
      <section className="studio-chapters">
        <div className="studio-section-heading">
          <h2>
            Главы истории{" "}
            <span className="text-sm text-muted">{days.length}</span>
          </h2>
          <Link
            href={`/admin/stories/${storyId}/days/new`}
            className="studio-button"
          >
            ＋ Добавить главу
          </Link>
        </div>
        <DaysList days={days} storyId={storyId} />
      </section>
    </div>
  );
}
