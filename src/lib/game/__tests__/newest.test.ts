import { newestStory } from "../newest";

const s = (id: string, created_at: string, sort_order: number) => ({ id, created_at, sort_order });

describe("newestStory", () => {
  test("одной пачкой: решает порядок в каталоге, а не порядок вставки", () => {
    const list = [s("old", "2026-11-01T10:00:00Z", 0), s("new", "2026-11-01T10:00:01Z", -5), s("mid", "2026-11-01T10:00:03Z", -2)];
    expect(newestStory(list)?.id).toBe("new");
  });
  test("разные даты: побеждает созданная позже, даже если выше в каталоге стоит старая", () => {
    const list = [s("pinned-old", "2026-10-01T10:00:00Z", -10), s("fresh", "2026-11-07T10:00:00Z", 0)];
    expect(newestStory(list)?.id).toBe("fresh");
  });
  test("пустой каталог", () => expect(newestStory([])).toBeUndefined());
});
