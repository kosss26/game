/** Shared release copy for the webhook and the bot setup CLI. No server imports. */
export const BOT_COMMANDS = [
  { command: "start", description: "Открыть истории" },
  { command: "help", description: "Как играть" },
  { command: "support", description: "Связаться с поддержкой" },
  { command: "paysupport", description: "Вопрос по оплате" },
  { command: "terms", description: "Условия и конфиденциальность" },
];
export const BOT_SHORT_DESCRIPTION = "Интерактивные истории в переписке. Вам пишут персонажи. Ваши ответы меняют финал.";
export const BOT_DESCRIPTION = "Полночь — истории, в которых участвуете вы.\n\nЧитайте переписку, отвечайте персонажам и меняйте ход событий. У каждого сюжета несколько финалов.\n\nВсе истории и ваш прогресс — в приложении. Нажмите «Старт», чтобы открыть его.";
export function escapeHtml(text: string): string { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
export function welcomeMessage(name: string): string {
  return `🌙 <b>Полночь</b>\n\nПривет, <b>${escapeHtml(name)}</b>.\nЗдесь история начинается с сообщения. Читайте, отвечайте персонажам и меняйте финал.\n\nВсе сюжеты и ваш прогресс — в приложении.`;
}
export const HELP_MESSAGE = "<b>Как играть в «Полночь»</b>\n\n1. Откройте приложение и выберите историю.\n2. Читайте сообщения и отвечайте персонажам.\n3. Возвращайтесь к истории в удобное время — прогресс сохраняется.\n\nСкорость сообщений и выборы на время можно изменить в профиле.\n\nЕсли нужна помощь, отправьте /support. По вопросам оплаты — /paysupport.";
export const SUPPORT_PROMPT = "Поддержка «Полночи»";
export const PAYMENT_PROMPT = "Оплата в «Полночи»";
export function supportPrompt(payment: boolean): string {
  return `<b>${payment ? PAYMENT_PROMPT : SUPPORT_PROMPT}</b>\n\n${payment ? "Ответьте на это сообщение: укажите историю, дату покупки и что произошло. Если доступ не появился, сначала закройте и снова откройте приложение." : "Ответьте на это сообщение и опишите вопрос. Если хотите удалить данные, напишите «Удаление данных»."}\n\nНе присылайте пароли, токены и данные банковских карт.`;
}
