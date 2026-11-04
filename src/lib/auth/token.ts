import "server-only";
import crypto from "crypto";
import { sessionSecret } from "@/lib/config";

export interface TokenPayload {
  /** user id */
  uid?: string;
  /** признак админ-сессии по паролю */
  adm?: boolean;
  /** срок действия, ms epoch */
  exp: number;
}

const b64 = (buf: Buffer) => buf.toString("base64url");

export function signToken(payload: TokenPayload): string {
  const body = b64(Buffer.from(JSON.stringify(payload)));
  const sig = b64(crypto.createHmac("sha256", sessionSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token: string | null | undefined): TokenPayload | null {
  if (!token || typeof token !== "string" || token.length > 2048) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
