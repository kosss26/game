"use client";

import { useRef, useState } from "react";
import { prepareInvitation, type PreparedInvitation } from "@/lib/actions/invitations";
import { INVITE_SHARE_TEXT } from "@/lib/invitations";
import { useApp } from "./TelegramProvider";
import { canShareInvitation, sharePreparedInvitation } from "./invitation-sharing";

export function useInviteFriend() {
  const { webApp, token, share, haptic } = useApp();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const cached = useRef<{ token: string | null; value: Extract<PreparedInvitation, {ok: true}> } | null>(null);
  const invite = async (url: string) => {
    if (!url || pending.current) return;
    pending.current = true; setBusy(true); haptic("select");
    try {
      if (canShareInvitation(webApp)) {
        const prepared = cached.current?.token === token && cached.current.value.expiresAt > Date.now() + 10_000 ? cached.current.value : await prepareInvitation(token);
        if (prepared.ok) {
          cached.current = { token, value: prepared };
          const result = await sharePreparedInvitation(webApp!, prepared.id);
          if (result !== "unavailable") return;
        }
      }
      share(url, INVITE_SHARE_TEXT);
    } catch { share(url, INVITE_SHARE_TEXT); }
    finally { pending.current = false; setBusy(false); }
  };
  return { invite, busy };
}
