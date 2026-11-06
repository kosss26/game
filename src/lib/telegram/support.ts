import "server-only";
import { config } from "@/lib/config";
import { escapeHtml, sendMessage } from "./bot";
import { PAYMENT_PROMPT, SUPPORT_PROMPT, supportPrompt } from "./messages";

interface Sender { id: number; first_name: string; username?: string }
export interface SupportReply { from?: { id: number; is_bot?: boolean }; text?: string }
function ownReply(reply?: SupportReply): boolean {
  return !!reply?.from?.is_bot && reply.from.id === Number(config.botToken.split(":", 1)[0]);
}
export function supportReplyKind(reply?: SupportReply): "payment" | "support" | null {
  if (!ownReply(reply)) return null;
  if (reply?.text?.startsWith(PAYMENT_PROMPT)) return "payment";
  return reply?.text?.startsWith(SUPPORT_PROMPT) ? "support" : null;
}
export async function promptSupport(chatId: number, payment: boolean) {
  await sendMessage(chatId, supportPrompt(payment), { reply_markup: { force_reply: true, selective: true, input_field_placeholder: payment ? "История, дата покупки и ваш вопрос" : "Ваш вопрос или запрос на удаление данных" } });
}
export async function deliverSupport(chatId: number, sender: Sender | undefined, text: string, payment: boolean) {
  if (!sender || !Number.isSafeInteger(sender.id) || sender.id <= 0) return;
  const recipients = [...new Set(config.supportTelegramIds)].filter(id => id !== chatId);
  const ticket = `<b>Обращение #${sender.id}</b>\n${payment ? "Вопрос по оплате" : "Поддержка"}\nОт: ${escapeHtml(sender.first_name)}${sender.username ? ` (@${escapeHtml(sender.username)})` : ""}\n\n${escapeHtml(text.slice(0, 3000))}\n\nОтветьте на это сообщение, чтобы написать пользователю.`;
  const results = await Promise.allSettled(recipients.map(id => sendMessage(id, ticket)));
  const delivered = results.some(result => result.status === "fulfilled");
  await sendMessage(chatId, delivered ? "Сообщение передано в поддержку. Ответ придёт в этот чат." : "Не удалось передать сообщение в поддержку. Попробуйте позже. Ваш запрос пока не отправлен.");
}
export async function answerSupport(chatId: number, sender: Sender | undefined, text: string, reply?: SupportReply): Promise<boolean> {
  if (!sender || !config.supportTelegramIds.includes(sender.id) || !ownReply(reply)) return false;
  const target = reply?.text?.match(/^Обращение #(\d+)\b/);
  if (!target) return false;
  const id = Number(target[1]);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  try {
    await sendMessage(id, `<b>Поддержка «Полночи»</b>\n\n${escapeHtml(text.slice(0, 3500))}`);
    await sendMessage(chatId, "Ответ отправлен.");
  } catch { await sendMessage(chatId, "Не удалось отправить ответ. Возможно, пользователь остановил бота."); }
  return true;
}
