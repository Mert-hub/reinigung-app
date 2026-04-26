"use client";

import { Languages } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { type Locale } from "@/src/i18n/messages";
import { useI18n } from "@/src/i18n/provider";

const options: Array<{ locale: Locale; label: string; flagSrc: string }> = [
  { locale: "de", label: "Deutsch", flagSrc: "/flags/de.svg" },
  { locale: "en", label: "English", flagSrc: "/flags/en.svg" },
  { locale: "tr", label: "Turkce", flagSrc: "/flags/tr.svg" },
  { locale: "uk", label: "Ukrainska", flagSrc: "/flags/uk.svg" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((item) => item.locale === locale) ?? options[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-[#0a0a0a] hover:bg-brand-muted/70"
      >
        <Languages className="h-3.5 w-3.5" />
        <Image
          src={selected.flagSrc}
          alt={`${selected.label} flag`}
          width={18}
          height={12}
            className="rounded-[2px] border border-line"
        />
        <span>{selected.locale.toUpperCase()}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-36 rounded-md border border-line bg-surface shadow-sm">
          {options.map((option) => (
            <button
              key={option.locale}
              type="button"
              onClick={() => {
                setLocale(option.locale);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#0a0a0a] hover:bg-brand-muted/80"
            >
              <Image
                src={option.flagSrc}
                alt={`${option.label} flag`}
                width={18}
                height={12}
                className="rounded-[2px] border border-line"
              />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
