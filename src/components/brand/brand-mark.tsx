"use client";

/* eslint-disable @next/next/no-img-element -- public PNG: native <img> is most reliable. */

import { useI18n } from "@/src/i18n/provider";

const LOGO_SRC = "/brand/umut-logo.png";

type BrandMarkProps = {
  /** PNG: tam dosya dikdörtgeni, arka plan rengi yok sayılarak hücrede ortalanır. */
  variant?: "sidebar" | "sidebarCompact" | "headerMobile" | "login";
  className?: string;
};

export function BrandMark({ variant = "sidebar", className = "" }: BrandMarkProps) {
  const { t } = useI18n();
  const alt = t("brand.logoAlt");

  if (variant === "login") {
    return (
      <div className={`flex w-full flex-col items-center justify-center ${className}`}>
        <img
          src={LOGO_SRC}
          alt={alt}
          width={300}
          height={120}
          loading="eager"
          decoding="async"
          draggable={false}
          className="mx-auto block h-auto max-h-40 w-full max-w-[min(100%,20rem)] object-contain object-center"
        />
      </div>
    );
  }

  if (variant === "headerMobile") {
    return (
      <div
        className={`flex h-full w-[4.5rem] shrink-0 items-center justify-center self-center sm:w-28 ${className}`}
      >
        <img
          src={LOGO_SRC}
          alt={alt}
          width={200}
          height={80}
          loading="eager"
          decoding="async"
          draggable={false}
          className="block max-h-11 w-full max-w-[6.5rem] object-contain object-center"
        />
      </div>
    );
  }

  if (variant === "sidebarCompact") {
    return (
      <div className={`flex h-full w-full min-w-0 items-center justify-center ${className}`}>
        <img
          src={LOGO_SRC}
          alt={alt}
          width={88}
          height={44}
          loading="eager"
          decoding="async"
          draggable={false}
          className="block h-auto max-h-9 w-auto max-w-full object-contain object-center"
        />
      </div>
    );
  }

  return (
    <div className={`flex w-full min-w-0 items-center justify-center ${className}`}>
      <img
        src={LOGO_SRC}
        alt={alt}
        width={280}
        height={112}
        loading="eager"
        decoding="async"
        draggable={false}
        className="block max-h-16 w-auto max-w-full object-contain object-center md:max-h-[4.5rem]"
      />
    </div>
  );
}
