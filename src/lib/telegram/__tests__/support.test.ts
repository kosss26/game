import { sendMessage } from "../bot";
import { promptSupport, deliverSupport, answerSupport, supportReplyKind } from "../support";
import { SUPPORT_PROMPT, PAYMENT_PROMPT } from "../messages";

jest.mock("@/lib/config", () => ({ config: { botToken: "111:fixture", supportTelegramIds: [900] } }));
jest.mock("../bot", () => ({ sendMessage: jest.fn(), escapeHtml: jest.requireActual("../messages").escapeHtml }));
const send = jest.mocked(sendMessage);
const user = { id: 123, first_name: "<Анна>", username: "anna" };
const reply = (text: string, id = 111) => ({ from: { id, is_bot: true }, text });

beforeEach(() => { send.mockReset(); send.mockResolvedValue({}); });

test("support prompts use Telegram reply UI and contain no unconditional refund promise", async () => {
  await promptSupport(123, true);
  expect(send.mock.calls[0][1]).toContain(PAYMENT_PROMPT);
  expect(send.mock.calls[0][2]).toMatchObject({ reply_markup: { force_reply: true } });
  expect(send.mock.calls[0][1]).not.toContain("14 дней");
});
test("only replies to this bot's support messages enter the support flow", () => {
  expect(supportReplyKind(reply(SUPPORT_PROMPT))).toBe("support");
  expect(supportReplyKind(reply(PAYMENT_PROMPT))).toBe("payment");
  expect(supportReplyKind(reply(SUPPORT_PROMPT, 222))).toBeNull();
  expect(supportReplyKind(reply("Other message"))).toBeNull();
});
test("requests reach the operator, escape text, and are acknowledged afterwards", async () => {
  await deliverSupport(123, user, "<b>Удаление данных</b>", false);
  expect(send.mock.calls[0][0]).toBe(900);
  expect(send.mock.calls[0][1]).toContain("Обращение #123");
  expect(send.mock.calls[0][1]).toContain("&lt;b&gt;Удаление данных&lt;/b&gt;");
  expect(send.mock.calls[1][0]).toBe(123);
  expect(send.mock.calls[1][1]).toContain("передано в поддержку");
});
test("failed delivery never tells the user that the ticket was sent", async () => {
  send.mockImplementation(async id => { if (id === 900) throw new Error("offline"); return {}; });
  await deliverSupport(123, user, "Question", true);
  expect(send.mock.calls.at(-1)?.[1]).toContain("пока не отправлен");
});
test("operator reply goes back to the ticket author; other users cannot send it", async () => {
  expect(await answerSupport(123, user, "Fake answer", reply("Обращение #456"))).toBe(false);
  expect(send).not.toHaveBeenCalled();
  expect(await answerSupport(900, { id: 900, first_name: "Owner" }, "<Ответ>", reply("Обращение #123\nПоддержка"))).toBe(true);
  expect(send.mock.calls[0][0]).toBe(123);
  expect(send.mock.calls[0][1]).toContain("&lt;Ответ&gt;");
  expect(send.mock.calls[1][1]).toBe("Ответ отправлен.");
});
