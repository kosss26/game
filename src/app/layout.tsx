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
        <Script src="/vendor/telegram-web-app.124bdff7.js" strategy="afterInteractive" />
        <TelegramProvider>{children}</TelegramProvider>
      </body>
    </html>
  );
}
