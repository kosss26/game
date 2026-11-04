import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: v("ink"),
        surface: v("surface"),
        raised: v("raised"),
        elevated: v("elevated"),
        line: v("line"),
        fg: v("fg"),
        muted: v("muted"),
        faint: v("faint"),
        accent: v("accent"),
        "accent-2": v("accent-2"),
        ok: v("ok"),
        warn: v("warn"),
        danger: v("danger"),
        // Совместимость с админкой (старые классы tg-*)
        tg: {
          bg: v("ink"),
          "bg-secondary": v("raised"),
          "bg-tertiary": v("surface"),
          accent: v("accent"),
          "accent-hover": v("accent-2"),
          text: v("fg"),
          "text-secondary": v("muted"),
          "text-hint": v("faint"),
          border: v("line"),
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "'SF Pro Text'", "'Segoe UI'", "Roboto", "'Helvetica Neue'", "Arial", "sans-serif"],
        display: ["-apple-system", "BlinkMacSystemFont", "'SF Pro Display'", "'Segoe UI'", "Roboto", "sans-serif"],
        serif: ["'Iowan Old Style'", "'Palatino Linotype'", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        bubble: "18px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--c-accent) / 0.25), 0 8px 32px -8px rgb(var(--c-accent) / 0.45)",
        card: "0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 20px 40px -24px rgb(0 0 0 / 0.8)",
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out both",
        "msg-in": "msgIn 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2) both",
        "slide-up": "slideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "sheet-up": "sheetUp 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        msgIn: {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        sheetUp: {
          "0%": { opacity: "0", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.45" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
    },
  },
  plugins: [],
};

export default config;
