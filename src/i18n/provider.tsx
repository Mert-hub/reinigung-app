"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { defaultLocale, getMessage, messages, type Locale } from "@/src/i18n/messages";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const LOCALE_STORAGE_KEY = "reinigung.locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") {
      return defaultLocale;
    }
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
    return saved && saved in messages ? saved : defaultLocale;
  });

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  };

  const t = useMemo(
    () => (key: string) => {
      const localized = getMessage(messages[locale], key);
      if (localized) {
        return localized;
      }

      const fallback = getMessage(messages[defaultLocale], key);
      return fallback ?? key;
    },
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }
  return context;
}
