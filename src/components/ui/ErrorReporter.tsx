"use client";
import { useEffect } from "react";
import { reportClientError, isStaleBuildError } from "@/lib/monitoring/report-client";

const RELOAD_KEY = "polnoch_stale_reload";

/** Глобальные ошибки браузера → журнал ошибок; устаревшая сборка → одна перезагрузка */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => handle(event.error || event.message, "window.error");
    const onRejection = (event: PromiseRejectionEvent) => handle(event.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}

function handle(error: unknown, kind: string) {
  if (isStaleBuildError(error) && reloadOnce()) return;
  reportClientError(error, kind);
}

/** true — перезагрузка запущена; повторно за 30 секунд не перезагружаем, чтобы не зациклиться */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
