import { getAnalytics } from "@/lib/actions/admin";
import {
  StudioHeading,
  StudioStat,
  StudioEmpty,
} from "@/components/admin/StudioUI";
export const dynamic = "force-dynamic";
export default async function AnalyticsPage() {
  const a = await getAnalytics();
  return (
    <div className="studio-page">
      <StudioHeading
        eyebrow="Читатели и истории"
        title="Что происходит в «Полночи»"
        description="Прохождения, покупки и главы, к которым возвращаются."
      />
      <div className="studio-stats">
        <StudioStat
          label="Игроков"
          value={a.users - a.guests}
          hint={a.guests ? `Ещё ${a.guests} гостей` : undefined}
        />
        <StudioStat label="Начато глав" value={a.started} />
        <StudioStat
          label="Пройдено глав"
          value={a.completed}
          hint={
            a.started
              ? `${Math.round((a.completed / a.started) * 100)}% от начатых`
              : "Пока нет прохождений"
          }
        />
        <StudioStat
          label="Покупки Stars"
          value={`${a.stars} ★`}
          hint={`${a.purchases} покупок`}
        />
      </div>
      <div className="studio-section-heading">
        <h2>Как читают истории</h2>
      </div>
      {!a.funnels.length ? (
        <StudioEmpty
          title="Статистика появится здесь"
          text="Когда читатели начнут проходить истории, вы увидите данные по каждой главе."
        />
      ) : (
        <div className="studio-analytics-grid">
          {a.funnels.map((story) => {
            const max = Math.max(1, ...story.days.map((day) => day.started));
            return (
              <section key={story.storyId} className="studio-funnel">
                <h2>{story.title}</h2>
                <p className="studio-funnel-legend">
                  Светлая полоса — завершили · тёмная — начали
                </p>
                {!story.days.length && (
                  <p className="studio-description">
                    В этой истории ещё нет глав.
                  </p>
                )}
                {story.days.map((day) => (
                  <div key={day.dayNumber} className="studio-funnel-row">
                    <div>
                      <span>
                        {day.dayNumber}. {day.title}
                      </span>
                      <b>
                        {day.completed} / {day.started}
                      </b>
                    </div>
                    <div
                      className="studio-funnel-bar"
                      role="img"
                      aria-label={`Глава ${day.dayNumber}: начали ${day.started}, завершили ${day.completed}`}
                    >
                      <span
                        style={{ width: `${(day.started / max) * 100}%` }}
                      />
                      <span
                        style={{ width: `${(day.completed / max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
