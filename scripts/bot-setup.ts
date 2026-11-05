/**
 * Настройка бота: webhook, команды, кнопка меню Mini App, описание.
 *   npm run bot:setup
 * Требуются TELEGRAM_BOT_TOKEN, APP_URL, TELEGRAM_WEBHOOK_SECRET.
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const apiUrl = (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/$/, "");

async function call(method: string, params: Record<string, unknown> = {}) {
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    throw new Error(
      `${method}: нет связи с ${new URL(apiUrl).host} (${cause?.code || cause?.message || (error as Error).message}). ` +
        "Если Telegram недоступен с сервера, задайте TELEGRAM_API_URL (адрес relay) в файле настроек."
    );
  }
  const json = (await res.json()) as { ok: boolean; description?: string; result?: { username?: string; url?: string } };
  console.log(`${json.ok ? "✓" : "✗"} ${method}${json.ok ? "" : `: ${json.description}`}`);
  if (!json.ok) throw new Error(`${method}: ${json.description || "Telegram API error"}`);
  return json;
}

async function main() {
  if (!token || !appUrl || !secret) {
    console.error("Нужны TELEGRAM_BOT_TOKEN, APP_URL и TELEGRAM_WEBHOOK_SECRET (в .env.local)");
    process.exit(1);
  }
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
    console.error("TELEGRAM_WEBHOOK_SECRET: 16–256 символов A-Z, a-z, 0-9, _ и -");
    process.exit(1);
  }

  const expected = (process.env.BOT_USERNAME || "").replace(/^@/, "");
  if (!expected) throw new Error("Задайте BOT_USERNAME: проверка отдельного бота обязательна");
  const me = await call("getMe");
  if (me.result?.username?.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Ожидался @${expected}, токен принадлежит @${me.result?.username || "unknown"}`);
  }
  const webhook = await call("getWebhookInfo");
  if (webhook.result?.url && webhook.result.url !== `${appUrl}/api/telegram/webhook`) {
    throw new Error("У бота уже настроен другой webhook. Его настройки не изменены.");
  }
  await call("setWebhook", {
    url: `${appUrl}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message", "pre_checkout_query", "my_chat_member"],
    drop_pending_updates: false,
  });
  await call("setMyCommands", {
    commands: [
      { command: "start", description: "Открыть истории" },
      { command: "paysupport", description: "Поддержка по оплатам" },
      { command: "terms", description: "Условия использования" },
    ],
  });
  await call("setChatMenuButton", { menu_button: { type: "web_app", text: "Истории", web_app: { url: appUrl } } });
  await call("setMyShortDescription", {
    short_description: "Интерактивные истории в переписке: триллер, мистика, ограбление. Ваши ответы решают, чем всё кончится.",
  });
  await call("setMyDescription", {
    description:
      "🌙 Полночь — истории, которые происходят в чате.\n\n" +
      "Вам пишут персонажи. Вы отвечаете. Каждый выбор меняет сюжет, а у каждой истории несколько концовок.\n\n" +
      "• «Тихий час» — в 03:12 пишет незнакомка, и до утра нужно дожить вместе\n" +
      "• «Белый шум» — детектив: метель, шестеро друзей и пропавшая сестра\n" +
      "• «Северное сияние» — ограбление музея в прямом эфире\n\n" +
      "Нажмите «Старт», чтобы начать.",
  });
  console.log(`\nГотово. Mini App: ${appUrl}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Bot setup failed");
  process.exitCode = 1;
});
