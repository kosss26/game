"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

// Telegram WebApp types
interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
    };
    auth_date?: number;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  onEvent: (eventType: string, callback: () => void) => void;
  offEvent: (eventType: string, callback: () => void) => void;
  sendData: (data: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  showPopup: (params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text?: string }> }, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

interface TelegramContextType {
  webApp: TelegramWebApp | null;
  user: TelegramWebApp["initDataUnsafe"]["user"] | null;
  initData: string | null;
  isReady: boolean;
  isDev: boolean;
  haptic: TelegramWebApp["HapticFeedback"] | null;
}

const TelegramContext = createContext<TelegramContextType>({
  webApp: null,
  user: null,
  initData: null,
  isReady: false,
  isDev: false,
  haptic: null,
});

export function useTelegram() {
  return useContext(TelegramContext);
}

// Mock user for development
const DEV_USER = {
  id: 123456789,
  first_name: "Dev",
  last_name: "User",
  username: "devuser",
  language_code: "ru",
};

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg) {
      // Real Telegram WebApp
      tg.ready();
      tg.expand();
      
      // Set theme colors
      if (tg.themeParams.bg_color) {
        document.documentElement.style.setProperty("--tg-theme-bg-color", tg.themeParams.bg_color);
      }
      if (tg.themeParams.text_color) {
        document.documentElement.style.setProperty("--tg-theme-text-color", tg.themeParams.text_color);
      }
      if (tg.themeParams.secondary_bg_color) {
        document.documentElement.style.setProperty("--tg-theme-secondary-bg-color", tg.themeParams.secondary_bg_color);
      }

      setWebApp(tg);
      setIsReady(true);
    } else {
      // Development mode without Telegram
      console.log("Running outside Telegram - using dev mode");
      setIsReady(true);
    }
  }, []);

  const isDev = !webApp;
  const user = webApp?.initDataUnsafe?.user ?? (isDev ? DEV_USER : null);
  const initData = webApp?.initData ?? null;
  const haptic = webApp?.HapticFeedback ?? null;

  return (
    <TelegramContext.Provider value={{ webApp, user, initData, isReady, isDev, haptic }}>
      {children}
    </TelegramContext.Provider>
  );
}

// Custom hook for MainButton
export function useMainButton(
  text: string,
  onClick: () => void,
  options?: { visible?: boolean; disabled?: boolean }
) {
  const { webApp } = useTelegram();

  useEffect(() => {
    if (!webApp) return;

    const { MainButton } = webApp;
    MainButton.setText(text);
    MainButton.onClick(onClick);

    if (options?.visible !== false) {
      MainButton.show();
    }

    if (options?.disabled) {
      MainButton.disable();
    } else {
      MainButton.enable();
    }

    return () => {
      MainButton.offClick(onClick);
      MainButton.hide();
    };
  }, [webApp, text, onClick, options?.visible, options?.disabled]);
}

// Custom hook for BackButton
export function useBackButton(onClick: () => void, visible: boolean = true) {
  const { webApp } = useTelegram();

  useEffect(() => {
    if (!webApp) return;

    const { BackButton } = webApp;
    
    if (visible) {
      BackButton.onClick(onClick);
      BackButton.show();
    } else {
      BackButton.hide();
    }

    return () => {
      BackButton.offClick(onClick);
      BackButton.hide();
    };
  }, [webApp, onClick, visible]);
}
