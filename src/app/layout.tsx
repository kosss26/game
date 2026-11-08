import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { TelegramProvider } from "@/lib/telegram/TelegramProvider";
import { STARTUP_BOOTSTRAP_SRC } from "@/lib/telegram/startup-bootstrap";
import { StartupRecovery } from "@/components/ui/StartupRecovery";
import { ErrorReporter } from "@/components/ui/ErrorReporter";

export const metadata: Metadata = {
  title: "Полночь — истории в переписке",
  description:
    "Интерактивные истории, которые происходят в чате. Ваши ответы меняют ход событий и финал.",
  robots: { index: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#090a0f",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <head>
        <script id="polnoch-early-ready-v2" async src={STARTUP_BOOTSTRAP_SRC} />
      </head>
      <body className="antialiased" style={{ backgroundColor: "#090a0f" }}>
        <StartupRecovery />
        <ErrorReporter />
        <Script
          src="/vendor/telegram-web-app.124bdff7.js"
          strategy="afterInteractive"
        />
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
