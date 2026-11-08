"use client";
import { useEffect } from "react";
import { ErrorState } from "@/components/ui/States";
import { reloadOnce } from "@/components/ui/ErrorReporter";
import { reportClientError, isStaleBuildError } from "@/lib/monitoring/report-client";

/** Ошибка в интерфейсе: вместо белого экрана — понятное сообщение и повтор */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleBuildError(error);
  useEffect(() => {
    if (stale && reloadOnce()) return;
    reportClientError(error, "error-boundary");
  }, [error, stale]);
  return (
    <main className="library-shell">
      <ErrorState
        icon="moon"
        title={stale ? "Приложение обновилось" : "Что-то пошло не так"}
        text={stale ? "Загрузите страницу заново — прогресс сохранён." : "Мы уже знаем об ошибке. Попробуйте ещё раз — прогресс сохранён."}
        action={stale ? () => window.location.reload() : reset}
        actionLabel={stale ? "Обновить" : "Повторить"}
      />
    </main>
  );
}
