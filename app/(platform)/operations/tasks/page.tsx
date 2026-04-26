"use client";

import { TaskQueuePanel } from "@/src/components/tasks/task-queue-panel";
import { useI18n } from "@/src/i18n/provider";

export default function TasksPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#d0d5dd] bg-white p-6">
        <h1 className="text-xl font-semibold text-[#101828]">{t("tasks.title")}</h1>
        <p className="mt-2 text-sm text-[#475467]">
          {t("tasks.subtitle")}
        </p>
      </section>
      <TaskQueuePanel />
    </div>
  );
}
