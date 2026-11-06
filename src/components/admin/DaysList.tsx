import Link from "next/link";
import type { Day } from "@/lib/types/database";
import { StudioStatus, StudioEmpty } from "./StudioUI";
import { Icon } from "@/components/ui/Icon";
export function DaysList({ days, storyId }: { days: Day[]; storyId: string }) {
  if (!days.length)
    return (
      <StudioEmpty
        title="Первая глава ещё не написана"
        text="Добавьте главу, вставьте сценарий и пройдите его в тестовом плеере."
      >
        <Link
          className="studio-button"
          href={`/admin/stories/${storyId}/days/new`}
        >
          Добавить первую главу
        </Link>
      </StudioEmpty>
    );
  return (
    <div className="studio-chapter-list">
      {days.map((day) => (
        <Link
          key={day.id}
          href={`/admin/days/${day.id}`}
          className="studio-chapter-row"
        >
          <span className="studio-chapter-number">
            {String(day.day_number).padStart(2, "0")}
          </span>
          <div className="studio-chapter-copy">
            <h3>{day.title}</h3>
            <p>
              {day.estimated_minutes
                ? `${day.estimated_minutes} мин чтения`
                : "Время не указано"}
              {day.unlock_at
                ? ` · Открытие ${new Date(day.unlock_at).toLocaleDateString("ru-RU")}`
                : ""}
            </p>
          </div>
          <StudioStatus published={day.status === "published"} />
          <Icon name="chevron" size={17} />
        </Link>
      ))}
    </div>
  );
}
