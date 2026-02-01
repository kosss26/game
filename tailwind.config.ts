import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Telegram-inspired dark theme
        tg: {
          bg: "#17212b",
          "bg-secondary": "#232e3c",
          "bg-tertiary": "#1d2733",
          accent: "#5288c1",
          "accent-hover": "#6ba1d6",
          text: "#f5f5f5",
          "text-secondary": "#8b9aa5",
          "text-hint": "#6a7883",
          bubble: {
            npc: "#182533",
            me: "#2b5278",
            system: "#1a1a2e",
          },
          border: "#2b3945",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "typing-dot": "typingDot 1.4s infinite ease-in-out",
        pulse: "pulse 2s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        typingDot: {
          "0%, 60%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-4px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
