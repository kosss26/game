/**
 * Нормализация ошибок для журнала: одинаковые ошибки склеиваются по отпечатку,
 * мусор (ошибки расширений браузера, «Script error.») отбрасывается.
 * Чистые функции — без доступа к базе, покрыты тестами.
 */
import { createHash } from "crypto";

export type ErrorSource = "client" | "server";

export interface RawError {
  source: ErrorSource;
  message?: unknown;
  stack?: unknown;
  url?: unknown;
  route?: unknown;
  userAgent?: unknown;
}

export interface NormalizedError {
  source: ErrorSource;
  message: string;
  fingerprint: string;
  detail: { stack?: string; url?: string; route?: string; userAgent?: string };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Ошибки, которые не про наше приложение */
const NOISE = [
  /^script error\.?$/i,
  /ResizeObserver loop/i,
  /extension:\/\//i,
  /^Non-Error promise rejection captured/i,
];

/** Убирает из текста то, что меняется от раза к разу: числа, id, хэши чанков */
export function stableText(text: string): string {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b[0-9a-f]{12,}\b/gi, "<hash>")
    .replace(/\d+/g, "<n>")
    .trim();
}

/** Первый кадр стека, указывающий на наш код, без номеров строк */
function topFrame(stack: string): string {
  const line = stack.split("\n").map(l => l.trim()).find(l => /^at\s|@/.test(l)) || "";
  return stableText(line.replace(/\?[^\s:)]*/g, "")).slice(0, 200);
}

export function normalizeError(raw: RawError): NormalizedError | null {
  const message = str(raw.message, 500).trim() || "Без текста";
  const stack = str(raw.stack, 4000);
  if (NOISE.some(re => re.test(message) || (stack && re.test(stack)))) return null;
  const firstLine = message.split("\n")[0];
  const fingerprint = createHash("sha1").update(`${raw.source}|${stableText(firstLine)}|${topFrame(stack)}`).digest("hex").slice(0, 16);
  const detail: NormalizedError["detail"] = {};
  if (stack) detail.stack = stack;
  const url = str(raw.url, 300);
  if (url) {
    // Только путь: в параметрах Mini App бывают данные авторизации
    let path = url.replace(/[?#].*$/, "");
    try { path = new URL(path).pathname; } catch { /* уже путь */ }
    detail.url = path;
  }
  const route = str(raw.route, 200);
  if (route) detail.route = route;
  const ua = str(raw.userAgent, 300);
  if (ua) detail.userAgent = ua;
  return { source: raw.source, message: firstLine.slice(0, 300), fingerprint, detail };
}
