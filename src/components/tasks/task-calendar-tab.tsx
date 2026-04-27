"use client";

import { addDays, addHours, addWeeks, endOfDay, format, startOfDay, startOfWeek } from "date-fns";
import { de, enUS, tr, uk } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { getCurrentUser } from "@/src/lib/auth";
import { HOTEL_CATALOG, getHotelDisplayName } from "@/src/lib/hotel-catalog";
import type { OpsTask, ProfileOption } from "@/src/lib/ops-tasks-types";
import {
  CALENDAR_COLOR_KEYS,
  CALENDAR_COLOR_STYLE,
  type CalendarColorKey,
  normalizeTaskColor,
} from "@/src/lib/task-calendar-colors";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";
import { useI18n } from "@/src/i18n/provider";

function weekBounds(anchor: Date) {
  const ws = startOfWeek(anchor, { weekStartsOn: 1 });
  const first = startOfDay(ws);
  const last = endOfDay(addDays(first, 6));
  return { weekStart: first, weekEnd: last };
}

function taskTouchesLocalDay(task: OpsTask, day: Date): boolean {
  const d0 = startOfDay(day).getTime();
  const d1 = endOfDay(day).getTime();
  if (task.all_day && task.starts_at) {
    const t = new Date(task.starts_at).getTime();
    return t >= d0 && t <= d1;
  }
  const s = task.starts_at ? new Date(task.starts_at).getTime() : NaN;
  const e = task.ends_at ? new Date(task.ends_at).getTime() : NaN;
  const dl = task.deadline_at ? new Date(task.deadline_at).getTime() : NaN;
  if (!Number.isNaN(s)) {
    const endMs = !Number.isNaN(e) ? e : s;
    return s <= d1 && endMs >= d0;
  }
  if (!Number.isNaN(dl)) {
    return dl >= d0 && dl <= d1;
  }
  return false;
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromDatetimeLocalValue(v: string): string | null {
  if (!v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function profileLabel(p: ProfileOption) {
  const hotel = p.hotel_id ? getHotelDisplayName(p.hotel_id) : "";
  return hotel ? `${p.id.slice(0, 8)}… · ${hotel}` : `${p.id.slice(0, 8)}…`;
}

/** Client-side deadline hint: overdue vs due within 48h (no extra DB). */
function getDeadlineUrgency(task: OpsTask): "none" | "soon" | "overdue" {
  if (!task.deadline_at) return "none";
  if (task.status === "done" || task.status === "cancelled") return "none";
  const d = new Date(task.deadline_at).getTime();
  if (Number.isNaN(d)) return "none";
  const now = Date.now();
  if (d < now) return "overdue";
  if (d <= now + 48 * 60 * 60 * 1000) return "soon";
  return "none";
}

type TaskCalendarTabProps = {
  isAdmin: boolean;
  currentUserId: string;
  tasks: OpsTask[];
  profiles: ProfileOption[];
  weekAnchor: Date;
  setWeekAnchor: (d: Date) => void;
  onRefresh: () => Promise<void>;
};

export function TaskCalendarTab({
  isAdmin,
  currentUserId,
  tasks,
  profiles,
  weekAnchor,
  setWeekAnchor,
  onRefresh,
}: TaskCalendarTabProps) {
  const { locale, t } = useI18n();
  const dfLocale = locale === "tr" ? tr : locale === "en" ? enUS : locale === "uk" ? uk : de;
  const { weekStart, weekEnd } = useMemo(() => weekBounds(weekAnchor), [weekAnchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const visibleTasks = useMemo(() => {
    if (isAdmin) return tasks;
    return tasks.filter((x) => x.assignee_id === currentUserId);
  }, [tasks, isAdmin, currentUserId]);

  const tasksInWeek = useMemo(() => {
    return visibleTasks.filter((task) =>
      weekDays.some((d) => taskTouchesLocalDay(task, d)),
    );
  }, [visibleTasks, weekDays]);

  const overdueTasks = useMemo(
    () =>
      visibleTasks
        .filter((t) => getDeadlineUrgency(t) === "overdue")
        .sort((a, b) => new Date(a.deadline_at!).getTime() - new Date(b.deadline_at!).getTime()),
    [visibleTasks],
  );

  const soonTasks = useMemo(
    () =>
      visibleTasks
        .filter((t) => getDeadlineUrgency(t) === "soon")
        .sort((a, b) => new Date(a.deadline_at!).getTime() - new Date(b.deadline_at!).getTime()),
    [visibleTasks],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<OpsTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const assigneeOptions = useMemo(
    () => profiles.filter((p) => (p.role ?? "").toLowerCase() === "vorarbeiter"),
    [profiles],
  );

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAssignee, setFormAssignee] = useState("");
  const [formHotel, setFormHotel] = useState("");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formCalendarColor, setFormCalendarColor] = useState<CalendarColorKey>("peacock");
  const [advancedCreateOpen, setAdvancedCreateOpen] = useState(false);

  const titlePresetKeys = useMemo(
    () =>
      [
        "taskPreset_deepClean",
        "taskPreset_linen",
        "taskPreset_inspection",
        "taskPreset_guest",
        "taskPreset_stock",
        "taskPreset_training",
      ] as const,
    [],
  );

  const applyQuickSlot = (slot: "mon_morning" | "wed_pm" | "fri_block" | "span_week") => {
    const ws = startOfDay(weekStart);
    if (slot === "mon_morning") {
      const s = addHours(ws, 9);
      const e = addHours(ws, 11);
      const dl = addHours(addDays(ws, 2), 17);
      setFormStart(toDatetimeLocalValue(s.toISOString()));
      setFormEnd(toDatetimeLocalValue(e.toISOString()));
      setFormDeadline(toDatetimeLocalValue(dl.toISOString()));
      setFormAllDay(false);
    }
    if (slot === "wed_pm") {
      const d = addDays(ws, 2);
      const s = addHours(startOfDay(d), 13);
      const e = addHours(startOfDay(d), 16);
      const dl = addHours(startOfDay(d), 18);
      setFormStart(toDatetimeLocalValue(s.toISOString()));
      setFormEnd(toDatetimeLocalValue(e.toISOString()));
      setFormDeadline(toDatetimeLocalValue(dl.toISOString()));
      setFormAllDay(false);
    }
    if (slot === "fri_block") {
      const d = addDays(ws, 4);
      const s = addHours(startOfDay(d), 10);
      const e = addHours(startOfDay(d), 14);
      const dl = addHours(startOfDay(d), 17);
      setFormStart(toDatetimeLocalValue(s.toISOString()));
      setFormEnd(toDatetimeLocalValue(e.toISOString()));
      setFormDeadline(toDatetimeLocalValue(dl.toISOString()));
      setFormAllDay(false);
    }
    if (slot === "span_week") {
      const s = addHours(ws, 9);
      const e = addHours(addDays(ws, 4), 12);
      setFormStart(toDatetimeLocalValue(s.toISOString()));
      setFormEnd(toDatetimeLocalValue(e.toISOString()));
      setFormDeadline(toDatetimeLocalValue(weekEnd.toISOString()));
      setFormAllDay(false);
    }
  };

  const openCreate = () => {
    setError("");
    setFormTitle("");
    setFormDescription("");
    setFormAssignee(assigneeOptions[0]?.id ?? "");
    setFormHotel("");
    setFormAllDay(false);
    const base = startOfDay(weekStart);
    base.setHours(9, 0, 0, 0);
    const end = new Date(base);
    end.setHours(10, 0, 0, 0);
    setFormStart(toDatetimeLocalValue(base.toISOString()));
    setFormEnd(toDatetimeLocalValue(end.toISOString()));
    setFormDeadline(toDatetimeLocalValue(addDays(base, 2).toISOString()));
    setFormCalendarColor("peacock");
    setAdvancedCreateOpen(false);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error(t("tasks.noSession"));
      if (!formTitle.trim()) throw new Error(t("tasks.titleRequired"));
      if (!formAssignee) throw new Error(t("tasks.assigneeRequired"));

      let starts_at: string | null = fromDatetimeLocalValue(formStart);
      let ends_at: string | null = fromDatetimeLocalValue(formEnd);
      const deadline_at = fromDatetimeLocalValue(formDeadline);

      if (formAllDay) {
        const d = formStart ? new Date(formStart) : weekStart;
        const sd = startOfDay(d);
        starts_at = sd.toISOString();
        ends_at = endOfDay(sd).toISOString();
      }

      const supabase = getSupabaseClient();
      const { error: insErr } = await supabase.from("ops_tasks").insert({
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        hotel_id: formHotel.trim() || null,
        starts_at,
        ends_at,
        deadline_at,
        all_day: formAllDay,
        status: "pending",
        assignee_id: formAssignee,
        created_by: user.id,
        calendar_color: formCalendarColor,
      });
      if (insErr) throw insErr;
      setCreateOpen(false);
      await onRefresh();
    } catch (e) {
      setError(formatSupabaseError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (task: OpsTask, status: OpsTask["status"]) => {
    setSaving(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      const { error: up } = await supabase.from("ops_tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", task.id);
      if (up) throw up;
      setDetailTask(null);
      await onRefresh();
    } catch (e) {
      setError(formatSupabaseError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task: OpsTask) => {
    if (!isAdmin) return;
    if (!window.confirm(t("tasks.confirmDelete"))) return;
    setSaving(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      const { error: del } = await supabase.from("ops_tasks").delete().eq("id", task.id);
      if (del) throw del;
      setDetailTask(null);
      await onRefresh();
    } catch (e) {
      setError(formatSupabaseError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCalendarColor = async (task: OpsTask, color: CalendarColorKey) => {
    setSaving(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      const { error: up } = await supabase
        .from("ops_tasks")
        .update({ calendar_color: color, updated_at: new Date().toISOString() })
        .eq("id", task.id);
      if (up) throw up;
      setDetailTask((prev) => (prev && prev.id === task.id ? { ...prev, calendar_color: color } : prev));
      await onRefresh();
    } catch (e) {
      setError(formatSupabaseError(e));
    } finally {
      setSaving(false);
    }
  };

  const statusClass: Record<OpsTask["status"], string> = {
    pending: "border-[#fcd34d] bg-[#fffbeb] text-[#b45309]",
    in_progress: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
    done: "border-[#abefc6] bg-[#ecfdf3] text-[#067647]",
    cancelled: "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]",
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekAnchor(addWeeks(weekAnchor, -1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f3f4f6]"
            aria-label={t("tasks.weekPrev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-[10rem] text-center text-sm font-semibold text-[#101828]">
            {format(weekStart, "d MMM", { locale: dfLocale })} – {format(weekEnd, "d MMM yyyy", { locale: dfLocale })}
          </p>
          <button
            type="button"
            onClick={() => setWeekAnchor(addWeeks(weekAnchor, 1))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d0d5dd] bg-white text-[#344054] hover:bg-[#f3f4f6]"
            aria-label={t("tasks.weekNext")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" />
            {t("tasks.newTask")}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">{error}</div>
      )}

      {(overdueTasks.length > 0 || soonTasks.length > 0) && (
        <div className="shrink-0 rounded-lg border border-[#eaecf0] bg-[#fffbeb] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#92400e]">{t("tasks.deadlineBannerTitle")}</p>
          {overdueTasks.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-[#b42318]">{t("tasks.deadlineOverdueSection")}</p>
              <ul className="mt-1 space-y-1">
                {overdueTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setDetailTask(task);
                      }}
                      className="w-full rounded-md border border-[#fecdca] bg-[#fef3f2] px-2 py-1.5 text-left text-xs font-medium text-[#b42318] hover:bg-[#fee2e2]"
                    >
                      {task.title} · {format(new Date(task.deadline_at!), "Pp", { locale: dfLocale })}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {soonTasks.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-[#b45309]">{t("tasks.deadlineSoonSection")}</p>
              <ul className="mt-1 space-y-1">
                {soonTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setDetailTask(task);
                      }}
                      className="w-full rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-left text-xs font-medium text-[#92400e] hover:bg-amber-100"
                    >
                      {task.title} · {format(new Date(task.deadline_at!), "Pp", { locale: dfLocale })}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-2 overflow-x-auto pb-1 [min-height:min(520px,calc(100dvh-22rem))]">
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="flex min-h-0 min-w-[7.5rem] flex-1 flex-col rounded-lg border border-[#eaecf0] bg-[#fafafa]"
          >
            <div className="shrink-0 border-b border-[#eaecf0] bg-white px-2 py-2 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">{format(day, "EEE", { locale: dfLocale })}</p>
              <p className="text-sm font-bold text-[#101828]">{format(day, "d.MM.", { locale: dfLocale })}</p>
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
              {tasksInWeek
                .filter((task) => taskTouchesLocalDay(task, day))
                .map((task) => {
                  const urgency = getDeadlineUrgency(task);
                  const ck = normalizeTaskColor(task.calendar_color);
                  const cs = CALENDAR_COLOR_STYLE[ck];
                  const fill =
                    urgency === "overdue" ? "#fef2f2" : urgency === "soon" ? "#fffbeb" : cs.fill;
                  const ring =
                    urgency === "overdue"
                      ? "ring-1 ring-red-300"
                      : urgency === "soon"
                        ? "ring-1 ring-amber-300"
                        : "";
                  return (
                  <button
                    key={task.id + format(day, "yyyy-MM-dd")}
                    type="button"
                    onClick={() => {
                      setError("");
                      setDetailTask(task);
                    }}
                    className={`w-full rounded-md border px-2 py-1.5 text-left text-xs shadow-sm transition hover:shadow-md ${ring}`}
                    style={{
                      borderColor: cs.border,
                      backgroundColor: fill,
                      borderLeftWidth: 4,
                      borderLeftColor: urgency === "overdue" ? "#ef4444" : urgency === "soon" ? "#f59e0b" : cs.bar,
                    }}
                  >
                    <p className="line-clamp-2 font-semibold text-[#101828]">{task.title}</p>
                    <p className="mt-0.5 text-[10px] text-[#667085]">
                      {!task.all_day && task.starts_at ? format(new Date(task.starts_at), "HH:mm", { locale: dfLocale }) : task.all_day ? t("tasks.allDay") : ""}
                      {task.deadline_at && (
                        <span className="ml-1">· {t("tasks.deadlineShort")} {format(new Date(task.deadline_at), "dd.MM. HH:mm", { locale: dfLocale })}</span>
                      )}
                    </p>
                    <span className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${statusClass[task.status]}`}>
                      {task.status === "pending"
                        ? t("tasks.status_pending")
                        : task.status === "in_progress"
                          ? t("tasks.status_in_progress")
                          : task.status === "done"
                            ? t("tasks.status_done")
                            : t("tasks.status_cancelled")}
                    </span>
                  </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => !saving && setCreateOpen(false)} />
          <div className="relative z-10 max-h-[min(90dvh,52rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[#d0d5dd] bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#101828]">{t("tasks.newTask")}</h3>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-[#344054]">{t("tasks.fieldColor")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CALENDAR_COLOR_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      title={key}
                      onClick={() => setFormCalendarColor(key)}
                      className={`h-8 w-8 shrink-0 rounded-full border-2 shadow-sm transition ${
                        formCalendarColor === key ? "border-[#101828] ring-2 ring-[#101828]/20" : "border-white ring-1 ring-[#d0d5dd]"
                      }`}
                      style={{ backgroundColor: CALENDAR_COLOR_STYLE[key].bar }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-[#344054]">{t("tasks.fieldTitle")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {titlePresetKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormTitle(t(`tasks.${key}`))}
                      className="rounded-full border border-[#d0d5dd] bg-[#f9fafb] px-3 py-1 text-xs font-medium text-[#344054] hover:border-brand hover:bg-white"
                    >
                      {t(`tasks.${key}`)}
                    </button>
                  ))}
                </div>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t("tasks.customTitlePlaceholder")}
                  className="mt-2 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-sm"
                />
              </div>
              <label className="block text-sm">
                <span className="font-medium text-[#344054]">{t("tasks.fieldAssignee")}</span>
                <select
                  value={formAssignee}
                  onChange={(e) => setFormAssignee(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-sm"
                >
                  {assigneeOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {profileLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[#344054]">{t("tasks.fieldHotel")}</span>
                <select
                  value={formHotel}
                  onChange={(e) => setFormHotel(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-sm"
                >
                  <option value="">{t("tasks.hotelNone")}</option>
                  {HOTEL_CATALOG.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="text-sm font-medium text-[#344054]">{t("tasks.quickSlots")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyQuickSlot("mon_morning")}
                    className="rounded-lg border border-[#d0d5dd] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] hover:border-brand"
                  >
                    {t("tasks.slotMonMorning")}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickSlot("wed_pm")}
                    className="rounded-lg border border-[#d0d5dd] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] hover:border-brand"
                  >
                    {t("tasks.slotWedPm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickSlot("fri_block")}
                    className="rounded-lg border border-[#d0d5dd] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] hover:border-brand"
                  >
                    {t("tasks.slotFriBlock")}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickSlot("span_week")}
                    className="rounded-lg border border-[#d0d5dd] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] hover:border-brand"
                  >
                    {t("tasks.slotSpanWeek")}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdvancedCreateOpen((o) => !o)}
                className="text-sm font-medium text-brand hover:underline"
              >
                {advancedCreateOpen ? t("tasks.advancedHide") : t("tasks.advancedShow")}
              </button>
              {advancedCreateOpen && (
                <div className="space-y-3 border-t border-[#eaecf0] pt-3">
                  <label className="block text-sm">
                    <span className="font-medium text-[#344054]">{t("tasks.fieldDescription")}</span>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-[#d0d5dd] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formAllDay} onChange={(e) => setFormAllDay(e.target.checked)} />
                    <span className="font-medium text-[#344054]">{t("tasks.fieldAllDay")}</span>
                  </label>
                  {!formAllDay && (
                    <>
                      <label className="block text-sm">
                        <span className="font-medium text-[#344054]">{t("tasks.fieldStart")}</span>
                        <input
                          type="datetime-local"
                          value={formStart}
                          onChange={(e) => setFormStart(e.target.value)}
                          className="mt-1 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-sm"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="font-medium text-[#344054]">{t("tasks.fieldEnd")}</span>
                        <input
                          type="datetime-local"
                          value={formEnd}
                          onChange={(e) => setFormEnd(e.target.value)}
                          className="mt-1 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-sm"
                        />
                      </label>
                    </>
                  )}
                  {formAllDay && (
                    <label className="block text-sm">
                      <span className="font-medium text-[#344054]">{t("tasks.fieldDay")}</span>
                      <input
                        type="datetime-local"
                        value={formStart}
                        onChange={(e) => setFormStart(e.target.value)}
                        className="mt-1 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-sm"
                      />
                    </label>
                  )}
                  <label className="block text-sm">
                    <span className="font-medium text-[#344054]">{t("tasks.fieldDeadline")}</span>
                    <input
                      type="datetime-local"
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-sm"
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setCreateOpen(false)} className="rounded-md border border-[#d0d5dd] px-3 py-2 text-sm">
                {t("tasks.cancel")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreate()}
                className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {t("tasks.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => !saving && setDetailTask(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-[#d0d5dd] bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#101828]">{detailTask.title}</h3>
            {detailTask.description && <p className="mt-2 text-sm text-[#475467]">{detailTask.description}</p>}
            <dl className="mt-3 space-y-1 text-xs text-[#667085]">
              <div>
                <dt className="inline font-medium">{t("tasks.fieldDeadline")}: </dt>
                <dd className="inline">
                  {detailTask.deadline_at ? format(new Date(detailTask.deadline_at), "Pp", { locale: dfLocale }) : "—"}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">{t("tasks.fieldStart")}: </dt>
                <dd className="inline">
                  {detailTask.starts_at ? format(new Date(detailTask.starts_at), "Pp", { locale: dfLocale }) : "—"}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">{t("tasks.fieldEnd")}: </dt>
                <dd className="inline">
                  {detailTask.ends_at ? format(new Date(detailTask.ends_at), "Pp", { locale: dfLocale }) : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <p className="text-sm font-medium text-[#344054]">{t("tasks.fieldColor")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CALENDAR_COLOR_KEYS.map((key) => {
                  const active = normalizeTaskColor(detailTask.calendar_color) === key;
                  const disabled = saving || (!isAdmin && detailTask.assignee_id !== currentUserId);
                  return (
                    <button
                      key={key}
                      type="button"
                      title={key}
                      disabled={disabled}
                      onClick={() => void handleUpdateCalendarColor(detailTask, key)}
                      className={`h-8 w-8 shrink-0 rounded-full border-2 shadow-sm transition disabled:opacity-40 ${
                        active ? "border-[#101828] ring-2 ring-[#101828]/20" : "border-white ring-1 ring-[#d0d5dd]"
                      }`}
                      style={{ backgroundColor: CALENDAR_COLOR_STYLE[key].bar }}
                    />
                  );
                })}
              </div>
            </div>
            <label className="mt-4 block text-sm font-medium text-[#344054]">{t("tasks.status")}</label>
            <select
              value={detailTask.status}
              disabled={saving || (!isAdmin && detailTask.assignee_id !== currentUserId)}
              onChange={(e) => void handleUpdateStatus(detailTask, e.target.value as OpsTask["status"])}
              className="mt-1 h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-sm"
            >
              <option value="pending">{t("tasks.status_pending")}</option>
              <option value="in_progress">{t("tasks.status_in_progress")}</option>
              <option value="done">{t("tasks.status_done")}</option>
              <option value="cancelled">{t("tasks.status_cancelled")}</option>
            </select>
            {isAdmin && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDelete(detailTask)}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#b42318] hover:underline"
              >
                <Trash2 className="h-4 w-4" />
                {t("tasks.delete")}
              </button>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setDetailTask(null)} className="rounded-md border border-[#d0d5dd] px-3 py-2 text-sm">
                {t("tasks.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
