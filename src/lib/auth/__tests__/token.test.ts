import { signToken, verifyToken } from "../token";

describe("session tokens", () => {
  it("подписывает и проверяет", () => {
    const t = signToken({ uid: "u1", exp: Date.now() + 1000 });
    expect(verifyToken(t)?.uid).toBe("u1");
  });
  it("отклоняет подмену и истёкшие", () => {
    const t = signToken({ uid: "u1", exp: Date.now() + 1000 });
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "admin", exp: Date.now() + 1000 })).toString("base64url");
    expect(verifyToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyToken(`${body}.xx`)).toBeNull();
    expect(verifyToken(signToken({ uid: "u1", exp: Date.now() - 1 }))).toBeNull();
    expect(verifyToken("garbage")).toBeNull();
    expect(verifyToken(null)).toBeNull();
  });
});
