import { canShareInvitation, sharePreparedInvitation } from "../invitation-sharing";

test("old clients use the URL path without invoking unsupported APIs", async () => {
  const shareMessage=jest.fn();const app={shareMessage,isVersionAtLeast:()=>false};
  expect(canShareInvitation(null)).toBe(false);expect(await sharePreparedInvitation(app,"id")).toBe("unavailable");expect(shareMessage).not.toHaveBeenCalled();
});
test("successful share and explicit user cancellation are different outcomes", async () => {
  expect(await sharePreparedInvitation({shareMessage:(_,callback)=>callback?.(true)},"id")).toBe("sent");
  expect(await sharePreparedInvitation({shareMessage:(_,callback)=>callback?.(false)},"id")).toBe("cancelled");
});
test("SDK errors allow a fallback; missing callback only ends the spinner", async () => {
  expect(await sharePreparedInvitation({shareMessage:()=>{throw new Error("unsupported");}},"id")).toBe("unavailable");
  jest.useFakeTimers();const pending=sharePreparedInvitation({shareMessage:()=>undefined},"id");jest.advanceTimersByTime(60_000);expect(await pending).toBe("cancelled");jest.useRealTimers();
});
