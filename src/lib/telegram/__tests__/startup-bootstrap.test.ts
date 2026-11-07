import vm from "node:vm";
import { STARTUP_BOOTSTRAP } from "../startup-bootstrap";

function harness(
  options: {
    bridge?: boolean;
    hydratedBeforeBoot?: boolean;
    store?: Map<string, string>;
    storageFails?: boolean;
    path?: string;
  } = {},
) {
  const events = new Map<string, (event?: any) => void>();
  const docEvents = new Map<string, () => void>();
  const box = { hidden: true };
  const message = { textContent: "" };
  const button = { addEventListener: jest.fn() };
  const elements = {
    "polnoch-startup-recovery": box,
    "polnoch-startup-message": message,
    "polnoch-startup-retry": button,
  };
  const document = {
    visibilityState: "visible",
    getElementById: (id: keyof typeof elements) => elements[id],
    addEventListener: (event: string, handler: () => void) =>
      docEvents.set(event, handler),
  };
  const reload = jest.fn();
  const bridge = { postEvent: jest.fn() };
  const window: any = {
    addEventListener: (event: string, handler: (event?: any) => void) =>
      events.set(event, handler),
  };
  window.__polnochHydrated=options.hydratedBeforeBoot===true;
  window.parent = window;
  if (options.bridge !== false) window.TelegramWebviewProxy = bridge;
  const store = options.store || new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => {
      if (options.storageFails) throw Error("blocked");
      return store.get(key) || null;
    },
    setItem: (key: string, value: string) => {
      if (options.storageFails) throw Error("blocked");
      store.set(key, value);
    },
  };
  vm.runInNewContext(STARTUP_BOOTSTRAP, {
    window,
    document,
    location: {
      pathname: options.path || "/",
      href: `https://stories.invalid${options.path || "/"}#tgWebAppData=fixture`,
      replace: reload,
      reload,
    },
    sessionStorage,
    setTimeout,
    clearTimeout,
    Date,
    URL,
  });
  return {
    window,
    document,
    bridge,
    events,
    docEvents,
    box,
    message,
    button,
    reload,
    store,
  };
}
const resourceError = {
  target: {
    tagName: "SCRIPT",
    src: "https://stories.invalid/_next/static/chunks/missing.js",
  },
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("native ready does not require React, stylesheets or Telegram SDK", () => {
  const h = harness();
  expect(h.bridge.postEvent).toHaveBeenCalledWith(
    "web_app_ready",
    JSON.stringify(""),
  );
  expect(h.window.__polnochBoot.hydrated).toBe(false);
});

test("the native handshake is not gated on document visibility", () => {
  const h = harness();
  h.document.visibilityState = "hidden";
  h.events.get("pageshow")!();
  expect(h.bridge.postEvent).toHaveBeenCalledTimes(2);
});

test("a bridge injected late receives a retry and resumed pages signal ready again", () => {
  const h = harness({ bridge: false });
  jest.advanceTimersByTime(500);
  h.window.TelegramWebviewProxy = h.bridge;
  jest.advanceTimersByTime(500);
  expect(h.bridge.postEvent).toHaveBeenCalledTimes(1);
  h.events.get("pageshow")!();
  h.docEvents.get("visibilitychange")!();
  expect(h.bridge.postEvent).toHaveBeenCalledTimes(3);
});

test("stalled startup exposes a working reload control without React", () => {
  const h = harness();
  jest.advanceTimersByTime(12000);
  expect(h.box.hidden).toBe(false);
  const click = h.button.addEventListener.mock.calls.find(
    ([event]) => event === "click",
  )![1];
  click();
  expect(h.reload).toHaveBeenCalledTimes(1);
  const refreshed = new URL(h.reload.mock.calls[0][0]);
  expect(refreshed.searchParams.has("_pl_boot")).toBe(true);
  expect(refreshed.hash).toBe("#tgWebAppData=fixture");
});

test("hydration hides recovery and disables the startup watchdog", () => {
  const h = harness();
  jest.advanceTimersByTime(12000);
  expect(h.box.hidden).toBe(false);
  h.events.get("polnoch:hydrated")!();
  expect(h.box.hidden).toBe(true);
  h.events.get("error")!(resourceError);
  jest.advanceTimersByTime(20000);
  expect(h.box.hidden).toBe(true);
  expect(h.reload).not.toHaveBeenCalled();
});

test("a failed app chunk retries only once across reloads", () => {
  const first = harness();
  first.events.get("error")!(resourceError);
  jest.advanceTimersByTime(400);
  expect(first.reload).toHaveBeenCalledTimes(1);
  const second = harness({ store: first.store });
  second.events.get("error")!(resourceError);
  jest.advanceTimersByTime(400);
  expect(second.reload).not.toHaveBeenCalled();
  expect(second.box.hidden).toBe(false);
});

test("blocked storage never creates an automatic reload loop", () => {
  const h = harness({ storageFails: true });
  h.events.get("error")!(resourceError);
  jest.advanceTimersByTime(400);
  expect(h.reload).not.toHaveBeenCalled();
  expect(h.box.hidden).toBe(false);
});

test("author forms are not reloaded automatically and public invitations need no app runtime", () => {
  const admin = harness({ path: "/admin/stories/new" });
  admin.events.get("error")!(resourceError);
  jest.advanceTimersByTime(400);
  expect(admin.reload).not.toHaveBeenCalled();
  expect(admin.box.hidden).toBe(false);
  const invite = harness({ path: "/invite/ref_123" });
  jest.advanceTimersByTime(12000);
  expect(invite.box.hidden).toBe(true);
});


test("late bootstrap recognizes hydration that happened before its event listener", () => {
  const h=harness({hydratedBeforeBoot:true});
  expect(h.window.__polnochBoot.hydrated).toBe(true);
  jest.advanceTimersByTime(20000);
  expect(h.box.hidden).toBe(true);
  expect(h.reload).not.toHaveBeenCalled();
});
