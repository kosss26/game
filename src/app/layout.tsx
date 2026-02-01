import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TelegramProvider } from "@/lib/telegram/TelegramProvider";

export const metadata: Metadata = {
  title: "Story App - Интерактивные истории",
  description: "Погрузись в захватывающие интерактивные истории",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className="antialiased">
        <TelegramProvider>
          {children}
        </TelegramProvider>
      </body>
    </html>
  );
}
