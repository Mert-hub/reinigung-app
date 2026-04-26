"use client";

import { useI18n } from "@/src/i18n/provider";

const taskRows = [
  { task: "Kat-2 minibar kontrolu", status: "waiting", owner: "Mehmet" },
  { task: "Lobby cam temizligi", status: "inProgress", owner: "Elif" },
  { task: "Kat-5 havlu dagitimi", status: "completed", owner: "Sena" },
];

export function TaskQueuePanel() {
  const { t } = useI18n();
  const statusLabel = {
    waiting: t("tasks.waiting"),
    inProgress: t("tasks.inProgress"),
    completed: t("tasks.completed"),
  };

  return (
    <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
      <h2 className="text-base font-semibold text-[#101828]">{t("tasks.queueTitle")}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#f9fafb] text-left text-[#475467]">
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("tasks.task")}</th>
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("tasks.status")}</th>
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("tasks.owner")}</th>
            </tr>
          </thead>
          <tbody>
            {taskRows.map((row) => (
              <tr key={row.task} className="odd:bg-white even:bg-[#f9fafb]">
                <td className="border border-[#eaecf0] px-3 py-2">{row.task}</td>
                <td className="border border-[#eaecf0] px-3 py-2">{statusLabel[row.status as keyof typeof statusLabel]}</td>
                <td className="border border-[#eaecf0] px-3 py-2">{row.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
