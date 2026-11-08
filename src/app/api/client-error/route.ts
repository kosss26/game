import { recordError } from "@/lib/monitoring/errors";

export const dynamic = "force-dynamic";

const MAX_BODY = 8_192;
const PER_MINUTE = 30;
const hits = new Map<string, { n: number; reset: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    if (hits.size > 5_000) hits.clear();
    hits.set(ip, { n: 1, reset: now + 60_000 });
    return false;
  }
  return ++h.n > PER_MINUTE;
}

/** Приём ошибок из браузера игрока (sendBeacon / fetch keepalive). Всегда 204: клиенту нечего делать с ответом. */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  if (limited(ip)) return new Response(null, { status: 204 });
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return new Response(null, { status: 204 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 204 });
  }
  await recordError({ source: "client", message: body.message, stack: body.stack, url: body.url, userAgent: req.headers.get("user-agent") });
  return new Response(null, { status: 204 });
}
