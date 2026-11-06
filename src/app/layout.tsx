import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { TelegramProvider } from "@/lib/telegram/TelegramProvider";

export const metadata: Metadata = {
  title: "Полночь — истории в переписке",
  description: "Интерактивные истории, которые происходят в чате. Ваши ответы меняют ход событий и финал.",
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js?57" strategy="beforeInteractive" />
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
