import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
let windowStart = 0;
let count = 0;
const phases = new Set(["document", "ready", "hydrated", "recovery"]);

/** Ephemeral launch correlation only. Never accept URLs, initData or user IDs. */
export async function POST(request: Request) {
  const now = Date.now();
  if (now - windowStart > 60_000) { windowStart = now; count = 0; }
  if (++count > 600) return new NextResponse(null, { status: 429 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new NextResponse(null, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > 512) return new NextResponse(null, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new NextResponse(null, { status: 400 });
  let text = "";
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 512) { await reader.cancel(); return new NextResponse(null, { status: 413 }); }
      text += decoder.decode(part.value, { stream: true });
    }
    const data = JSON.parse(text);
    if (!/^[a-z0-9-]{8,40}$/.test(data.id) || !phases.has(data.phase)) return new NextResponse(null, { status: 400 });
    console.info("[polnoch-startup]", JSON.stringify({ id: data.id, phase: data.phase, bridge: data.bridge === true, elapsed: Math.min(300000, Math.max(0, Number(data.elapsed) || 0)) }));
    return new NextResponse(null, { status: 204 });
  } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
}
