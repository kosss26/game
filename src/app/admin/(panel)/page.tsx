import Link from "next/link";
import { getAllStories } from "@/lib/actions/admin";
import { FreeModeToggle } from "@/components/admin/FreeModeToggle";

export default async function AdminDashboard() {
  const stories = await getAllStories();
  
  // Get stats
  const totalStories = stories.length;
  const publishedStories = stories.filter(s => s.status === "published").length;
  const draftStories = stories.filter(s => s.status === "draft").length;

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold text-tg-text mb-6">Обзор</h2>
      
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="Всего историй" value={totalStories} />
        <StatCard label="Опубликовано" value={publishedStories} color="green" />
        <StatCard label="Черновики" value={draftStories} color="yellow" />
      </div>

      {/* Бесплатный режим */}
      <div className="mb-8">
        <FreeModeToggle />
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-tg-text-secondary uppercase tracking-wide mb-3">
          Быстрые действия
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/admin/stories/new"
            className="flex items-center gap-3 p-4 bg-tg-bg-secondary rounded-xl border border-tg-border hover:border-tg-accent transition-colors"
          >
            <span className="text-2xl">➕</span>
            <div>
              <p className="font-medium text-tg-text">Новая история</p>
              <p className="text-xs text-tg-text-hint">Создать историю</p>
            </div>
          </Link>
          <Link
            href="/admin/stories"
            className="flex items-center gap-3 p-4 bg-tg-bg-secondary rounded-xl border border-tg-border hover:border-tg-accent transition-colors"
          >
            <span className="text-2xl">📝</span>
            <div>
              <p className="font-medium text-tg-text">Редактировать</p>
              <p className="text-xs text-tg-text-hint">Все истории</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent stories */}
      <div>
        <h3 className="text-sm font-medium text-tg-text-secondary uppercase tracking-wide mb-3">
          Последние истории
        </h3>
        <div className="space-y-2">
          {stories.slice(0, 5).map((story) => (
            <Link
              key={story.id}
              href={`/admin/stories/${story.id}`}
              className="flex items-center justify-between p-4 bg-tg-bg-secondary rounded-xl"
            >
              <div>
                <p className="font-medium text-tg-text">{story.title}</p>
                <p className="text-xs text-tg-text-hint">
                  {new Date(story.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                story.status === "published" 
                  ? "bg-green-500/20 text-green-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {story.status === "published" ? "Опубликовано" : "Черновик"}
              </span>
            </Link>
          ))}
          
          {stories.length === 0 && (
            <div className="text-center py-8 text-tg-text-hint">
              Историй пока нет. Создайте первую!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  color = "blue" 
}: { 
  label: string; 
  value: number; 
  color?: "blue" | "green" | "yellow";
}) {
  const colorClasses = {
    blue: "text-tg-accent",
    green: "text-green-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className="bg-tg-bg-secondary rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
      <p className="text-xs text-tg-text-hint mt-1">{label}</p>
    </div>
  );
}
