"use server";

import crypto from "crypto";
import { resolveUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { callBot, miniAppLink } from "@/lib/telegram/bot";
import { INVITE_CAPTION, INVITE_IMAGE, INVITE_THUMBNAIL, referralCode } from "@/lib/invitations";

export type PreparedInvitation = { ok: true; id: string; expiresAt: number } | { ok: false };
/** Called only after an authenticated player presses Invite. Never sends a chat message. */
export async function prepareInvitation(token: string | null): Promise<PreparedInvitation> {
  try {
    const user = await resolveUser(token);
    if (!user || user.is_guest || !config.botToken || !config.botUsername) return { ok: false };
    const id = Number(user.telegram_id);
    const code = referralCode(id);
    if (!code) return { ok: false };
    const base = new URL(config.appUrl);
    if (base.protocol !== "https:" || base.username || base.password) return { ok: false };
    const result = await callBot<{ id: string; expiration_date: number }>("savePreparedInlineMessage", {
      user_id: id,
      result: {
        type: "photo", id: `invite-${crypto.randomUUID()}`,
        photo_url: new URL(INVITE_IMAGE, base.origin).toString(),
        thumbnail_url: new URL(INVITE_THUMBNAIL, base.origin).toString(),
        photo_width: 1200, photo_height: 632,
        caption: INVITE_CAPTION,
        reply_markup: { inline_keyboard: [[{ text: "Открыть истории", url: miniAppLink(code) }]] },
      },
      allow_user_chats: true, allow_group_chats: true,
      allow_bot_chats: false, allow_channel_chats: false,
    });
    if (typeof result?.id !== "string" || !result.id || !Number.isFinite(result.expiration_date) || result.expiration_date * 1000 <= Date.now()) return { ok: false };
    return { ok: true, id: result.id, expiresAt: result.expiration_date * 1000 };
  } catch { return { ok: false }; }
}
