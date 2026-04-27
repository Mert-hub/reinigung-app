"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, getUserProfile, type AppRole } from "@/src/lib/auth";
import type { OpsTask, ProfileOption } from "@/src/lib/ops-tasks-types";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";
import { useI18n } from "@/src/i18n/provider";
import { TaskCalendarTab } from "@/src/components/tasks/task-calendar-tab";
import { TaskDiscussionTab } from "@/src/components/tasks/task-discussion-tab";

export function TaskManagementModule() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"calendar" | "discussion">("calendar");
  const [role, setRole] = useState<AppRole | null>(null);
  const [userId, setUserId] = useState("");
  const [tasks, setTasks] = useState<OpsTask[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [loadError, setLoadError] = useState("");

  const refreshTasks = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("ops_tasks").select("*").order("starts_at", { ascending: false }).limit(400);
    if (error) {
      throw error;
    }
    setTasks((data as OpsTask[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError("");
      try {
        const user = await getCurrentUser();
        if (!user) {
          return;
        }
        const ctx = await getUserProfile(user.id);
        if (cancelled) {
          return;
        }
        setRole(ctx.role);
        setUserId(user.id);
        const supabase = getSupabaseClient();
        const { data: prof, error: pErr } = await supabase.from("profiles").select("id, role, hotel_id").limit(500);
        if (pErr) {
          throw pErr;
        }
        if (!cancelled) {
          setProfiles((prof as ProfileOption[]) ?? []);
        }
        await refreshTasks();
      } catch (e) {
        if (!cancelled) {
          setLoadError(formatSupabaseError(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTasks]);

  const isAdmin = role === "admin";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {loadError && (
        <div className="shrink-0 rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">
          {t("tasks.loadFailed")}: {loadError}
        </div>
      )}

      <div className="inline-flex shrink-0 rounded-lg border border-[#d0d5dd] bg-[#f9fafb] p-1">
        <button
          type="button"
          onClick={() => setTab("calendar")}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
            tab === "calendar" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085] hover:text-[#101828]"
          }`}
        >
          {t("tasks.tabCalendar")}
        </button>
        <button
          type="button"
          onClick={() => setTab("discussion")}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
            tab === "discussion" ? "bg-white text-[#101828] shadow-sm" : "text-[#667085] hover:text-[#101828]"
          }`}
        >
          {t("tasks.tabDiscussion")}
        </button>
      </div>

      {tab === "calendar" && role !== null && (
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#d0d5dd] bg-white p-3 md:p-4">
          <TaskCalendarTab
            isAdmin={isAdmin}
            currentUserId={userId}
            tasks={tasks}
            profiles={profiles}
            weekAnchor={weekAnchor}
            setWeekAnchor={setWeekAnchor}
            onRefresh={refreshTasks}
          />
        </section>
      )}

      {tab === "discussion" && userId && role !== null && (
        <section className="flex min-h-0 flex-1 flex-col">
          <TaskDiscussionTab isAdmin={isAdmin} currentUserId={userId} profiles={profiles} onTasksChanged={refreshTasks} />
        </section>
      )}
    </div>
  );
}
