import crypto from "crypto";
import { verifyTelegramWebAppData } from "../verify";

const BOT = "123456:TEST-TOKEN";

function makeInitData(fields: Record<string, string>, token = BOT): string {
  const check = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto.createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe("verifyTelegramWebAppData", () => {
  const now = Date.now();
  const user = JSON.stringify({ id: 42, first_name: "Костя", username: "k" });

  it("принимает корректные данные и start_param", () => {
    const init = makeInitData({ auth_date: String(Math.floor(now / 1000)), user, start_param: "ref_7" });
    const r = verifyTelegramWebAppData(init, BOT, now);
    expect(r?.user?.id).toBe(42);
    expect(r?.start_param).toBe("ref_7");
  });

  it("отклоняет подделку", () => {
    const init = makeInitData({ auth_date: String(Math.floor(now / 1000)), user }, "other:token");
    expect(verifyTelegramWebAppData(init, BOT, now)).toBeNull();
    const tampered = makeInitData({ auth_date: String(Math.floor(now / 1000)), user }).replace("42", "43");
    expect(verifyTelegramWebAppData(tampered, BOT, now)).toBeNull();
  });

  it("отклоняет устаревшие данные", () => {
    const init = makeInitData({ auth_date: String(Math.floor(now / 1000) - 3 * 86400), user });
    expect(verifyTelegramWebAppData(init, BOT, now)).toBeNull();
  });

  it("без токена бота — null", () => {
    expect(verifyTelegramWebAppData("a=b", "", now)).toBeNull();
  });
});
