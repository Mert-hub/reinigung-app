"use client";

import { TaskManagementModule } from "@/src/components/tasks/task-management-module";
import { useI18n } from "@/src/i18n/provider";

export default function TasksPage() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="shrink-0 rounded-xl border border-[#d0d5dd] bg-white p-4 md:p-5">
        <h1 className="text-lg font-semibold text-[#101828] md:text-xl">{t("tasks.title")}</h1>
        <p className="mt-1 text-sm text-[#475467]">{t("tasks.subtitle")}</p>
      </section>
      <div className="flex min-h-0 flex-1 flex-col">
        <TaskManagementModule />
      </div>
    </div>
  );
}
