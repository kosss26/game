import { notFound } from "next/navigation";
import Link from "next/link";
import { getDay, getDayScenes, getSceneChoices } from "@/lib/actions/admin";
import { DayEditorTabs } from "@/components/admin/DayEditorTabs";

interface PageProps {
  params: Promise<{ dayId: string }>;
}

export default async function DayEditorPage({ params }: PageProps) {
  const { dayId } = await params;
  const day = await getDay(dayId);
  
  if (!day) {
    notFound();
  }

  const scenes = await getDayScenes(dayId);
  const sceneIds = scenes.map(s => s.id);
  const choices = await getSceneChoices(sceneIds);

  return (
    <div className="px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-tg-text-secondary mb-4">
        <Link href={`/admin/stories/${day.story_id}`} className="hover:text-tg-accent">
          ← К истории
        </Link>
      </div>

      {/* Day header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-tg-text">
            День {day.day_number}: {day.title}
          </h2>
          <p className="text-sm text-tg-text-secondary mt-1">
            {scenes.length} сцен • {day.estimated_minutes || "?"} мин
          </p>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full ${
          day.status === "published" 
            ? "bg-green-500/20 text-green-400"
            : "bg-yellow-500/20 text-yellow-400"
        }`}>
          {day.status === "published" ? "Опубликовано" : "Черновик"}
        </span>
      </div>

      {/* Editor tabs */}
      <DayEditorTabs 
        day={day} 
        scenes={scenes} 
        choices={choices}
      />
    </div>
  );
}
