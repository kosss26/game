import Link from "next/link";
import { getAllStories } from "@/lib/actions/admin";
import type { Story } from "@/lib/types/database";

export default async function StoriesListPage() {
  let stories: Story[] = [];
  try {
    stories = await getAllStories();
  } catch (error) {
    console.error("Error loading stories:", error);
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-tg-text">Все истории</h2>
        <Link
          href="/admin/stories/new"
          className="px-4 py-2 bg-tg-accent text-white text-sm font-medium rounded-xl"
        >
          + Новая
        </Link>
      </div>

      <div className="space-y-3">
        {stories.map((story) => (
          <Link
            key={story.id}
            href={`/admin/stories/${story.id}`}
            className="block bg-tg-bg-secondary rounded-xl p-4 border border-tg-border hover:border-tg-accent transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-tg-text">{story.title}</h3>
                {story.description && (
                  <p className="text-sm text-tg-text-secondary mt-1 line-clamp-2">
                    {story.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-tg-text-hint">
                  <span>Стиль: {story.cover_style}</span>
                  <span>•</span>
                  <span>{new Date(story.created_at).toLocaleDateString("ru-RU")}</span>
                </div>
              </div>
              <span className={`ml-3 text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                story.status === "published" 
                  ? "bg-green-500/20 text-green-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {story.status === "published" ? "Опубликовано" : "Черновик"}
              </span>
            </div>
          </Link>
        ))}

        {stories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-tg-text-hint mb-4">Историй пока нет</p>
            <Link
              href="/admin/stories/new"
              className="inline-block px-6 py-3 bg-tg-accent text-white font-medium rounded-xl"
            >
              Создать первую историю
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
