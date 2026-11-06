/** Native Telegram picker. A failed send is different from user cancellation. */
export interface NativeInvitationApp {
  isVersionAtLeast?: (version: string) => boolean;
  shareMessage?: (id: string, callback?: (sent: boolean) => void) => void;
  onEvent?: (
    event: string,
    callback: (data: { error?: string }) => void,
  ) => void;
  offEvent?: (
    event: string,
    callback: (data: { error?: string }) => void,
  ) => void;
}
export type InvitationShareResult =
  | "sent"
  | "cancelled"
  | "unavailable"
  | "failed";

export function canShareInvitation(app: NativeInvitationApp | null): boolean {
  return (
    !!app?.shareMessage &&
    (!app.isVersionAtLeast || app.isVersionAtLeast("8.0"))
  );
}
export function sharePreparedInvitation(
  app: NativeInvitationApp,
  id: string,
): Promise<InvitationShareResult> {
  return new Promise((resolve) => {
    if (!canShareInvitation(app)) {
      resolve("unavailable");
      return;
    }
    let settled = false;
    let listening = false;
    const finish = (result: InvitationShareResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (listening) {
        try {
          app.offEvent!("shareMessageFailed", onFailure);
        } catch {
          /* old SDK */
        }
      }
      resolve(result);
    };
    const onFailure = (event: { error?: string }) => {
      if (event.error === "USER_DECLINED") finish("cancelled");
      else if (event.error === "UNSUPPORTED") finish("unavailable");
      else finish("failed");
    };
    const timer = setTimeout(() => finish("cancelled"), 60_000);
    try {
      if (app.onEvent && app.offEvent) {
        app.onEvent("shareMessageFailed", onFailure);
        listening = true;
      }
      app.shareMessage!(id, (sent) => {
        if (sent) finish("sent");
        // Official SDK calls callback(false) BEFORE emitting shareMessageFailed.
        // Wait one microtask so that USER_DECLINED and send failure can be told apart.
        else queueMicrotask(() => finish("cancelled"));
      });
    } catch {
      finish("unavailable");
    }
  });
}
