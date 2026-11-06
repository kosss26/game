type Insets = { top: number; bottom: number; left: number; right: number };

export interface TelegramViewport {
  safeAreaInset?: Insets;
  contentSafeAreaInset?: Insets;
  isFullscreen?: boolean;
  isVersionAtLeast?: (version: string) => boolean;
  requestFullscreen?: () => void;
  expand: () => void;
  onEvent: (event: string, callback: () => void) => void;
  offEvent: (event: string, callback: () => void) => void;
}

/** Never wait for native fullscreen before signing in or displaying the app. */
export function setupTelegramViewport(
  tg: TelegramViewport,
  style: Pick<CSSStyleDeclaration, "setProperty" | "removeProperty">,
): () => void {
  const edges = ["top", "bottom", "left", "right"] as const;
  const applyInsets = () => {
    for (const edge of edges) {
      const inset = (tg.safeAreaInset?.[edge] || 0) + (tg.contentSafeAreaInset?.[edge] || 0);
      style.setProperty(`--tg-content-safe-${edge}`, `${inset}px`);
    }
  };
  const expand = () => { try { tg.expand(); } catch { /* unsupported client */ } };
  const onFailure = () => {
    applyInsets();
    if (!tg.isFullscreen) expand();
  };
  const listeners: [string, () => void][] = [
    ["safeAreaChanged", applyInsets],
    ["contentSafeAreaChanged", applyInsets],
    ["fullscreenChanged", applyInsets],
    ["fullscreenFailed", onFailure],
  ];

  applyInsets();
  for (const [event, callback] of listeners) tg.onEvent(event, callback);
  expand();
  try {
    if (!tg.isFullscreen && tg.requestFullscreen && tg.isVersionAtLeast?.("8.0")) tg.requestFullscreen();
  } catch {
    // Expanded mode is already active; a failed native request is non-fatal.
  }

  return () => {
    for (const [event, callback] of listeners) tg.offEvent(event, callback);
    for (const edge of edges) style.removeProperty(`--tg-content-safe-${edge}`);
  };
}
