import { getAnalytics, getRecentErrors } from "@/lib/actions/admin";
import {
  StudioHeading,
  StudioStat,
  StudioEmpty,
} from "@/components/admin/StudioUI";
export const dynamic = "force-dynamic";
export default async function AnalyticsPage() {
  const [a, errors] = await Promise.all([getAnalytics(), getRecentErrors()]);
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
      <section className="studio-errors" aria-labelledby="errors-heading">
        <h2 id="errors-heading">Ошибки за сутки</h2>
        {!errors.length ? (
          <p className="studio-errors-empty">Ошибок не было. Если что-то сломается у игрока или на сервере, оно появится здесь и придёт оповещением в Telegram.</p>
        ) : (
          <ul>
            {errors.map((e) => (
              <li key={e.fingerprint}>
                <span className={`studio-error-source is-${e.source}`}>{e.source === "client" ? "У игрока" : "Сервер"}</span>
                <strong>{e.message}</strong>
                <span className="studio-error-meta">
                  ×{e.count} · последний раз {new Date(e.last_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} МСК
                  {(e.detail?.route || e.detail?.url) ? ` · ${e.detail.route || e.detail.url}` : ""}
                </span>
                {e.detail?.stack && <details><summary>Стек</summary><pre>{e.detail.stack}</pre></details>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
