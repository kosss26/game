import { prepareInvitation } from "@/lib/actions/invitations";
import { resolveUser } from "@/lib/auth/session";
import { callBot } from "@/lib/telegram/bot";
import { config } from "@/lib/config";
import {
  publicInvitationUrl,
  referralCode,
  isInviteCode,
  INVITE_CAPTION,
  INVITE_PUBLIC_IMAGE,
  INVITE_PUBLIC_THUMBNAIL,
} from "../invitations";

jest.mock("@/lib/config", () => ({
  config: {
    botToken: "111:fixture",
    botUsername: "polnoch_bot",
    appShortName: "",
    appUrl: "https://stories.invalid",
  },
}));
jest.mock("@/lib/auth/session", () => ({ resolveUser: jest.fn() }));
jest.mock("@/lib/telegram/bot", () => ({
  ...jest.requireActual("@/lib/telegram/bot"),
  callBot: jest.fn(),
}));
const auth = jest.mocked(resolveUser),
  api = jest.mocked(callBot);
const user = {
  id: "fixture",
  telegram_id: 123,
  is_guest: false,
} as NonNullable<Awaited<ReturnType<typeof resolveUser>>>;
beforeEach(() => {
  auth.mockReset();
  api.mockReset();
  auth.mockResolvedValue(user);
  api.mockResolvedValue({
    id: "prepared-fixture",
    expiration_date: Math.floor(Date.now() / 1000) + 300,
  });
  config.appUrl = "https://stories.invalid";
});

test("referral links keep the code and reject invalid IDs, schemes and credentials", () => {
  expect(referralCode(123)).toBe("ref_123");
  for (const id of [0, -1, NaN, 1.2, 1e15]) expect(referralCode(id)).toBeNull();
  for (const code of ["ref_0", "ref_-1", "ref_123/else", "ref_123?x=1"])
    expect(isInviteCode(code)).toBe(false);
  expect(publicInvitationUrl("https://stories.invalid", "ref_123")).toBe(
    "https://stories.invalid/invite/ref_123",
  );
  expect(publicInvitationUrl("javascript:alert(1)", "ref_123")).toBeNull();
  expect(
    publicInvitationUrl("https://user:pass@stories.invalid", "ref_123"),
  ).toBeNull();
});
test("prepared photo belongs to authenticated player and preserves referral in CTA", async () => {
  expect(await prepareInvitation("token")).toMatchObject({
    ok: true,
    id: "prepared-fixture",
  });
  const [method, params] = api.mock.calls[0];
  expect(method).toBe("savePreparedInlineMessage");
  expect(params).toMatchObject({
    user_id: 123,
    allow_user_chats: true,
    allow_group_chats: true,
    allow_channel_chats: false,
    result: {
      type: "photo",
      photo_url: INVITE_PUBLIC_IMAGE,
      thumbnail_url: INVITE_PUBLIC_THUMBNAIL,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Открыть истории",
              url: "https://t.me/polnoch_bot?start=ref_123",
            },
          ],
        ],
      },
    },
  });
  expect(INVITE_CAPTION.length).toBeLessThanOrEqual(1024);
});
test("unauthenticated users and guests never call Telegram", async () => {
  auth.mockResolvedValueOnce(null);
  expect(await prepareInvitation(null)).toEqual({ ok: false });
  auth.mockResolvedValueOnce({ ...user, is_guest: true });
  expect(await prepareInvitation("guest")).toEqual({ ok: false });
  expect(api).not.toHaveBeenCalled();
});
test("insecure app origin, expired result or API failure falls back safely", async () => {
  config.appUrl = "http://localhost:3600";
  expect(await prepareInvitation("token")).toEqual({ ok: false });
  expect(api).not.toHaveBeenCalled();
  config.appUrl = "https://stories.invalid";
  api.mockResolvedValueOnce({ id: "old", expiration_date: 1 });
  expect(await prepareInvitation("token")).toEqual({ ok: false });
  api.mockRejectedValueOnce(new Error("upstream unavailable"));
  expect(await prepareInvitation("token")).toEqual({ ok: false });
});
