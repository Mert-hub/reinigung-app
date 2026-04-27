"use client";

import { addDays, addHours, format, startOfDay, startOfWeek } from "date-fns";
import { de, enUS, tr, uk } from "date-fns/locale";
import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUser } from "@/src/lib/auth";
import { HOTEL_CATALOG, getHotelDisplayName } from "@/src/lib/hotel-catalog";
import type { ProfileOption, TaskChatMessage, TaskProposal } from "@/src/lib/ops-tasks-types";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";
import { useI18n } from "@/src/i18n/provider";

type TaskDiscussionTabProps = {
  isAdmin: boolean;
  currentUserId: string;
  profiles: ProfileOption[];
  onTasksChanged?: () => void | Promise<void>;
};

const TITLE_PRESET_KEYS = [
  "taskPreset_deepClean",
  "taskPreset_linen",
  "taskPreset_inspection",
  "taskPreset_guest",
  "taskPreset_stock",
  "taskPreset_training",
] as const;

const WHEN_KEYS = ["propWhen_todayPm", "propWhen_tomorrowAm", "propWhen_midWeek", "propWhen_weekend"] as const;
type WhenKey = (typeof WHEN_KEYS)[number];

function proposalSchedule(when: WhenKey, now = new Date()) {
  const sod = startOfDay(now);
  if (when === "propWhen_todayPm") {
    const s = addHours(sod, 14);
    const e = addHours(sod, 16);
    const d = addHours(sod, 18);
    return { suggested_starts_at: s.toISOString(), suggested_ends_at: e.toISOString(), suggested_deadline_at: d.toISOString() };
  }
  if (when === "propWhen_tomorrowAm") {
    const day = startOfDay(addDays(now, 1));
    const s = addHours(day, 9);
    const e = addHours(day, 11);
    const d = addHours(day, 13);
    return { suggested_starts_at: s.toISOString(), suggested_ends_at: e.toISOString(), suggested_deadline_at: d.toISOString() };
  }
  if (when === "propWhen_midWeek") {
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    const day = addDays(ws, 2);
    const s = addHours(startOfDay(day), 10);
    const e = addHours(startOfDay(day), 13);
    const d = addHours(startOfDay(day), 17);
    return { suggested_starts_at: s.toISOString(), suggested_ends_at: e.toISOString(), suggested_deadline_at: d.toISOString() };
  }
  const ws = startOfWeek(now, { weekStartsOn: 1 });
  const sat = addDays(ws, 5);
  const s = addHours(startOfDay(sat), 10);
  const e = addHours(startOfDay(sat), 13);
  const sun = addDays(sat, 1);
  const d = addHours(startOfDay(sun), 18);
  return { suggested_starts_at: s.toISOString(), suggested_ends_at: e.toISOString(), suggested_deadline_at: d.toISOString() };
}

function profileLabel(p: ProfileOption) {
  const hotel = p.hotel_id ? getHotelDisplayName(p.hotel_id) : "";
  return hotel ? `${p.id.slice(0, 8)}… · ${hotel}` : `${p.id.slice(0, 8)}…`;
}

export function TaskDiscussionTab({ isAdmin, currentUserId, profiles, onTasksChanged }: TaskDiscussionTabProps) {
  const { locale, t } = useI18n();
  const dfLocale = locale === "tr" ? tr : locale === "en" ? enUS : locale === "uk" ? uk : de;
  const [messages, setMessages] = useState<TaskChatMessage[]>([]);
  const [proposals, setProposals] = useState<TaskProposal[]>([]);
  const [body, setBody] = useState("");
  const [pPresetTitle, setPPresetTitle] = useState<(typeof TITLE_PRESET_KEYS)[number] | "other" | "">("");
  const [pCustomTitle, setPCustomTitle] = useState("");
  const [pHotel, setPHotel] = useState("");
  const [pWhen, setPWhen] = useState<WhenKey | "">("");
  const [pNote, setPNote] = useState("");
  const [assigneeByProposal, setAssigneeByProposal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const nameFor = useCallback(
    (id: string) => {
      const p = profiles.find((x) => x.id === id);
      if (!p) return id.slice(0, 8) + "…";
      const h = p.hotel_id ? getHotelDisplayName(p.hotel_id) : "";
      return h ? `${id.slice(0, 8)}… (${h})` : `${id.slice(0, 8)}…`;
    },
    [profiles],
  );

  const vorarbeiterOptions = profiles.filter((p) => (p.role ?? "").toLowerCase() === "vorarbeiter");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      const [msgRes, propRes] = await Promise.all([
        supabase.from("task_chat_messages").select("id, author_id, body, created_at").order("created_at", { ascending: true }).limit(200),
        supabase.from("task_proposals").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      if (msgRes.error) throw msgRes.error;
      if (propRes.error) throw propRes.error;
      setMessages((msgRes.data as TaskChatMessage[]) ?? []);
      setProposals((propRes.data as TaskProposal[]) ?? []);
    } catch (e) {
      setError(formatSupabaseError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const first = vorarbeiterOptions[0]?.id ?? "";
    setAssigneeByProposal((prev) => {
      const next = { ...prev };
      for (const p of proposals) {
        if (p.status === "pending" && (!next[p.id] || !vorarbeiterOptions.some((v) => v.id === next[p.id]))) {
          next[p.id] = first;
        }
      }
      return next;
    });
  }, [proposals, vorarbeiterOptions]);

  const sendMessage = async () => {
    if (!body.trim()) return;
    setSaving(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      const { error: ins } = await supabase.from("task_chat_messages").insert({ author_id: currentUserId, body: body.trim() });
      if (ins) throw ins;
      setBody("");
      await loadAll();
    } catch (e) {
      setError(formatSupabaseError(e));
    } finally {
      setSaving(false);
    }
  };

  const submitProposal = async () => {
    const title =
      pPresetTitle === "other"
        ? pCustomTitle.trim()
        : pPresetTitle
          ? t(`tasks.${pPresetTitle}`)
          : "";
    if (!title || !pWhen) return;
    setSaving(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      const times = proposalSchedule(pWhen);
      const row = {
        title,
        description: pNote.trim() || null,
        hotel_id: pHotel.trim() || null,
        suggested_starts_at: times.suggested_starts_at,
        suggested_ends_at: times.suggested_ends_at,
        suggested_deadline_at: times.suggested_deadline_at,
        proposed_by: currentUserId,
        status: "pending" as const,
      };
      const { error: ins } = await supabase.from("task_proposals").insert(row);
      if (ins) throw ins;
      setPPresetTitle("");
      setPCustomTitle("");
      setPHotel("");
      setPWhen("");
      setPNote("");
      await loadAll();
    } catch (e) {
      setError(formatSupabaseError(e));
    } finally {
      setSaving(false);
    }
  };

  const rejectProposal = async (p: TaskProposal) => {
    setSaving(true);
    setError("");
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error(t("tasks.noSession"));
      const supabase = getSupabaseClient();
      const { error: up } = await supabase
        .from("task_proposals")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (up) throw up;
      await loadAll();
    } catch (e) {
      setError(formatSupabaseError(e));
    } finally {
      setSaving(false);
    }
  };

  const approveProposalInline = async (p: TaskProposal) => {
    const assigneeId = assigneeByProposal[p.id];
    if (!assigneeId) {
      setError(t("tasks.assigneeRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error(t("tasks.noSession"));
      const supabase = getSupabaseClient();
      const { error: taskErr } = await supabase.from("ops_tasks").insert({
        title: p.title,
        description: p.description,
        hotel_id: p.hotel_id,
        starts_at: p.suggested_starts_at,
        ends_at: p.suggested_ends_at,
        deadline_at: p.suggested_deadline_at,
        all_day: false,
        status: "pending",
        assignee_id: assigneeId,
        created_by: user.id,
        calendar_color: "brand",
      });
      if (taskErr) throw taskErr;
      const { error: up } = await supabase
        .from("task_proposals")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (up) throw up;
      await loadAll();
      await onTasksChanged?.();
    } catch (e) {
      setError(formatSupabaseError(e));
    } finally {
      setSaving(false);
    }
  };

  const proposalReady =
    Boolean(pWhen) && (pPresetTitle === "other" ? pCustomTitle.trim().length > 0 : Boolean(pPresetTitle));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error && <div className="shrink-0 rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">{error}</div>}
      <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row lg:items-stretch">
      <div className="flex min-h-[22rem] flex-1 flex-col overflow-hidden rounded-2xl border border-[#d1d7db] bg-[#efeae2] shadow-sm lg:min-h-[min(640px,calc(100dvh-14rem))]">
        <div className="shrink-0 border-b border-[#d1d7db] bg-[#f0f2f5] px-4 py-3">
          <h3 className="text-[15px] font-semibold text-[#111b21]">{t("tasks.discussionTitle")}</h3>
          <p className="mt-0.5 text-xs leading-snug text-[#667781]">{t("tasks.discussionHint")}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 md:px-4">
          {loading ? (
            <p className="px-2 text-sm text-[#667781]">{t("common.loading")}</p>
          ) : messages.length === 0 ? (
            <p className="px-2 text-center text-sm text-[#667781]">{t("tasks.noMessages")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {messages.map((m) => {
                const mine = m.author_id === currentUserId;
                return (
                  <li key={m.id} className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[min(100%,26rem)] rounded-2xl px-3 py-2 shadow-sm ${
                        mine ? "rounded-br-sm bg-[#d9fdd3]" : "rounded-bl-sm bg-white"
                      }`}
                    >
                      {!mine && (
                        <p className="text-[11px] font-semibold text-[#1f2a32]">{nameFor(m.author_id)}</p>
                      )}
                      <p className={`whitespace-pre-wrap text-sm leading-snug text-[#111b21] ${!mine ? "mt-0.5" : ""}`}>{m.body}</p>
                      <p className={`mt-1 text-[10px] ${mine ? "text-right text-[#667781]" : "text-[#8696a0]"}`}>
                        {format(new Date(m.created_at), "HH:mm", { locale: dfLocale })}
                      </p>
                    </div>
                  </li>
                );
              })}
              <div ref={messagesEndRef} />
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-[#d1d7db] bg-[#f0f2f5] p-2 md:p-3">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-inner ring-1 ring-[#e9edef]">
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={t("tasks.messagePlaceholder")}
              className="min-h-10 flex-1 border-0 bg-transparent text-sm text-[#111b21] outline-none placeholder:text-[#8696a0]"
            />
            <button
              type="button"
              disabled={saving || !body.trim()}
              onClick={() => void sendMessage()}
              aria-label={t("tasks.send")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-sm hover:bg-brand-hover disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-[#d0d5dd] bg-white p-4 shadow-sm lg:w-[min(100%,22rem)] lg:max-w-md">
        <h3 className="text-base font-semibold text-[#101828]">{t("tasks.proposalsTitle")}</h3>
        <p className="mt-1 text-xs text-[#667085]">{t("tasks.proposalsHint")}</p>

        {!isAdmin && (
          <div className="mt-4 space-y-3 rounded-xl border border-[#eaecf0] bg-[#fafafa] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#475467]">{t("tasks.proposeQuick")}</p>
            <div>
              <p className="text-[11px] font-medium text-[#667085]">{t("tasks.fieldTitle")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {TITLE_PRESET_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPPresetTitle(key)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      pPresetTitle === key
                        ? "border-brand bg-brand-muted text-[#0a0a0a]"
                        : "border-[#d0d5dd] bg-white text-[#344054] hover:border-brand"
                    }`}
                  >
                    {t(`tasks.${key}`)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPPresetTitle("other")}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    pPresetTitle === "other"
                      ? "border-brand bg-brand-muted text-[#0a0a0a]"
                      : "border-[#d0d5dd] bg-white text-[#344054] hover:border-brand"
                  }`}
                >
                  {t("tasks.taskPreset_other")}
                </button>
              </div>
              {pPresetTitle === "other" && (
                <input
                  value={pCustomTitle}
                  onChange={(e) => setPCustomTitle(e.target.value)}
                  placeholder={t("tasks.customTitlePlaceholder")}
                  className="mt-2 h-9 w-full rounded-lg border border-[#d0d5dd] px-2 text-sm"
                />
              )}
            </div>
            <label className="block text-[11px] font-medium text-[#667085]">
              {t("tasks.fieldHotel")}
              <select
                value={pHotel}
                onChange={(e) => setPHotel(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-[#d0d5dd] bg-white px-2 text-sm"
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
              <p className="text-[11px] font-medium text-[#667085]">{t("tasks.whenLabel")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {WHEN_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPWhen(key)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      pWhen === key
                        ? "border-brand bg-brand-muted text-[#0a0a0a]"
                        : "border-[#d0d5dd] bg-white text-[#344054] hover:border-brand"
                    }`}
                  >
                    {t(`tasks.${key}`)}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={pNote}
              onChange={(e) => setPNote(e.target.value)}
              placeholder={t("tasks.proposalOptionalNote")}
              className="h-9 w-full rounded-lg border border-[#d0d5dd] px-2 text-sm"
            />
            <button
              type="button"
              disabled={saving || !proposalReady}
              onClick={() => void submitProposal()}
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {t("tasks.submitProposal")}
            </button>
          </div>
        )}

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {proposals.length === 0 && !loading ? (
            <p className="text-sm text-[#667085]">{t("tasks.noProposals")}</p>
          ) : (
            proposals.map((p) => (
              <div key={p.id} className="rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-[#101828]">{p.title}</p>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      p.status === "pending"
                        ? "border-[#fcd34d] bg-[#fffbeb] text-[#b45309]"
                        : p.status === "approved"
                          ? "border-[#abefc6] bg-[#ecfdf3] text-[#067647]"
                          : "border-[#fecdd3] bg-[#fef2f2] text-[#be123c]"
                    }`}
                  >
                    {p.status === "pending"
                      ? t("tasks.proposal_pending")
                      : p.status === "approved"
                        ? t("tasks.proposal_approved")
                        : t("tasks.proposal_rejected")}
                  </span>
                </div>
                {p.description && <p className="mt-1 text-xs text-[#475467]">{p.description}</p>}
                <p className="mt-1 text-[10px] text-[#667085]">
                  {nameFor(p.proposed_by)} · {format(new Date(p.created_at), "Pp", { locale: dfLocale })}
                </p>
                {isAdmin && p.status === "pending" && (
                  <div className="mt-3 space-y-2 border-t border-[#eaecf0] pt-3">
                    <label className="block text-[11px] font-medium text-[#667085]">{t("tasks.fieldAssignee")}</label>
                    <select
                      value={assigneeByProposal[p.id] ?? ""}
                      onChange={(e) => setAssigneeByProposal((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-[#d0d5dd] bg-white px-2 text-sm"
                    >
                      {vorarbeiterOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {profileLabel(o)}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={saving || !assigneeByProposal[p.id]}
                        onClick={() => void approveProposalInline(p)}
                        className="flex-1 rounded-lg bg-brand py-2 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                      >
                        {t("tasks.approve")}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void rejectProposal(p)}
                        className="flex-1 rounded-lg border border-[#fecdca] bg-[#fef3f2] py-2 text-xs font-semibold text-[#b42318]"
                      >
                        {t("tasks.reject")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
      </div>
    </div>
  );
}
