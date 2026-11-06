/** Native Telegram picker. Cancellation never opens another picker. */
export interface NativeInvitationApp {
  isVersionAtLeast?: (version: string) => boolean;
  shareMessage?: (id: string, callback?: (sent: boolean) => void) => void;
}
export function canShareInvitation(app: NativeInvitationApp | null): boolean {
  return !!app?.shareMessage && (!app.isVersionAtLeast || app.isVersionAtLeast("8.0"));
}
export function sharePreparedInvitation(app: NativeInvitationApp, id: string): Promise<"sent" | "cancelled" | "unavailable"> {
  return new Promise(resolve => {
    if (!canShareInvitation(app)) { resolve("unavailable"); return; }
    const timer = setTimeout(() => resolve("cancelled"), 60_000);
    try { app.shareMessage!(id, sent => { clearTimeout(timer); resolve(sent ? "sent" : "cancelled"); }); }
    catch { clearTimeout(timer); resolve("unavailable"); }
  });
}
