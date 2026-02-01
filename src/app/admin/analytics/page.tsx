import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

export default async function AnalyticsPage() {
  await requireAdmin();
  const supabase = await createAdminSupabaseClient();

  // Get basic stats
  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: totalProgress } = await supabase
    .from("progresses")
    .select("*", { count: "exact", head: true });

  const { count: completedDays } = await supabase
    .from("progresses")
    .select("*", { count: "exact", head: true })
    .eq("completed", true);

  const { count: totalChoiceEvents } = await supabase
    .from("choice_events")
    .select("*", { count: "exact", head: true });

  // Get recent activity
  const { data: recentProgress } = await supabase
    .from("progresses")
    .select(`
      *,
      users(first_name, username),
      stories(title),
      days(day_number, title)
    `)
    .order("updated_at", { ascending: false })
    .limit(10);

  // Get popular choices (for future use)
  const { data: _popularChoices } = await supabase
    .from("choice_events")
    .select(`
      choice_id,
      choices(label, scene_id),
      scenes(text)
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold text-tg-text mb-6">Аналитика</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <StatCard label="Игроков" value={totalUsers || 0} icon="👥" />
        <StatCard label="Сессий" value={totalProgress || 0} icon="📊" />
        <StatCard label="Завершённых дней" value={completedDays || 0} icon="✅" />
        <StatCard label="Выборов сделано" value={totalChoiceEvents || 0} icon="🎯" />
      </div>

      {/* Recent activity */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-tg-text-secondary uppercase tracking-wide mb-3">
          Последняя активность
        </h3>
        <div className="bg-tg-bg-secondary rounded-xl divide-y divide-tg-border">
          {recentProgress && recentProgress.length > 0 ? (
            recentProgress.map((p: any, i: number) => (
              <div key={i} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-tg-text">
                    {p.users?.first_name || "Игрок"} 
                    {p.users?.username && ` (@${p.users.username})`}
                  </p>
                  <p className="text-xs text-tg-text-hint">
                    {p.stories?.title} — День {p.days?.day_number}
                    {p.completed && " ✓"}
                  </p>
                </div>
                <span className="text-xs text-tg-text-hint">
                  {formatTime(p.updated_at)}
                </span>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-tg-text-hint">
              Активности пока нет
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-tg-bg-secondary rounded-xl p-4">
        <h4 className="text-sm font-medium text-tg-text-secondary mb-2">
          📈 Расширенная аналитика
        </h4>
        <p className="text-sm text-tg-text-hint">
          Детальная статистика по выборам доступна на экране завершения дня. 
          Каждый игрок видит распределение выборов других участников.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-tg-bg-secondary rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-bold text-tg-accent">{value}</span>
      </div>
      <p className="text-xs text-tg-text-hint mt-2">{label}</p>
    </div>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин назад`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} д назад`;
}
