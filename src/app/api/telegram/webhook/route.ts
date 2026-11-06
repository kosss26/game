import { NextResponse } from "next/server";
import crypto from "crypto";
import { config } from "@/lib/config";
import { db } from "@/lib/supabase/server";
import { callBot, escapeHtml, sendMessage, webAppButton } from "@/lib/telegram/bot";
import { decodePayload, grantPurchase } from "@/lib/game/purchases";

import { welcomeMessage, HELP_MESSAGE } from "@/lib/telegram/messages";
import { promptSupport, deliverSupport, answerSupport, supportReplyKind, type SupportReply } from "@/lib/telegram/support";
import { plural } from "@/lib/utils/plural";

export const dynamic = "force-dynamic";

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface Update {
  message?: {
    chat: { id: number; type: string };
    from?: TgUser;
    text?: string;
    reply_to_message?: SupportReply;
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
    };
  };
  pre_checkout_query?: { id: string; from: TgUser; currency: string; total_amount: number; invoice_payload: string };
  my_chat_member?: { chat: { id: number }; new_chat_member: { status: string } };
}

function secretOk(req: Request): boolean {
  if (!config.webhookSecret) return !config.isProduction;
  const given = Buffer.from(req.headers.get("x-telegram-bot-api-secret-token") || "");
  const expected = Buffer.from(config.webhookSecret);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

async function ensureUser(from: TgUser, refParam?: string) {
  const supabase = await db();
  const { data: existing } = await supabase.from("users").select("id").eq("telegram_id", from.id).maybeSingle();
  if (existing) {
    await supabase.from("users").update({ bot_blocked: false }).eq("id", existing.id);
    return;
  }
  let referredBy: string | null = null;
  const ref = refParam?.match(/^ref_(\d{1,15})$/);
  if (ref && Number(ref[1]) !== from.id) {
    const { data: referrer } = await supabase.from("users").select("id").eq("telegram_id", Number(ref[1])).maybeSingle();
    referredBy = referrer?.id || null;
  }
  const { error } = await supabase.from("users").insert({
    telegram_id: from.id,
    first_name: from.first_name.slice(0, 128),
    last_name: from.last_name?.slice(0, 128) || null,
    username: from.username?.slice(0, 64) || null,
    language_code: from.language_code?.slice(0, 8) || null,
    referred_by: referredBy,
  });
  if (!error && referredBy && config.referralBonus > 0) {
    await supabase.rpc("grant_skip_credit", { p_user_id: referredBy, p_amount: config.referralBonus });
    const { data: referrer } = await supabase.from("users").select("telegram_id").eq("id", referredBy).maybeSingle();
    if (referrer && Number(referrer.telegram_id) > 0) {
      await sendMessage(
        referrer.telegram_id,
        config.freeAccess ? `По вашему приглашению присоединился <b>${escapeHtml(from.first_name)}</b>. Теперь можно сравнить ваши финалы.` : `По вашему приглашению присоединился <b>${escapeHtml(from.first_name)}</b>. Начислено: ${config.referralBonus} ${plural(config.referralBonus, "пропуск ожидания", "пропуска ожидания", "пропусков ожидания")}.`
      ).catch(() => undefined);
    }
  }
}

async function publishedStories() {
  try {
    const supabase = await db();
    const { data } = await supabase
      .from("stories")
      .select("id, title, meta, sort_order")
      .eq("status", "published")
      .order("sort_order", { ascending: true });
    return ((data || []) as { id: string; title: string; meta: { tagline?: string; genre?: string } | null }[])
      .slice(0, 6)
      .map(st => ({ id: st.id, title: st.title, tagline: st.meta?.tagline, genre: st.meta?.genre }));
  } catch {
    return [];
  }
}

async function handleCommand(chatId: number, from: TgUser | undefined, text: string) {
  const [cmd, ...args] = text.trim().split(/\s+/);
  const command = cmd.split("@")[0].toLowerCase();

  if (command === "/start") {
    if (from) await ensureUser(from, args[0]);
    if (args[0] === "support" || args[0] === "paysupport") { await promptSupport(chatId, args[0] === "paysupport"); return; }
    const stories = await publishedStories();
    const appUrl = config.appUrl;
    const keyboard = [
      ...stories.map(st => [{ text: `▶️ ${st.title}`, web_app: { url: `${appUrl}/story/${st.id}` } }]),
      [{ text: "🌙 Все истории", web_app: { url: `${appUrl}/` } }],
    ];
    await sendMessage(chatId, welcomeMessage(from?.first_name || "друг", stories.length > 0), { reply_markup: { inline_keyboard: keyboard } });
    return;
  }
  if (command === "/support" || command === "/paysupport") {
    if (args.join(" ").trim()) await deliverSupport(chatId, from, args.join(" "), command === "/paysupport");
    else await promptSupport(chatId, command === "/paysupport");
    return;
  }
  if (command === "/help") {
    await sendMessage(chatId, HELP_MESSAGE, { reply_markup: { inline_keyboard: [
      [{ text: "Открыть истории", web_app: { url: config.appUrl } }],
      [{ text: "Настройки чтения", web_app: { url: `${config.appUrl}/profile` } }],
      [{ text: "Условия и конфиденциальность", web_app: { url: `${config.appUrl}/legal` } }],
    ] } });
    return;
  }
  if (command === "/terms") {
    await sendMessage(chatId, "Здесь описаны правила приложения, обработка данных и вопросы оплаты:", { reply_markup: webAppButton("Условия и конфиденциальность", "/legal") });
    return;
  }
  await sendMessage(chatId, "Чтобы выбрать историю или продолжить чтение, откройте приложение.\n\nНужна помощь? /support\nКак играть: /help", { reply_markup: webAppButton("Открыть истории") });
}

export async function POST(req: Request) {
  if (!secretOk(req)) return NextResponse.json({ ok: false }, { status: 401 });
  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    // 1. Подтверждение перед оплатой (обязательно ответить в течение 10 секунд)
    if (update.pre_checkout_query) {
      const q = update.pre_checkout_query;
      const payload = decodePayload(q.invoice_payload);
      let ok = !!payload && q.currency === "XTR";
      if (ok && payload) {
        const supabase = await db();
        const { data: u } = await supabase.from("users").select("telegram_id").eq("id", payload.userId).maybeSingle();
        ok = !!u && Number(u.telegram_id) === q.from.id;
      }
      await callBot("answerPreCheckoutQuery", ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: "Покупка недоступна. Откройте приложение заново." });
      return NextResponse.json({ ok: true });
    }

    // 2. Успешная оплата
    const paid = update.message?.successful_payment;
    if (paid) {
      const payload = decodePayload(paid.invoice_payload);
      if (payload) {
        await grantPurchase(payload, { stars: paid.total_amount, chargeId: paid.telegram_payment_charge_id, source: "stars" });
        await sendMessage(
          update.message!.chat.id,
          payload.product === "season_pass"
            ? "Сезонный пропуск активирован. Новые главы этой истории будут открываться после предыдущих без ожидания."
            : `Глава ${payload.dayNumber} открыта. Можно продолжить историю.`,
          { reply_markup: webAppButton("Продолжить", `/story/${payload.storyId}`) }
        ).catch(() => undefined);
      }
      return NextResponse.json({ ok: true });
    }

    // 3. Пользователь заблокировал бота
    if (update.my_chat_member) {
      const status = update.my_chat_member.new_chat_member.status;
      const supabase = await db();
      await supabase.from("users").update({ bot_blocked: status === "kicked" }).eq("telegram_id", update.my_chat_member.chat.id);
      return NextResponse.json({ ok: true });
    }

    // 4. Команды
    const msg = update.message;
    if (msg?.text && msg.chat.type === "private") {
      if (!msg.text.startsWith("/")) {
        if (await answerSupport(msg.chat.id, msg.from, msg.text, msg.reply_to_message)) return NextResponse.json({ ok: true });
        const kind = supportReplyKind(msg.reply_to_message);
        if (kind) { await deliverSupport(msg.chat.id, msg.from, msg.text, kind === "payment"); return NextResponse.json({ ok: true }); }
      }
      await handleCommand(msg.chat.id, msg.from, msg.text);
    }
  } catch (e) {
    console.error("webhook error", e);
  }
  // Всегда 200, чтобы Telegram не повторял апдейт бесконечно
  return NextResponse.json({ ok: true });
}
