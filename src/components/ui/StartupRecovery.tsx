/** Server-rendered controls; the tiny startup script binds them without React. */
export function StartupRecovery() {
  return (
    <aside
      id="polnoch-startup-recovery"
      hidden
      suppressHydrationWarning
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        zIndex: 1000,
        left: 16,
        right: 16,
        bottom: 16,
        maxWidth: 440,
        margin: "0 auto",
        padding: "20px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
        border: "1px solid #6e538f",
        borderRadius: 18,
        background: "#181220",
        color: "#f2ecfa",
        boxShadow: "0 12px 50px #0008",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <strong style={{ display: "block", fontSize: 18 }}>
        Открываем «Полночь»
      </strong>
      <p
        id="polnoch-startup-message"
        suppressHydrationWarning
        style={{ margin: "10px 0 16px", fontSize: 14, lineHeight: 1.6 }}
      >
        Если загрузка прервалась, попробуйте ещё раз.
      </p>
      <button
        id="polnoch-startup-retry"
        type="button"
        style={{
          display: "block",
          width: "100%",
          minHeight: 46,
          border: 0,
          borderRadius: 10,
          background: "#9568e5",
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Повторить
      </button>
    </aside>
  );
}
