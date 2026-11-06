import { POST } from "@/app/api/telegram/webhook/route";
import { sendMessage } from "../bot";

jest.mock("@/lib/config", () => ({ config: { botToken: "111:fixture", webhookSecret: "qa-secret", isProduction: true, appUrl: "https://stories.invalid", supportTelegramIds: [900], freeAccess: true, referralBonus: 1 } }));
jest.mock("@/lib/supabase/server", () => ({ db: async () => ({ from: (table: string) => {
  const query: Record<string, unknown> = {};
  for (const key of ["select", "eq", "order", "update"]) query[key] = () => query;
  query.maybeSingle = async () => ({data: {id: "fixture-user"}});
  query.then = (resolve: (value: unknown) => void) => Promise.resolve({data: table === "stories" ? [{id: "story-1", title: "04:44", meta: {}}, {id: "story-2", title: "Белый шум", meta: {}}] : null}).then(resolve);
  return query;
} }) }));
jest.mock("../bot", () => ({ sendMessage: jest.fn().mockResolvedValue({}), callBot: jest.fn(), escapeHtml: jest.requireActual("../messages").escapeHtml, webAppButton: (text: string, path = "/") => ({inline_keyboard: [[{text, web_app: {url: "https://stories.invalid" + path}}]]}) }));
jest.mock("@/lib/game/purchases", () => ({ decodePayload: jest.fn(), grantPurchase: jest.fn() }));
const send = jest.mocked(sendMessage);
function request(text: string, secret = "qa-secret", extra = {}) {
  return new Request("https://stories.invalid/api/telegram/webhook", {method: "POST", headers: {"content-type": "application/json", "x-telegram-bot-api-secret-token": secret}, body: JSON.stringify({message: {chat: {id: 123, type: "private"}, from: {id: 123, first_name: "<Анна>"}, text, ...extra}})});
}
beforeEach(() => send.mockClear());
test("invalid webhook secret never triggers a reply", async () => { expect((await POST(request("/start", "wrong"))).status).toBe(401); expect(send).not.toHaveBeenCalled(); });
test("start sends concise escaped welcome with a single app button", async () => {
  expect((await POST(request("/start"))).status).toBe(200);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][1]).toContain("&lt;Анна&gt;");
  const keyboard = send.mock.calls[0][2]?.reply_markup as {inline_keyboard: Array<Array<{text: string; web_app: {url: string}}>>};
  expect(keyboard.inline_keyboard).toHaveLength(1);
  expect(keyboard.inline_keyboard[0][0].text).toBe("Открыть истории");
  expect(keyboard.inline_keyboard[0][0].web_app.url).toBe("https://stories.invalid/");
});
test("support deep link opens the reply prompt, not the catalog", async () => {
  await POST(request("/start support"));
  expect(send.mock.calls[0][1]).toContain("Поддержка «Полночи»");
  expect(send.mock.calls[0][2]).toMatchObject({reply_markup: {force_reply: true}});
});
test("inline support request reaches operator and acknowledgement", async () => {
  await POST(request("/support Удаление данных"));
  expect(send.mock.calls[0][0]).toBe(900);
  expect(send.mock.calls[0][1]).toContain("Удаление данных");
  expect(send.mock.calls[1][0]).toBe(123);
});
