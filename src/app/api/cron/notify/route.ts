import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { db } from "@/lib/supabase/server";
import { BotApiError, escapeHtml, sendMessage, webAppButton } from "@/lib/telegram/bot";
import type { Day, Story } from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Уведомления «открылся новый день». Запускать раз в 15–60 минут
 * (Vercel Cron, cron-job.org и т.п.) с заголовком Authorization: Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!config.cronSecret || auth !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!config.botToken || !config.appUrl) {
    return NextResponse.json({ ok: false, error: "bot not configured" }, { status: 500 });
  }

  const supabase = await db();
  const { data: rows } = await supabase
    .from("progresses")
    .select("id, user_id, story_id, day_id, completed_at")
    .eq("completed", true)
    .is("notified_at", null)
    .order("completed_at", { ascending: true })
    .limit(300);

  const daysCache = new Map<string, Day[]>();
  const storyCache = new Map<string, Story>();
  let sent = 0;
  let skipped = 0;
  const now = Date.now();

  for (const row of (rows || []) as Array<{ id: string; user_id: string; story_id: string; day_id: string; completed_at: string | null }>) {
    if (!daysCache.has(row.story_id)) {
      const { data: days } = await supabase.from("days").select("*").eq("story_id", row.story_id).eq("status", "published").order("day_number", { ascending: true });
      daysCache.set(row.story_id, (days || []) as Day[]);
      const { data: story } = await supabase.from("stories").select("*").eq("id", row.story_id).maybeSingle();
      if (story) storyCache.set(row.story_id, story as Story);
    }
    const days = daysCache.get(row.story_id)!;
    const idx = days.findIndex(d => d.id === row.day_id);
    const next = idx >= 0 ? days[idx + 1] : undefined;
    const story = storyCache.get(row.story_id);

    // Следующего опубликованного дня нет — снимаем из очереди, чтобы не копить «хвост»
    if (!next || !story || story.status !== "published") {
      await supabase.from("progresses").update({ notified_at: new Date().toISOString() }).eq("id", row.id);
      skipped++;
      continue;
    }

    const waitHours = next.meta?.wait_hours ?? config.defaultWaitHours;
    const readyAt = Math.max(
      (row.completed_at ? new Date(row.completed_at).getTime() : now) + waitHours * 3_600_000,
      next.unlock_at ? new Date(next.unlock_at).getTime() : 0
    );
    if (readyAt > now) {
      skipped++;
      continue;
    }

    // Игрок уже начал следующий день — уведомление не нужно
    const { data: started } = await supabase.from("progresses").select("id").eq("user_id", row.user_id).eq("day_id", next.id).maybeSingle();
    const { data: user } = await supabase.from("users").select("telegram_id, first_name, is_guest, bot_blocked").eq("id", row.user_id).maybeSingle();

    if (!started && user && !user.is_guest && !user.bot_blocked && Number(user.telegram_id) > 0) {

      const custom = next.meta?.push;
      const text = custom
        ? `<b>${escapeHtml(story.title)}</b> · Глава ${next.day_number}\n\n${escapeHtml(custom)}`
        : `<b>${escapeHtml(story.title)}</b>\n\nДоступна глава ${next.day_number}: «${escapeHtml(next.title)}». Можно продолжить историю.`;
      try {
        await sendMessage(Number(user.telegram_id), text, { reply_markup: webAppButton("Продолжить историю", `/play/${story.id}/${next.day_number}`) });
        sent++;
      } catch (e) {
        if (e instanceof BotApiError && e.code === 403) {
          await supabase.from("users").update({ bot_blocked: true }).eq("id", row.user_id);
        } else if (e instanceof BotApiError && e.code === 429) {
          break; // лимит — продолжим в следующий запуск
        }
      }
      // Telegram: не более ~30 сообщений в секунду
      await new Promise(r => setTimeout(r, 40));
    }
    await supabase.from("progresses").update({ notified_at: new Date().toISOString() }).eq("id", row.id);
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
