"use client";

import { Languages } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Locale } from "@/src/i18n/messages";
import { useI18n } from "@/src/i18n/provider";

/** ISO 3166-1 alpha-2 for https://flagcdn.com (en → gb, Ukrainian UI locale → ua) */
const FLAG_CODE: Record<Locale, string> = {
  de: "de",
  en: "gb",
  tr: "tr",
  uk: "ua",
};

function flagUrl(code: string) {
  return `https://flagcdn.com/w40/${code}.png`;
}

const options: Array<{ locale: Locale; label: string }> = [
  { locale: "de", label: "Deutsch" },
  { locale: "en", label: "English" },
  { locale: "tr", label: "Türkçe" },
  { locale: "uk", label: "Українська" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((item) => item.locale === locale) ?? options[0];
  const flagCode = FLAG_CODE[selected.locale];

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-[#0a0a0a] hover:bg-brand-muted/70"
      >
        <Languages className="h-3.5 w-3.5 shrink-0" />
        <img
          src={flagUrl(flagCode)}
          alt=""
          width={20}
          height={15}
          className="h-3.5 w-5 shrink-0 rounded-[2px] border border-line object-cover"
          loading="lazy"
          decoding="async"
        />
        <span className="shrink-0">{selected.locale.toUpperCase()}</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 min-w-[9.5rem] rounded-md border border-line bg-surface py-1 shadow-md"
          role="listbox"
        >
          {options.map((option) => (
            <button
              key={option.locale}
              type="button"
              role="option"
              aria-selected={locale === option.locale}
              onClick={() => {
                setLocale(option.locale);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#0a0a0a] hover:bg-brand-muted/80"
            >
              <img
                src={flagUrl(FLAG_CODE[option.locale])}
                alt=""
                width={20}
                height={15}
                className="h-3.5 w-5 shrink-0 rounded-[2px] border border-line object-cover"
                loading="lazy"
                decoding="async"
              />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
