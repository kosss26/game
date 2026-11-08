import { computeAccess, canPlay } from "../access";
import type { Day } from "@/lib/types/database";

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 4, 12);

function day(n: number, extra: Partial<Day> = {}): Day {
  return {
    id: `d${n}`,
    story_id: "s",
    day_number: n,
    title: `День ${n}`,
    unlock_at: null,
    estimated_minutes: 10,
    status: "published",
    meta: { wait_hours: 12 },
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

const base = { now: NOW, defaultWaitHours: 12, purchases: [] as { product: "skip_day" | "season_pass"; day_number: number | null }[] };

describe("computeAccess", () => {
  it("бесплатный режим: следующая глава сразу после завершения, но по порядку", () => {
    const r = computeAccess({
      ...base,
      freeAccess: true,
      days: [day(1), day(2), day(3)],
      progresses: [{ day_id: "d1", completed: true, completed_at: new Date(NOW - 60_000).toISOString() }],
    });
    expect(r.map(d => d.status)).toEqual(["completed", "available", "locked"]);
  });

  it("новый игрок: день 1 доступен, остальные закрыты", () => {
    const r = computeAccess({ ...base, days: [day(1), day(2), day(3)], progresses: [] });
    expect(r.map(d => d.status)).toEqual(["available", "locked", "locked"]);
  });

  it("после завершения дня — ожидание с таймером", () => {
    const r = computeAccess({
      ...base,
      days: [day(1), day(2)],
      progresses: [{ day_id: "d1", completed: true, completed_at: new Date(NOW - 2 * H).toISOString() }],
    });
    expect(r[0].status).toBe("completed");
    expect(r[1]).toMatchObject({ status: "waiting", skippable: true, unlocksAt: new Date(NOW + 10 * H).toISOString() });
  });

  it("ожидание прошло — доступен", () => {
    const r = computeAccess({
      ...base,
      days: [day(1), day(2)],
      progresses: [{ day_id: "d1", completed: true, completed_at: new Date(NOW - 13 * H).toISOString() }],
    });
    expect(r[1].status).toBe("available");
  });

  it("пропуск дня и сезонный пропуск снимают ожидание", () => {
    const progresses = [{ day_id: "d1", completed: true, completed_at: new Date(NOW - H).toISOString() }];
    expect(computeAccess({ ...base, days: [day(1), day(2)], progresses, purchases: [{ product: "skip_day", day_number: 2 }] })[1].status).toBe("available");
    expect(computeAccess({ ...base, days: [day(1), day(2)], progresses, purchases: [{ product: "season_pass", day_number: null }] })[1].status).toBe("available");
    expect(computeAccess({ ...base, days: [day(1), day(2)], progresses, purchases: [{ product: "skip_day", day_number: 3 }] })[1].status).toBe("waiting");
  });

  it("глобальная дата релиза не обходится пропуском", () => {
    const r = computeAccess({
      ...base,
      days: [day(1), day(2, { unlock_at: new Date(NOW + 24 * H).toISOString() })],
      progresses: [{ day_id: "d1", completed: true, completed_at: new Date(NOW - 20 * H).toISOString() }],
      purchases: [{ product: "season_pass", day_number: null }],
    });
    expect(r[1]).toMatchObject({ status: "not_released", skippable: false });
  });

  it("черновики не показываются; начатый день — in_progress", () => {
    const r = computeAccess({ ...base, days: [day(1), day(2, { status: "draft" })], progresses: [{ day_id: "d1", completed: false, completed_at: null }] });
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe("in_progress");
    expect(canPlay(r[0])).toBe(true);
  });

  it("админ видит всё", () => {
    const r = computeAccess({ ...base, isAdmin: true, days: [day(1), day(2), day(3)], progresses: [] });
    expect(r.every(canPlay)).toBe(true);
  });
});

describe("waitHours", () => {
  test("первая глава и пропуск не ждут, остальные — по своему ожиданию", () => {
    const days = [day(1), day(2), day(3, { meta: null })];
    const r = computeAccess({ days, progresses: [], purchases: [], now: NOW, defaultWaitHours: 8 });
    expect(r.map(d => d.waitHours)).toEqual([0, 12, 8]);
    const pass = computeAccess({ days, progresses: [], purchases: [{ product: "season_pass", day_number: null }], now: NOW, defaultWaitHours: 8 });
    expect(pass.map(d => d.waitHours)).toEqual([0, 0, 0]);
  });
});
