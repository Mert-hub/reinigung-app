"use client";

import { AlertTriangle, ClipboardList, Hotel, PackageMinus } from "lucide-react";
import { useI18n } from "@/src/i18n/provider";

export default function DashboardPage() {
  const { t } = useI18n();
  const summaryCards = [
    { label: t("dashboard.roomEntry"), value: "142", icon: Hotel },
    { label: t("dashboard.pendingTasks"), value: "18", icon: ClipboardList },
    { label: t("dashboard.lowInventory"), value: "6", icon: PackageMinus },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#d0d5dd] bg-white p-6">
        <h1 className="text-2xl font-semibold text-[#101828]">{t("dashboard.title")}</h1>
        <p className="mt-1 text-sm text-[#475467]">
          {t("dashboard.subtitle")}
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-xl border border-[#d0d5dd] bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#475467]">{card.label}</p>
                <Icon className="h-5 w-5 text-brand" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-[#101828]">{card.value}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <div className="flex items-start gap-3 rounded-lg border border-[#fecdca] bg-[#fff6ed] p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-[#b54708]" />
          <div>
            <p className="text-sm font-semibold text-[#7a2e0e]">{t("dashboard.inventoryAlertTitle")}</p>
            <p className="text-sm text-[#9a3412]">
              {t("dashboard.inventoryAlertText")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
