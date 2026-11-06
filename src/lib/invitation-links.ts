import "server-only";
import { config } from "@/lib/config";
import { miniAppLink } from "@/lib/telegram/bot";
import { publicInvitationUrl, referralCode } from "./invitations";

export function invitationLink(telegramId?: number): string {
  const code = telegramId === undefined ? null : referralCode(telegramId);
  return code ? publicInvitationUrl(config.appUrl, code) || miniAppLink(code) : miniAppLink();
}
