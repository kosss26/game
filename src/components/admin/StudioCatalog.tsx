"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { StudioStory } from "@/lib/actions/admin";
import { CoverArt } from "@/components/ui/CoverArt";
import { Icon } from "@/components/ui/Icon";
import { chaptersLabel } from "@/lib/utils/plural";
import { StudioEmpty, StudioStatus } from "./StudioUI";

export function StudioStoryCard({ story }: { story: StudioStory }) {
  return (
    <Link className="studio-story-card" href={`/admin/stories/${story.id}`}>
      <div className="studio-story-cover">
        <CoverArt style={story.cover_style || "noir"} />
        <StudioStatus published={story.status === "published"} />
        <span className="studio-cover-open">
          <Icon name="forward" size={18} />
        </span>
      </div>
      <div className="studio-story-copy">
        <p className="studio-eyebrow">
          {story.meta?.genre || "История в переписке"}
        </p>
        <h2>{story.title}</h2>
        <p className="studio-story-description">
          {story.meta?.tagline ||
            story.description ||
            "Добавьте описание и познакомьте читателя с историей."}
        </p>
        <div className="studio-story-meta">
          <span>
            <Icon name="file" size={14} />
            {chaptersLabel(story.chapters)}
          </span>
          <span>{story.publishedChapters} опубликовано</span>
        </div>
        <div className="studio-story-bottom">
          <span>Редактировать историю</span>
          <Icon name="chevron" size={16} />
        </div>
      </div>
    </Link>
  );
}
export function StudioCatalog({ stories }: { stories: StudioStory[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("catalog");
  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ru");
    const list = stories.filter(
      (story) =>
        (filter === "all" || story.status === filter) &&
        (!q ||
          [story.title, story.description, story.meta?.genre].some((v) =>
            v?.toLocaleLowerCase("ru").includes(q),
          )),
    );
    if (sort === "updated")
      list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (sort === "title")
      list.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    return list;
  }, [stories, query, filter, sort]);
  const filters = [
    { id: "all", label: "Все истории", count: stories.length },
    {
      id: "published",
      label: "Опубликованы",
      count: stories.filter((s) => s.status === "published").length,
    },
    {
      id: "draft",
      label: "Черновики",
      count: stories.filter((s) => s.status === "draft").length,
    },
  ];
  return (
    <>
      <div className="studio-catalog-tools">
        <label className="studio-search">
          <Icon name="search" size={19} />
          <input
            aria-label="Поиск историй"
            placeholder="Найти историю…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => setQuery("")}
            >
              <Icon name="close" size={17} />
            </button>
          )}
        </label>
        <select
          aria-label="Порядок историй"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="catalog">Порядок в приложении</option>
          <option value="updated">Недавно изменённые</option>
          <option value="title">По названию</option>
        </select>
      </div>
      <div className="studio-filter-row">
        <div className="studio-filters" aria-label="Статус историй">
          {filters.map((f) => (
            <button
              key={f.id}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span>{f.count}</span>
            </button>
          ))}
        </div>
        <span className="studio-result-count" role="status">
          Показано {items.length} из {stories.length}
        </span>
      </div>
      {items.length ? (
        <div className="studio-story-grid">
          {items.map((story) => (
            <StudioStoryCard key={story.id} story={story} />
          ))}
        </div>
      ) : stories.length ? (
        <StudioEmpty
          title="Ничего не найдено"
          text="Попробуйте другое название или сбросьте фильтры."
        >
          <button
            className="studio-button secondary"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            Сбросить фильтры
          </button>
        </StudioEmpty>
      ) : (
        <StudioEmpty
          title="Здесь начнётся первая история"
          text="Создайте историю, добавьте главы и проверьте их в плеере."
        >
          <Link className="studio-button" href="/admin/stories/new">
            Создать историю
          </Link>
        </StudioEmpty>
      )}
    </>
  );
}
