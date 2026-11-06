import "server-only";
import { config } from "@/lib/config";
import { telegramRequest } from "./transport";

export class BotApiError extends Error {
  constructor(public method: string, public code: number, public description: string) {
    super(`Bot API ${method} failed: ${code} ${description}`);
  }
}

export async function callBot<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!config.botToken) throw new BotApiError(method, 0, "TELEGRAM_BOT_TOKEN не задан");
  const res = await telegramRequest(method, params, {
    token: config.botToken,
    apiBase: config.telegramApiUrl,
    relaySecret: config.telegramRelaySecret,
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error_code?: number; description?: string };
  if (!json.ok) throw new BotApiError(method, json.error_code || res.status, json.description || "unknown error");
  return json.result as T;
}

export function webAppButton(text: string, path = "/") {
  return { inline_keyboard: [[{ text, web_app: { url: `${config.appUrl}${path}` } }]] };
}

export async function sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return callBot("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...extra });
}

export interface InvoiceParams {
  title: string;
  description: string;
  payload: string;
  stars: number;
}

/** Ссылка на оплату в Telegram Stars (валюта XTR, provider_token не нужен) */
export async function createStarsInvoiceLink(p: InvoiceParams): Promise<string> {
  return callBot<string>("createInvoiceLink", {
    title: p.title.slice(0, 32),
    description: p.description.slice(0, 255),
    payload: p.payload,
    currency: "XTR",
    prices: [{ label: p.title.slice(0, 32), amount: p.stars }],
  });
}

export { escapeHtml } from "./messages";

/** Ссылка на Mini App для шаринга */
export function miniAppLink(startParam?: string): string {
  if (config.botUsername && config.appShortName) {
    return `https://t.me/${config.botUsername}/${config.appShortName}${startParam ? `?startapp=${encodeURIComponent(startParam)}` : ""}`;
  }
  if (config.botUsername) {
    return `https://t.me/${config.botUsername}${startParam ? `?start=${encodeURIComponent(startParam)}` : ""}`;
  }
  return config.appUrl || "";
}
