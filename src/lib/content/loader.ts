/**
 * Загрузка контента из папки content/stories/<slug>/ (story.json + dayN.story).
 * Используется сид-скриптом и тестами.
 */
import fs from "fs";
import path from "path";
import type { StoryMeta } from "@/lib/types/database";

export interface ContentStory {
  slug: string;
  title: string;
  description: string;
  cover_style: string;
  sort_order?: number;
  meta: StoryMeta;
  days: Array<{ number: number; file: string; script: string }>;
}

export function loadContent(root = path.join(process.cwd(), "content", "stories")): ContentStory[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(root, d.name, "story.json")))
    .map(dir => {
      const base = path.join(root, dir.name);
      const story = JSON.parse(fs.readFileSync(path.join(base, "story.json"), "utf8"));
      const days = fs
        .readdirSync(base)
        .map(f => ({ f, m: f.match(/^day(\d+)\.story$/) }))
        .filter(x => x.m)
        .map(x => ({ number: parseInt(x.m![1], 10), file: x.f, script: fs.readFileSync(path.join(base, x.f), "utf8") }))
        .sort((a, b) => a.number - b.number);
      return { slug: story.slug || dir.name, ...story, days } as ContentStory;
    });
}
