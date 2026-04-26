"use client";

import { InventoryAlertPanel } from "@/src/components/inventory/inventory-alert-panel";
import { useI18n } from "@/src/i18n/provider";

export default function InventoryPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#d0d5dd] bg-white p-6">
        <h1 className="text-xl font-semibold text-[#101828]">{t("inventory.title")}</h1>
        <p className="mt-2 text-sm text-[#475467]">
          {t("inventory.subtitle")}
        </p>
      </section>
      <InventoryAlertPanel />
    </div>
  );
}
