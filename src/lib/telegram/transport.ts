/** Shared by the server and CLI. No server-only import: bot setup runs in Node. */
export const DIRECT_TELEGRAM_API = "https://api.telegram.org";

interface TelegramTransport {
  token: string;
  apiBase?: string;
  relaySecret?: string;
}

export function telegramRequest(method: string, params: Record<string, unknown>, options: TelegramTransport): Promise<Response> {
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(options.token)) throw new Error("Неверный формат TELEGRAM_BOT_TOKEN");
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(method)) throw new Error("Неверный метод Telegram API");
  const base = new URL(options.apiBase || DIRECT_TELEGRAM_API);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("TELEGRAM_API_BASE должен быть HTTPS-адресом без пароля, query и fragment");
  }
  const relay = base.origin !== DIRECT_TELEGRAM_API;
  if (relay && !options.relaySecret) throw new Error("Для реле задайте TELEGRAM_RELAY_SECRET");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (relay) headers["X-Relay-Secret"] = options.relaySecret!;
  return fetch(`${base.toString().replace(/\/$/, "")}/bot${options.token}/${method}`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
}
