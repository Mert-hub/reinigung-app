"use client";

import { useI18n } from "@/src/i18n/provider";

type ModulePlaceholderProps = {
  titleKey: string;
  descriptionKey: string;
};

export function ModulePlaceholder({ titleKey, descriptionKey }: ModulePlaceholderProps) {
  const { t } = useI18n();
  return (
    <section className="rounded-xl border border-[#d0d5dd] bg-white p-6">
      <h1 className="text-xl font-semibold text-[#101828]">{t(titleKey)}</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#475467]">{t(descriptionKey)}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-dashed border-[#d0d5dd] bg-[#f9fafb] p-4 text-xs text-[#667085]">
          {t("placeholders.dataSource")}
        </div>
        <div className="rounded-lg border border-dashed border-[#d0d5dd] bg-[#f9fafb] p-4 text-xs text-[#667085]">
          {t("placeholders.kpiCards")}
        </div>
        <div className="rounded-lg border border-dashed border-[#d0d5dd] bg-[#f9fafb] p-4 text-xs text-[#667085]">
          {t("placeholders.actionPanel")}
        </div>
      </div>
    </section>
  );
}
