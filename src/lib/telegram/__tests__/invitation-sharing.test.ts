import {
  canShareInvitation,
  sharePreparedInvitation,
} from "../invitation-sharing";

test("old clients use the URL path without invoking unsupported APIs", async () => {
  const shareMessage = jest.fn();
  const app = { shareMessage, isVersionAtLeast: () => false };
  expect(canShareInvitation(null)).toBe(false);
  expect(await sharePreparedInvitation(app, "id")).toBe("unavailable");
  expect(shareMessage).not.toHaveBeenCalled();
});
test("successful share and explicit user cancellation are different outcomes", async () => {
  expect(
    await sharePreparedInvitation(
      { shareMessage: (_, callback) => callback?.(true) },
      "id",
    ),
  ).toBe("sent");
  expect(
    await sharePreparedInvitation(
      { shareMessage: (_, callback) => callback?.(false) },
      "id",
    ),
  ).toBe("cancelled");
});
test("SDK errors allow a fallback; missing callback only ends the spinner", async () => {
  expect(
    await sharePreparedInvitation(
      {
        shareMessage: () => {
          throw new Error("unsupported");
        },
      },
      "id",
    ),
  ).toBe("unavailable");
  jest.useFakeTimers();
  const pending = sharePreparedInvitation(
    { shareMessage: () => undefined },
    "id",
  );
  jest.advanceTimersByTime(60_000);
  expect(await pending).toBe("cancelled");
  jest.useRealTimers();
});

test.each([
  ["USER_DECLINED", "cancelled"],
  ["MESSAGE_SEND_FAILED", "failed"],
  ["MESSAGE_EXPIRED", "failed"],
  ["UNKNOWN_ERROR", "failed"],
  ["UNSUPPORTED", "unavailable"],
])(
  "native error %s is reported as %s after callback(false)",
  async (error, expected) => {
    const listeners = new Map<string, (data: { error: string }) => void>();
    const app = {
      onEvent: jest.fn(
        (name: string, callback: (data: { error: string }) => void) => {
          listeners.set(name, callback);
        },
      ),
      offEvent: jest.fn((name: string) => {
        listeners.delete(name);
      }),
      shareMessage: (_id: string, callback?: (sent: boolean) => void) => {
        callback?.(false);
        listeners.get("shareMessageFailed")?.({ error });
      },
    };
    expect(await sharePreparedInvitation(app, "fixture-id")).toBe(expected);
    expect(listeners.size).toBe(0);
  },
);

test("timeout removes native listeners and a late event cannot change the result", async () => {
  jest.useFakeTimers();
  try {
    let failure: ((data: { error: string }) => void) | undefined;
    const offEvent = jest.fn();
    const result = sharePreparedInvitation(
      {
        shareMessage: () => undefined,
        onEvent: (_name, handler) => {
          failure = handler;
        },
        offEvent,
      },
      "fixture-id",
    );
    jest.advanceTimersByTime(60_000);
    failure?.({ error: "MESSAGE_SEND_FAILED" });
    expect(await result).toBe("cancelled");
    expect(offEvent).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
