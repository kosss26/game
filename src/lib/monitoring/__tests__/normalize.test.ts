import { normalizeError, stableText } from "../normalize";

describe("normalizeError", () => {
  test("одинаковая ошибка с разными числами и чанками склеивается", () => {
    const a = normalizeError({ source: "client", message: "Cannot read properties of undefined (reading 'x') at 12", stack: "TypeError\n    at f (https://site/_next/static/chunks/app/page-1fad676c7f592b9e.js:1:2820)" });
    const b = normalizeError({ source: "client", message: "Cannot read properties of undefined (reading 'x') at 97", stack: "TypeError\n    at f (https://site/_next/static/chunks/app/page-128e0b5669c7813d.js:1:991)" });
    expect(a?.fingerprint).toBe(b?.fingerprint);
  });
  test("разные источники — разные отпечатки", () => {
    expect(normalizeError({ source: "client", message: "boom" })?.fingerprint).not.toBe(normalizeError({ source: "server", message: "boom" })?.fingerprint);
  });
  test.each(["Script error.", "ResizeObserver loop limit exceeded"])("шум отбрасывается: %s", message => {
    expect(normalizeError({ source: "client", message })).toBeNull();
  });
  test("URL без параметров (там может быть токен), длинные поля обрезаются", () => {
    const n = normalizeError({ source: "client", message: "x".repeat(900), url: "https://site/play/1?tgWebAppData=secret#hash" })!;
    expect(n.detail.url).toBe("/play/1");
    expect(n.message.length).toBeLessThanOrEqual(300);
  });
  test("не строки не ломают нормализацию", () => {
    expect(normalizeError({ source: "server", message: { a: 1 }, stack: 42 })?.message).toBe("Без текста");
  });
  test("stableText убирает id и числа", () => expect(stableText("user 123e4567-e89b-12d3-a456-426614174000 failed 42 times")).toBe("user <id> failed <n> times"));
});
