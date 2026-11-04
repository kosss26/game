import { getAnalytics } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const a = await getAnalytics();

  return (
    <div className="px-4 py-6">
      <h2 className="mb-6 text-xl font-bold text-tg-text">Аналитика</h2>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Игроков" value={a.users - a.guests} hint={a.guests ? `+${a.guests} гостей` : undefined} />
        <Stat label="Начато дней" value={a.started} />
        <Stat label="Пройдено дней" value={a.completed} hint={a.started ? `${Math.round((a.completed / a.started) * 100)}% дочитывают` : undefined} />
        <Stat label="Покупок" value={a.purchases} />
        <Stat label="Выручка" value={`${a.stars} ⭐`} hint={`≈ $${(a.stars * 0.013).toFixed(0)}`} />
      </div>

      {a.funnels.map(f => {
        const top = Math.max(1, ...f.days.map(d => d.started));
        return (
          <section key={f.storyId} className="mb-8">
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-tg-text-secondary">Воронка: {f.title}</h3>
            <div className="space-y-2 rounded-xl bg-tg-bg-secondary p-4">
              {f.days.length === 0 && <p className="text-sm text-tg-text-hint">Дней нет</p>}
              {f.days.map(d => (
                <div key={d.dayNumber}>
                  <div className="mb-1 flex justify-between text-xs text-tg-text-secondary">
                    <span>
                      День {d.dayNumber} · {d.title}
                    </span>
                    <span>
                      {d.completed}/{d.started}
                    </span>
                  </div>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-tg-bg">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-tg-accent/35" style={{ width: `${(d.started / top) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-tg-accent" style={{ width: `${(d.completed / top) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl bg-tg-bg-secondary p-4">
      <p className="text-2xl font-bold text-tg-text">{value}</p>
      <p className="mt-1 text-xs text-tg-text-hint">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-tg-accent">{hint}</p>}
    </div>
  );
}
