import { notFound } from "next/navigation";
import {
  getDay,
  getDayScenes,
  getSceneChoices,
  getStory,
} from "@/lib/actions/admin";
import { DayEditorTabs } from "@/components/admin/DayEditorTabs";
import {
  StudioBack,
  StudioHeading,
  StudioStatus,
} from "@/components/admin/StudioUI";
export default async function DayEditorPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = await params;
  const day = await getDay(dayId);
  if (!day) notFound();
  const [scenes, story] = await Promise.all([
    getDayScenes(dayId),
    getStory(day.story_id),
  ]);
  const choices = await getSceneChoices(scenes.map((scene) => scene.id));
  return (
    <div className="studio-page">
      <StudioBack href={`/admin/stories/${day.story_id}`}>
        {story?.title || "К истории"}
      </StudioBack>
      <StudioHeading
        eyebrow={`Глава ${String(day.day_number).padStart(2, "0")}`}
        title={day.title}
        description={`${scenes.length} сцен${day.estimated_minutes ? ` · ${day.estimated_minutes} мин чтения` : ""} · Черновик и опубликованная версия хранятся отдельно`}
        action={<StudioStatus published={day.status === "published"} />}
      />
      <DayEditorTabs
        key={day.id}
        day={day}
        scenes={scenes}
        choices={choices}
        storyCharacters={story?.meta?.characters}
        storyChats={story?.meta?.chats}
        mainCharacter={story?.meta?.main_character}
      />
    </div>
  );
}
