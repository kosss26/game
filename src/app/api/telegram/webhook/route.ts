import { NextResponse } from "next/server";
import crypto from "crypto";
import { config } from "@/lib/config";
import { db } from "@/lib/supabase/server";
import { callBot, escapeHtml, sendMessage, webAppButton } from "@/lib/telegram/bot";
import { decodePayload, grantPurchase } from "@/lib/game/purchases";

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
        `🎁 По вашему приглашению пришёл <b>${escapeHtml(from.first_name)}</b>. Вам начислен бесплатный пропуск ожидания.`
      ).catch(() => undefined);
    }
  }
}

const WELCOME = (name: string) =>
  `Привет, <b>${escapeHtml(name)}</b>.\n\n` +
  `Это <b>Полночь</b> — истории, которые происходят в переписке. ` +
  `Кто-то напишет вам сегодня ночью. От ваших ответов зависит, чем всё закончится.\n\n` +
  `Каждый день — новая глава.`;

async function handleCommand(chatId: number, from: TgUser | undefined, text: string) {
  const [cmd, ...args] = text.trim().split(/\s+/);
  const command = cmd.split("@")[0].toLowerCase();

  if (command === "/start") {
    if (from) await ensureUser(from, args[0]);
    await sendMessage(chatId, WELCOME(from?.first_name || "друг"), { reply_markup: webAppButton("🌙 Открыть истории") });
    return;
  }
  if (command === "/paysupport") {
    await sendMessage(
      chatId,
      "Поддержка по оплатам: опишите проблему ответным сообщением и приложите дату покупки. " +
        "Если покупка не применилась — откройте приложение заново: доступ выдаётся автоматически. " +
        "Возврат Stars возможен в течение 14 дней, если открытый контент не был прочитан."
    );
    return;
  }
  if (command === "/terms") {
    await sendMessage(chatId, "Условия использования и политика конфиденциальности:", { reply_markup: webAppButton("Открыть", "/legal") });
    return;
  }
  await sendMessage(chatId, "Истории живут в приложении 👇", { reply_markup: webAppButton("🌙 Открыть") });
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
            ? "✨ Сезонный пропуск активирован. Все дни истории открываются без ожидания."
            : `✨ День ${payload.dayNumber} открыт. Возвращайтесь в историю!`,
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
      await handleCommand(msg.chat.id, msg.from, msg.text);
    }
  } catch (e) {
    console.error("webhook error", e);
  }
  // Всегда 200, чтобы Telegram не повторял апдейт бесконечно
  return NextResponse.json({ ok: true });
}
