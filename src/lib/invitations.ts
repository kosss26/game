/** Public copy and validation shared by invitation UI, metadata and native cards. */
export const INVITE_TITLE = "Полночь — истории в переписке";
export const INVITE_DESCRIPTION = "Истории начинаются с сообщения. Отвечайте персонажам, находите улики и меняйте ход событий.";
export const INVITE_CAPTION = "Я играю в «Полночь» — здесь истории происходят в переписке.\n\nВыбери свой сюжет. Потом сравним, к каким финалам мы пришли 🌙";
export const INVITE_SHARE_TEXT = "Приглашаю в «Полночь» 🌙\nВыбери историю и пройди её своим путём. Потом сравним наши финалы.";
export const INVITE_IMAGE = "/share/invitation.jpg";
export const INVITE_THUMBNAIL = "/share/invitation-thumb.jpg";
export const isInviteCode = (code: string) => /^ref_[1-9]\d{0,14}$/.test(code);
export function referralCode(telegramId: number): string | null {
  return Number.isSafeInteger(telegramId) && telegramId > 0 && telegramId < 1e15 ? `ref_${telegramId}` : null;
}
export function publicInvitationUrl(base: string, code: string): string | null {
  if (!isInviteCode(code)) return null;
  try {
    const url = new URL(base);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return new URL(`/invite/${code}`, url.origin).toString();
  } catch { return null; }
}
