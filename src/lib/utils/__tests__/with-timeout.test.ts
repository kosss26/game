import { withTimeout } from "../with-timeout";

describe("bounded startup requests", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("returns a response and cancels its deadline", async () => {
    await expect(withTimeout(Promise.resolve("signed in"), 15000)).resolves.toBe("signed in");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("exposes a network failure without waiting for the deadline", async () => {
    await expect(withTimeout(Promise.reject(new Error("offline")), 15000)).rejects.toThrow("offline");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("times out a connection that never answers", async () => {
    const result = withTimeout(new Promise(() => {}), 15000);
    const assertion = expect(result).rejects.toThrow("timed out");
    await jest.advanceTimersByTimeAsync(15000);
    await assertion;
  });

  it("ignores a late response after timeout", async () => {
    let complete!: (value: string) => void;
    const result = withTimeout(new Promise<string>(resolve => { complete = resolve; }), 15000);
    const assertion = expect(result).rejects.toThrow("timed out");
    await jest.advanceTimersByTimeAsync(15000);
    complete("late session");
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });
});
