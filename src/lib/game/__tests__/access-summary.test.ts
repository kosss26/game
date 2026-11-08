import { accessSummary, type AccessSummaryInput } from "../access-summary";

const base: AccessSummaryInput = {
  days: [{ status: "available", waitHours: 0 }, { status: "locked", waitHours: 12 }, { status: "locked", waitHours: 12 }],
  storyFree: false, freeAccess: false, hasPass: false, paymentsEnabled: false,
  prices: { skipDay: 15, seasonPass: 99 }, finished: false,
};

describe("accessSummary", () => {
  test("ожидание без оплаты (гость)", () => expect(accessSummary(base)).toBe("Каждая следующая глава открывается через 12 часов после предыдущей."));
  test("ожидание и цены", () => expect(accessSummary({ ...base, paymentsEnabled: true })).toBe("Каждая следующая глава открывается через 12 часов после предыдущей. Можно не ждать: глава — 15 ⭐, вся история — 99 ⭐."));
  test("разное ожидание — диапазон", () => expect(accessSummary({ ...base, days: [{ status: "locked", waitHours: 8 }, { status: "locked", waitHours: 21 }] })).toContain("через 8–21 час после"));
  test("одна глава ждёт 1 час", () => expect(accessSummary({ ...base, days: [{ status: "locked", waitHours: 1 }] })).toContain("через 1 час после"));
  test.each([
    ["бесплатная история", { storyFree: true }],
    ["пропуск куплен", { hasPass: true }],
    ["история пройдена", { finished: true }],
    ["ждать нечего", { days: [{ status: "completed", waitHours: 12 }, { status: "available", waitHours: 0 }] }],
  ] as const)("без строки: %s", (_, extra) => expect(accessSummary({ ...base, ...extra } as AccessSummaryInput)).toBeNull());
  test("бесплатный режим", () => expect(accessSummary({ ...base, freeAccess: true })).toBe("Сейчас все главы открываются сразу, без ожидания."));
});
