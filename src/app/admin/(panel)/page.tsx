import Link from "next/link";
import { getStudioCatalog } from "@/lib/actions/admin";
import { FreeModeToggle } from "@/components/admin/FreeModeToggle";
import {
  StudioHeading,
  StudioStat,
  StudioStatus,
  StudioEmpty,
} from "@/components/admin/StudioUI";
import { CoverArt } from "@/components/ui/CoverArt";
import { Icon } from "@/components/ui/Icon";
export default async function AdminDashboard() {
  const stories = await getStudioCatalog();
  const recent = [...stories].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
  const draft = recent.find((story) => story.nextDraft);
  return (
    <div className="studio-page">
      <StudioHeading
        eyebrow="Авторская студия"
        title="Хорошее время для истории"
        description="Создавайте миры, в которые хочется вернуться."
        action={
          <Link className="studio-button" href="/admin/stories/new">
            <span aria-hidden="true">＋</span>Новая история
          </Link>
        }
      />
      <div className="studio-stats">
        <StudioStat label="Историй в студии" value={stories.length} />
        <StudioStat
          label="В приложении"
          value={stories.filter((s) => s.status === "published").length}
        />
        <StudioStat
          label="Глав опубликовано"
          value={stories.reduce((sum, s) => sum + s.publishedChapters, 0)}
        />
        <StudioStat
          label="Глав в работе"
          value={stories.reduce(
            (sum, s) => sum + s.chapters - s.publishedChapters,
            0,
          )}
        />
      </div>
      <div className="studio-dashboard-grid">
        <section className="studio-section">
          <div className="studio-section-heading">
            <h2>Продолжить работу</h2>
            <Link href="/admin/stories">
              Все истории
              <Icon name="chevron" size={15} />
            </Link>
          </div>
          {recent.length ? (
            <div className="studio-recent-list">
              {recent.slice(0, 5).map((story) => (
                <Link
                  className="studio-recent-row"
                  key={story.id}
                  href={`/admin/stories/${story.id}`}
                >
                  <div className="studio-recent-cover">
                    <CoverArt style={story.cover_style || "noir"} thumbnail />
                  </div>
                  <div className="studio-recent-copy">
                    <h3>{story.title}</h3>
                    <p>
                      {story.chapters} гл. · {story.publishedChapters}{" "}
                      опубликовано
                    </p>
                  </div>
                  <StudioStatus published={story.status === "published"} />
                  <Icon
                    className="studio-row-chevron"
                    name="chevron"
                    size={18}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <StudioEmpty
              title="Первая история впереди"
              text="Начните с названия. Главы можно добавить позже."
            />
          )}
        </section>
        <aside className="studio-dashboard-aside">
          <section className="studio-focus-card">
            <span className="studio-focus-icon">
              <Icon name={draft ? "file" : "check"} size={22} />
            </span>
            <p className="studio-eyebrow">
              {draft ? "На очереди" : "Всё на своих местах"}
            </p>
            <h2>{draft ? draft.title : "Можно начать что-то новое"}</h2>
            <p>
              {draft
                ? `Глава ${draft.nextDraft!.number} · ${draft.nextDraft!.title}`
                : "Главы в работе появятся здесь. Пока можно придумать следующую историю."}
            </p>
            <Link
              className="studio-button secondary"
              href={
                draft
                  ? `/admin/days/${draft.nextDraft!.id}`
                  : "/admin/stories/new"
              }
            >
              {draft ? "Открыть черновик" : "Создать историю"}
              <Icon name="forward" size={16} />
            </Link>
          </section>
          <FreeModeToggle />
        </aside>
      </div>
      <section className="studio-workflow">
        <span className="studio-eyebrow">От идеи к читателю</span>
        <div>
          <span>
            <b>01</b>Напишите главу
          </span>
          <i />
          <span>
            <b>02</b>Пройдите в плеере
          </span>
          <i />
          <span>
            <b>03</b>Опубликуйте
          </span>
        </div>
      </section>
    </div>
  );
}
