import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { monitorReport, type MonitorReport } from "@/lib/monitoring/health";

export const dynamic = "force-dynamic";

/** Повторные запросы в течение 20 секунд получают тот же отчёт — проверка не нагружает Telegram */
let cached: { key: number; at: number; report: MonitorReport } | null = null;
const CACHE_MS = 20_000;

function authorized(header: string | null): boolean {
  const secret = process.env.MONITOR_SECRET || "";
  if (secret.length < 16 || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7)), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Состояние для внешнего мониторинга (Cloudflare Worker по расписанию).
 * GET /api/monitor?window=5  с заголовком Authorization: Bearer MONITOR_SECRET
 * window — за сколько минут показывать новые ошибки (по умолчанию 5).
 */
export async function GET(req: Request) {
  if (!process.env.MONITOR_SECRET) return NextResponse.json({ error: "monitoring disabled" }, { status: 404 });
  if (!authorized(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = Number(new URL(req.url).searchParams.get("window") || 5);
  const windowMinutes = Number.isFinite(raw) ? Math.min(1440, Math.max(1, Math.round(raw))) : 5;
  if (!cached || cached.key !== windowMinutes || Date.now() - cached.at > CACHE_MS) {
    cached = { key: windowMinutes, at: Date.now(), report: await monitorReport(windowMinutes) };
  }
  return NextResponse.json(cached.report, { headers: { "Cache-Control": "no-store" } });
}
