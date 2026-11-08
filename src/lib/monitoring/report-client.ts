/** Отправка ошибки браузера в журнал. Не больше 5 отчётов за загрузку страницы. */
let sent = 0;
const seen = new Set<string>();

export function reportClientError(error: unknown, kind: string): void {
  try {
    if (typeof window === "undefined" || sent >= 5) return;
    const e = error as { message?: string; stack?: string; reason?: unknown } | null;
    const message = e?.message || (typeof error === "string" ? error : "") || String(error);
    const key = `${kind}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    sent++;
    const body = JSON.stringify({ message, stack: e?.stack, url: window.location.href, kind }).slice(0, 8_000);
    const url = "/api/client-error";
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
    void fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => undefined);
  } catch {
    /* отчёт об ошибке не должен порождать новые */
  }
}

/** После обновления сервера у открытой вкладки нет старых файлов — нужна перезагрузка */
export function isStaleBuildError(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  return e?.name === "ChunkLoadError" || /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(e?.message || "");
}
