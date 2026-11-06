import { getStudioCatalog } from "../admin";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/supabase/server";

jest.mock("@/lib/auth/session", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({ db: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const authorize = jest.mocked(requireAdmin);
const database = jest.mocked(db);
function query(result: unknown) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return builder;
}

beforeEach(() => jest.resetAllMocks());

test("catalog summaries cannot access the database without admin authorization", async () => {
  authorize.mockRejectedValue(new Error("access denied"));
  await expect(getStudioCatalog()).rejects.toThrow("access denied");
  expect(database).not.toHaveBeenCalled();
});

test("catalog counts published chapters and finds the next draft without requesting scripts", async () => {
  authorize.mockResolvedValue();
  const stories = query({
    data: [
      { id: "story-a", title: "История" },
      { id: "story-b", title: "Без глав" },
    ],
    error: null,
  });
  const days = query({
    data: [
      {
        id: "one",
        story_id: "story-a",
        day_number: 1,
        title: "Первая",
        status: "published",
      },
      {
        id: "two",
        story_id: "story-a",
        day_number: 2,
        title: "Вторая",
        status: "draft",
      },
      {
        id: "three",
        story_id: "story-a",
        day_number: 3,
        title: "Третья",
        status: "draft",
      },
    ],
    error: null,
  });
  database.mockResolvedValue({
    from: (table: string) => (table === "stories" ? stories : days),
  } as never);
  const result = await getStudioCatalog();
  expect(result[0]).toMatchObject({
    chapters: 3,
    publishedChapters: 1,
    nextDraft: { id: "two", number: 2 },
  });
  expect(result[1]).toMatchObject({
    chapters: 0,
    publishedChapters: 0,
    nextDraft: null,
  });
  expect(days.select).toHaveBeenCalledWith(
    "id, story_id, day_number, title, status",
  );
});

test("database errors reach the error boundary instead of masquerading as an empty catalog", async () => {
  authorize.mockResolvedValue();
  const stories = query({ data: [], error: null });
  const days = query({
    data: null,
    error: { message: "database unavailable" },
  });
  database.mockResolvedValue({
    from: (table: string) => (table === "stories" ? stories : days),
  } as never);
  await expect(getStudioCatalog()).rejects.toThrow("database unavailable");
});
