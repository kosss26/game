import { setupTelegramViewport, type TelegramViewport } from "../viewport";

function fixture(version = "8.0") {
  const listeners = new Map<string, () => void>();
  const values = new Map<string, string>();
  const tg: TelegramViewport = {
    safeAreaInset: { top: 47, bottom: 34, left: 0, right: 0 },
    contentSafeAreaInset: { top: 56, bottom: 0, left: 0, right: 0 },
    isFullscreen: false,
    isVersionAtLeast: jest.fn(v => Number(version) >= Number(v)),
    requestFullscreen: jest.fn(),
    expand: jest.fn(),
    onEvent: jest.fn((event, callback) => { listeners.set(event, callback); }),
    offEvent: jest.fn((event, callback) => { if (listeners.get(event) === callback) listeners.delete(event); }),
  };
  const style = {
    setProperty: jest.fn((key: string, value: string | null) => { values.set(key, value || ""); }),
    removeProperty: jest.fn((key: string) => { const value = values.get(key) || ""; values.delete(key); return value; }),
  };
  return { tg, style, listeners, values };
}

describe("Telegram fullscreen", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
  it("expands first and requests fullscreen only after a native viewport response", () => {
    const { tg, style, values, listeners } = fixture();
    const cleanup = setupTelegramViewport(tg, style);
    expect(tg.expand).toHaveBeenCalledTimes(1);
    expect(tg.requestFullscreen).not.toHaveBeenCalled();
    listeners.get("viewportChanged")!();
    jest.advanceTimersByTime(300);
    expect(tg.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(values.get("--tg-content-safe-top")).toBe("103px");
    expect(values.get("--tg-content-safe-bottom")).toBe("34px");
    tg.isFullscreen = true;
    listeners.get("fullscreenChanged")!();
    tg.isFullscreen = false;
    listeners.get("fullscreenChanged")!();
    expect(tg.requestFullscreen).toHaveBeenCalledTimes(1); // Respect a user's exit.
    cleanup();
    expect(listeners.size).toBe(0);
    expect(values.size).toBe(0);
  });

  it("keeps expanded mode on old clients and when the method is absent", () => {
    for (const version of ["7.10", "8.0"]) {
      const { tg, style } = fixture(version);
      if (version === "8.0") delete tg.requestFullscreen;
      setupTelegramViewport(tg, style);
      expect(tg.expand).toHaveBeenCalledTimes(1);
      if (tg.requestFullscreen) expect(tg.requestFullscreen).not.toHaveBeenCalled();
    }
  });

  it("does not request fullscreen again when already in it", () => {
    const { tg, style } = fixture();
    tg.isFullscreen = true;
    setupTelegramViewport(tg, style);
    expect(tg.requestFullscreen).not.toHaveBeenCalled();
  });

  it("keeps startup usable when fullscreen throws or is rejected asynchronously", () => {
    const { tg, style, listeners } = fixture();
    tg.requestFullscreen = jest.fn(() => { throw new Error("unsupported"); });
    expect(() => setupTelegramViewport(tg, style)).not.toThrow();
    listeners.get("viewportChanged")!();
    jest.advanceTimersByTime(300);
    listeners.get("fullscreenFailed")!();
    expect(tg.expand).toHaveBeenCalledTimes(2);
    expect(tg.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("installs listeners before explicitly probing the native viewport", () => {
    const { tg, style, listeners } = fixture();
    setupTelegramViewport(tg, style, () => {
      expect(listeners.has("viewportChanged")).toBe(true);
      listeners.get("viewportChanged")!();
      listeners.get("viewportChanged")!();
    });
    expect(tg.requestFullscreen).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    expect(tg.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("does not force fullscreen without native acknowledgement and cancels pending transitions on cleanup", () => {
    const { tg, style, listeners } = fixture();
    const cleanup = setupTelegramViewport(tg, style);
    jest.advanceTimersByTime(10000);
    expect(tg.requestFullscreen).not.toHaveBeenCalled();
    listeners.get("viewportChanged")!();
    cleanup();
    jest.advanceTimersByTime(1000);
    expect(tg.requestFullscreen).not.toHaveBeenCalled();
  });

  it("updates all four edges when native safe areas change or rotate", () => {
    const { tg, style, listeners, values } = fixture();
    setupTelegramViewport(tg, style);
    tg.safeAreaInset = { top: 0, bottom: 21, left: 47, right: 0 };
    tg.contentSafeAreaInset = { top: 56, bottom: 0, left: 0, right: 10 };
    listeners.get("safeAreaChanged")!();
    listeners.get("contentSafeAreaChanged")!();
    expect(Object.fromEntries(values)).toEqual({
      "--tg-content-safe-top": "56px",
      "--tg-content-safe-bottom": "21px",
      "--tg-content-safe-left": "47px",
      "--tg-content-safe-right": "10px",
    });
  });
});
