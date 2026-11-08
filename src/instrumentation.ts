/**
 * Серверные ошибки при обработке запросов (страницы, server actions, API)
 * попадают в журнал ошибок. Только для Node.js-рантайма.
 */
const KIND: Record<string, string> = { route: "API", render: "страница", action: "действие", middleware: "middleware" };

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("@/lib/monitoring/errors");
  const e = err as { message?: string; stack?: string; digest?: string };
  await recordError({
    source: "server",
    message: e?.message || String(err),
    stack: e?.stack,
    url: request.path,
    route: [KIND[context.routeType || ""] || context.routeType, context.routePath].filter(Boolean).join(" "),
  });
}
