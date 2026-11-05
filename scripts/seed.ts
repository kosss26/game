/**
 * Загрузка историй из content/stories в БД и публикация.
 *
 *   npm run seed              — в Supabase (если заданы переменные) или в локальную демо-базу
 *   npm run seed -- --draft   — без публикации
 *
 * Идемпотентно: истории ищутся по slug, дни — по номеру. Повторный запуск
 * обновляет сцены и публикует новую версию снапшота только если скрипт изменился.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadContent } from "@/lib/content/loader";
import { importDayScript, publishDaySnapshot, parseDayScript } from "@/lib/content/importer";
import type { Day, Story } from "@/lib/types/database";

async function getClient(): Promise<{ client: SupabaseClient; local: boolean; label: string }> {
  const forced = process.env.DATA_SOURCE;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (forced !== "local" && forced !== "supabase" && process.env.DATABASE_URL) {
    const { createPostgresClient } = await import("@/lib/db/postgres");
    return { client: createPostgresClient() as unknown as SupabaseClient, local: false, label: "PostgreSQL (DATABASE_URL)" };
  }
  if (forced !== "local" && url && key) {
    return { client: createClient(url, key, { auth: { persistSession: false } }), local: false, label: "Supabase" };
  }
  const { createLocalClient } = await import("@/lib/db/local");
  return { client: createLocalClient() as unknown as SupabaseClient, local: true, label: "Локальная демо-база (.data/local-db.json)" };
}

async function main() {
  const draft = process.argv.includes("--draft");
  const { client, local, label } = await getClient();
  console.log(`→ ${label}`);

  const stories = loadContent();
  if (stories.length === 0) {
    console.log("Нет историй в content/stories");
    return;
  }

  for (const s of stories) {
    // Проверка до записи
    for (const d of s.days) {
      const r = parseDayScript(d.script, s.meta.characters || {}, s.meta.chats || {});
      if (r.errors.length) {
        console.error(`✗ ${s.slug}/${d.file}:\n` + r.errors.map(e => `   строка ${e.line}: ${e.message}`).join("\n"));
        process.exit(1);
      }
    }

    const { data: existing } = await client.from("stories").select("*").eq("slug", s.slug).maybeSingle();
    const storyRow = {
      slug: s.slug,
      title: s.title,
      description: s.description,
      cover_style: s.cover_style,
      sort_order: s.sort_order ?? 0,
      meta: s.meta,
    };
    let story: Story;
    if (existing) {
      const { data, error } = await client.from("stories").update(storyRow).eq("id", existing.id).select().single();
      if (error) throw error;
      story = data as Story;
    } else {
      const { data, error } = await client.from("stories").insert({ ...storyRow, status: "draft" }).select().single();
      if (error) throw error;
      story = data as Story;
    }
    console.log(`\n📖 ${story.title} (${story.id})`);

    for (const d of s.days) {
      const { data: found } = await client.from("days").select("*").eq("story_id", story.id).eq("day_number", d.number).maybeSingle();
      let day = found as Day | null;
      if (!day) {
        const { data, error } = await client
          .from("days")
          .insert({ story_id: story.id, day_number: d.number, title: `День ${d.number}`, status: "draft", meta: {} })
          .select()
          .single();
        if (error) throw error;
        day = data as Day;
      }

      const unchanged = day.meta?.script === d.script && day.status === "published";
      if (unchanged) {
        console.log(`   = День ${d.number}: без изменений`);
        continue;
      }
      const res = await importDayScript(client, day, d.script, s.meta.characters || {}, s.meta.chats || {});
      let note = "";
      if (!draft) {
        const pub = await publishDaySnapshot(client, day.id);
        note = ` · опубликован v${pub.version}`;
      }
      console.log(`   ✓ День ${d.number}: ${res.scenes} сцен, ${res.choices} вариантов${note}`);
    }

    if (!draft && story.status !== "published") {
      await client.from("stories").update({ status: "published" }).eq("id", story.id);
      console.log("   🚀 История опубликована");
    }
  }

  if (local) await new Promise(r => setTimeout(r, 300)); // дождаться записи файла
  if (!local && label.startsWith("PostgreSQL")) {
    const { getPool } = await import("@/lib/db/postgres");
    await getPool().end();
  }
  console.log("\nГотово.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
