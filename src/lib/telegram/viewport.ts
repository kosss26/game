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
  requestViewport?: () => void,
): () => void {
  let disposed = false;
  let requested = false;
  let fullscreenTimer: ReturnType<typeof setTimeout> | undefined;
  const onViewport = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("polnoch:native-viewport"));
    if (disposed || requested || fullscreenTimer || tg.isFullscreen) return;
    // A native round trip must precede a new window transition. Leave the
    // expanded window usable if the client never acknowledges viewport updates.
    fullscreenTimer = setTimeout(() => {
      fullscreenTimer = undefined;
      if (disposed || requested || tg.isFullscreen) return;
      requested = true;
      try {
        if (tg.requestFullscreen && tg.isVersionAtLeast?.("8.0")) tg.requestFullscreen();
      } catch { /* expanded mode remains usable */ }
    }, 300);
  };
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
    ["viewportChanged", onViewport],
    ["safeAreaChanged", applyInsets],
    ["contentSafeAreaChanged", applyInsets],
    ["fullscreenChanged", applyInsets],
    ["fullscreenFailed", onFailure],
  ];

  applyInsets();
  for (const [event, callback] of listeners) tg.onEvent(event, callback);
  expand();
  try { requestViewport?.(); } catch { /* optional native probe */ }


  return () => {
    disposed = true;
    if (fullscreenTimer) clearTimeout(fullscreenTimer);
    for (const [event, callback] of listeners) tg.offEvent(event, callback);
    for (const edge of edges) style.removeProperty(`--tg-content-safe-${edge}`);
  };
}
