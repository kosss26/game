"use client";

import { useTelegram } from "@/lib/telegram/TelegramProvider";

// Telegram IDs которые имеют доступ к админке
const ADMIN_IDS = [1763619724];

export function AdminButton() {
  const { user, isDev } = useTelegram();
  
  // Показываем кнопку если это dev режим или пользователь в списке админов
  const isAdmin = isDev || (user && ADMIN_IDS.includes(user.id));
  
  if (!isAdmin) {
    return null;
  }

  const handleClick = () => {
    // Открываем напрямую через window.location
    window.location.href = "/admin";
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-tg-accent rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
    >
      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  );
}
