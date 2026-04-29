"use client";

import { format } from "date-fns";
import { de, enUS, tr, uk } from "date-fns/locale";
import html2canvas from "html2canvas";
import { CalendarDays, Printer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHotelScope } from "@/src/contexts/hotel-scope-context";
import { useI18n } from "@/src/i18n/provider";
import { getCurrentUser } from "@/src/lib/auth";
import { getHotelDisplayName } from "@/src/lib/hotel-catalog";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";

type AssignmentType = "none" | "abreise" | "anreise" | "bleibe";

type RoomTemplateRow = {
  room_number: string;
  room_type: string | null;
  sort_order: number;
};

type SavedListSummary = {
  id: string;
  hotel_id: string;
  list_name: string | null;
  checker_name: string | null;
  cleaner_names: string | null;
  shift_start: string | null;
  created_at: string;
  abreise_total: number | null;
  bleibe_total: number | null;
  preview_image_url: string | null;
};

type RoomDraft = {
  roomNumber: string;
  roomType: string;
  assignmentType: AssignmentType;
};

function parseRoomNumber(room: string) {
  const n = Number(room.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function getColumnIndex(roomNumber: string) {
  const n = parseRoomNumber(roomNumber);
  if (n >= 400) return 4;
  if (n >= 300) return 3;
  if (n >= 200) return 2;
  if (n >= 100) return 1;
  return 0;
}

function nextAssignment(current: AssignmentType): AssignmentType {
  if (current === "none") return "abreise";
  if (current === "abreise") return "bleibe";
  return "none";
}

function roomColorClass(type: AssignmentType) {
  if (type === "abreise") return "bg-[#d9c2ff]";
  if (type === "bleibe") return "bg-[#fde68a]";
  return "bg-white";
}

function roomBgColor(type: AssignmentType) {
  if (type === "abreise") return "#d9c2ff";
  if (type === "bleibe") return "#fde68a";
  return "#ffffff";
}

function toDateInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const REPORT_PHOTOS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_REPORTS_BUCKET ?? "room-list";

export function TodayBoardModule() {
  const { t, locale } = useI18n();
  const { effectiveHotelId, isAdmin, hotelOptions, selectedHotelId, setSelectedHotelId, isLoading: scopeLoading } =
    useHotelScope();
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [templateRows, setTemplateRows] = useState<RoomTemplateRow[]>([]);
  const [rows, setRows] = useState<RoomDraft[]>([]);
  const [roomListId, setRoomListId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [shiftStart, setShiftStart] = useState("08:30");
  const [checkerName, setCheckerName] = useState("");
  const [cleanerNames, setCleanerNames] = useState("");
  const [personnelOptions, setPersonnelOptions] = useState<Array<{ name: string; staff_no: string | null }>>([]);
  const [savedLists, setSavedLists] = useState<SavedListSummary[]>([]);
  const [showAllHotelsSaved, setShowAllHotelsSaved] = useState(false);
  const [viewerCheckerKey, setViewerCheckerKey] = useState<string | null>(null);
  const printSheetRef = useRef<HTMLDivElement | null>(null);

  const currentHotelId = effectiveHotelId;
  const currentHotelLabel = currentHotelId ? getHotelDisplayName(currentHotelId) : t("layout.hotelMissing");
  const uiLocale = locale === "tr" ? tr : locale === "en" ? enUS : locale === "uk" ? uk : de;
  const reportTitleDate = format(new Date(selectedDate), "d MMMM yyyy", { locale: uiLocale });

  const blankRowsFromTemplate = (templateRows: RoomTemplateRow[]): RoomDraft[] =>
    templateRows.map((room) => ({
      roomNumber: room.room_number,
      roomType: room.room_type ?? "",
      assignmentType: "none",
    }));

  const loadSavedLists = async (hotelId: string, reportDate: string, allHotels: boolean) => {
    const supabase = getSupabaseClient();
    let query = supabase
      .from("room_lists")
      .select("id, hotel_id, list_name, checker_name, cleaner_names, shift_start, created_at, abreise_total, bleibe_total, preview_image_url")
      .eq("report_date", reportDate)
      .order("created_at", { ascending: false });
    if (!allHotels) {
      query = query.eq("hotel_id", hotelId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as SavedListSummary[];
  };

  const loadListIntoForm = async (listId: string, templateRows: RoomTemplateRow[]) => {
    const supabase = getSupabaseClient();
    const { data: selectedList, error: listError } = await supabase
      .from("room_lists")
      .select("id, list_name, shift_start, checker_name, cleaner_names")
      .eq("id", listId)
      .single<{
        id: string;
        list_name: string | null;
        shift_start: string | null;
        checker_name: string | null;
        cleaner_names: string | null;
      }>();
    if (listError) throw listError;

    const { data: itemData, error: itemError } = await supabase
      .from("room_list_items")
      .select("room_number, assignment_type")
      .eq("room_list_id", selectedList.id);
    if (itemError) throw itemError;
    const byRoom = new Map((itemData ?? []).map((item) => [item.room_number, item]));
    setRows(
      templateRows.map((room) => {
        const saved = byRoom.get(room.room_number) as { assignment_type?: AssignmentType } | undefined;
        return {
          roomNumber: room.room_number,
          roomType: room.room_type ?? "",
          assignmentType: saved?.assignment_type ?? "none",
        };
      }),
    );
    setRoomListId(selectedList.id);
    setShiftStart(selectedList.shift_start ? selectedList.shift_start.slice(0, 5) : "08:30");
    setCheckerName(selectedList.checker_name ?? "");
    setCleanerNames(selectedList.cleaner_names ?? "");
  };

  useEffect(() => {
    if (scopeLoading) return;
    const load = async () => {
      if (!currentHotelId) {
        setRows([]);
        setRoomListId(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setErrorMessage("");
      try {
        const supabase = getSupabaseClient();
        const { data: templateData, error: templateError } = await supabase
          .from("hotel_room_templates")
          .select("room_number, room_type, sort_order")
          .eq("hotel_id", currentHotelId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (templateError) throw templateError;

        const roomTemplateRows = (templateData ?? []) as RoomTemplateRow[];
        setTemplateRows(roomTemplateRows);
        if (roomTemplateRows.length === 0) {
          setRows([]);
          setTemplateRows([]);
          setRoomListId(null);
          setSavedLists([]);
          setIsLoading(false);
          return;
        }

        const listSummaries = await loadSavedLists(currentHotelId, selectedDate, showAllHotelsSaved && isAdmin);
        setSavedLists(listSummaries);
        if (listSummaries.length > 0 && !(showAllHotelsSaved && isAdmin)) {
          await loadListIntoForm(listSummaries[0].id, roomTemplateRows);
        } else {
          setRows(blankRowsFromTemplate(roomTemplateRows));
          setRoomListId(null);
          setShiftStart("08:30");
          setCheckerName("");
          setCleanerNames("");
        }

        const { data: personnelData, error: personnelError } = await supabase
          .from("personnel_directory")
          .select("name, staff_no")
          .eq("hotel_id", currentHotelId)
          .eq("is_active", true)
          .order("name", { ascending: true });
        if (!personnelError) {
          setPersonnelOptions((personnelData ?? []) as Array<{ name: string; staff_no: string | null }>);
        }
      } catch (error) {
        setErrorMessage(formatSupabaseError(error));
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [currentHotelId, selectedDate, scopeLoading, showAllHotelsSaved, isAdmin]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.assignmentType === "abreise") acc.abreise += 1;
        if (row.assignmentType === "bleibe") acc.bleibe += 1;
        return acc;
      },
      { abreise: 0, bleibe: 0 },
    );
  }, [rows]);

  const totalsFromSavedLists = useMemo(() => {
    return savedLists.reduce(
      (acc, item) => {
        acc.abreise += item.abreise_total ?? 0;
        acc.bleibe += item.bleibe_total ?? 0;
        return acc;
      },
      { abreise: 0, bleibe: 0 },
    );
  }, [savedLists]);

  const checkerGroups = useMemo(() => {
    const groups = new Map<string, { checker: string; items: SavedListSummary[] }>();
    for (const item of savedLists) {
      const checker = item.checker_name?.trim() || item.list_name?.trim() || t("todayBoard.unknownChecker");
      const key = checker.toLocaleLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, { checker, items: [item] });
      }
    }
    return Array.from(groups.values());
  }, [savedLists, t]);

  const viewerGroup = useMemo(
    () => checkerGroups.find((g) => g.checker.toLocaleLowerCase() === viewerCheckerKey) ?? null,
    [checkerGroups, viewerCheckerKey],
  );

  const listChartData = useMemo(
    () => [
      {
        label: showAllHotelsSaved && isAdmin ? t("todayBoard.allHotelsShort") : getHotelDisplayName(currentHotelId ?? ""),
        Abreise: totalsFromSavedLists.abreise,
        Bleibe: totalsFromSavedLists.bleibe,
      },
    ],
    [showAllHotelsSaved, isAdmin, totalsFromSavedLists, t, currentHotelId],
  );

  const matrix = useMemo(() => {
    const columns: RoomDraft[][] = [[], [], [], [], []];
    for (const row of rows) {
      columns[getColumnIndex(row.roomNumber)].push(row);
    }
    for (const col of columns) {
      col.sort((a, b) => parseRoomNumber(a.roomNumber) - parseRoomNumber(b.roomNumber));
    }
    const max = Math.max(...columns.map((c) => c.length), 0);
    return { columns, max };
  }, [rows]);

  const updateRow = (roomNumber: string, patch: Partial<RoomDraft>) => {
    setRows((prev) => prev.map((r) => (r.roomNumber === roomNumber ? { ...r, ...patch } : r)));
  };

  const buildCheckerBasedListName = (checkerRaw: string) => {
    const checker = checkerRaw.trim() || t("todayBoard.unknownChecker");
    const sameCheckerLists = savedLists.filter(
      (list) =>
        list.id !== roomListId &&
        list.hotel_id === currentHotelId &&
        (list.checker_name?.trim() || "").toLocaleLowerCase() === checker.toLocaleLowerCase(),
    );
    const sequence = sameCheckerLists.length + 1;
    return sequence <= 1 ? checker : `${checker} (${sequence})`;
  };

  const startNewList = () => {
    setRoomListId(null);
    setRows(blankRowsFromTemplate(templateRows));
    setCheckerName("");
    setCleanerNames("");
    setShiftStart("08:30");
    setViewerCheckerKey(null);
  };

  const handleSave = async () => {
    if (!currentHotelId) {
      setErrorMessage(t("reports.profileHotelMissing"));
      return;
    }
    setErrorMessage("");
    setSuccessMessage("");
    setIsSaving(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error(t("forecast.noSession"));
      }
      const supabase = getSupabaseClient();
      let activeRoomListId = roomListId;
      let uploadedPreviewUrl: string | null = null;
      const resolvedListName = buildCheckerBasedListName(checkerName);
      if (!activeRoomListId) {
        const { data: created, error: createError } = await supabase
          .from("room_lists")
          .insert({
            hotel_id: currentHotelId,
            report_date: selectedDate,
            status: "draft",
            created_by: user.id,
            list_name: resolvedListName,
            shift_start: shiftStart || null,
            checker_name: checkerName.trim() || null,
            cleaner_names: cleanerNames.trim() || null,
          })
          .select("id")
          .single<{ id: string }>();
        if (createError) throw createError;
        activeRoomListId = created.id;
        setRoomListId(created.id);
      }

      for (const row of rows) {
        const payload = {
          room_list_id: activeRoomListId,
          room_number: row.roomNumber,
          assignment_type: row.assignmentType,
          updated_by: user.id,
        };
        const { error } = await supabase
          .from("room_list_items")
          .upsert(payload, { onConflict: "room_list_id,room_number" });
        if (error) throw error;
      }

      const sheetNode = printSheetRef.current;
      if (sheetNode) {
        const canvas = await html2canvas(sheetNode, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
        });
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob) {
          const filePath = `today-board/${currentHotelId}/${selectedDate}/${activeRoomListId}.png`;
          const { error: uploadError } = await supabase.storage
            .from(REPORT_PHOTOS_BUCKET)
            .upload(filePath, blob, {
              upsert: true,
              contentType: "image/png",
              cacheControl: "3600",
            });
          if (!uploadError) {
            const { data: publicData } = supabase.storage.from(REPORT_PHOTOS_BUCKET).getPublicUrl(filePath);
            uploadedPreviewUrl = publicData.publicUrl;
          }
        }
      }

      const { error: statusError } = await supabase
        .from("room_lists")
        .update({
          status: "submitted",
          submitted_at: new Date().toISOString(),
          list_name: resolvedListName,
          shift_start: shiftStart || null,
          checker_name: checkerName.trim() || null,
          cleaner_names: cleanerNames.trim() || null,
          abreise_total: totals.abreise,
          bleibe_total: totals.bleibe,
          preview_image_url: uploadedPreviewUrl,
        })
        .eq("id", activeRoomListId);
      if (statusError) throw statusError;

      const refreshed = await loadSavedLists(currentHotelId, selectedDate, showAllHotelsSaved && isAdmin);
      setSavedLists(refreshed);
      setSuccessMessage(t("todayBoard.saveSuccess"));
      window.setTimeout(() => setSuccessMessage(""), 2500);
      // After each save, switch to a fresh draft so next save creates a new list.
      startNewList();
    } catch (error) {
      setErrorMessage(formatSupabaseError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    const node = printSheetRef.current;
    if (!node) return;
    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) return;
    const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((el) => el.outerHTML)
      .join("\n");
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Today Board Print</title>
          ${styles}
          <style>
            @page { size: A4 portrait; margin: 6mm; }
            html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
            body { background: white; }
            .print-root { width: 198mm; max-width: 198mm; margin: 0 auto; }
            .print-root, .print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body>
          <div class="print-root">${node.outerHTML}</div>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h1 className="text-2xl font-semibold text-[#101828]">{t("todayBoard.title")}</h1>
        <p className="mt-1 text-sm text-[#475467]">{t("todayBoard.subtitle")}</p>
        {isAdmin && !scopeLoading && (
          <div className="mt-3 max-w-xl">
            <label className="mb-1 block text-sm font-medium text-[#344054]">{t("admin.selectHotel")}</label>
            <select
              value={selectedHotelId}
              onChange={(event) => setSelectedHotelId(event.target.value)}
              className="h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
            >
              {hotelOptions.map((h) => (
                <option key={h} value={h} title={h}>
                  {getHotelDisplayName(h)}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#344054]">{t("admin.selectReportDate")}</label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#667085]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="h-11 rounded-md border border-[#d0d5dd] pl-9 pr-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startNewList}
              className="inline-flex h-10 items-center rounded-md border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#344054] hover:bg-[#f9fafb]"
            >
              {t("todayBoard.newList")}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d0d5dd] bg-white px-3 text-sm font-medium text-[#344054] hover:bg-[#f9fafb]"
            >
              <Printer className="h-4 w-4" />
              {t("todayBoard.print")}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || isLoading || rows.length === 0}
              className="inline-flex h-10 items-center rounded-md bg-brand px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-[#9ca3af]"
            >
              {isSaving ? t("forecast.savingButton") : t("todayBoard.save")}
            </button>
          </div>
        </div>

        <div className="mb-3 rounded-md border border-[#eaecf0] bg-[#f9fafb] px-3 py-2 text-sm text-[#344054]">
          {currentHotelLabel} - {reportTitleDate}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-[#d9c2ff] bg-[#f3e8ff] p-2 text-xs text-[#344054]">
            <span className="font-semibold text-[#7c3aed]">{t("reports.departure")}: {totals.abreise}</span>
          </div>
          <div className="rounded-md border border-[#fde68a] bg-[#fef9c3] p-2 text-xs text-[#344054]">
            <span className="font-semibold text-[#ca8a04]">{t("reports.stay")}: {totals.bleibe}</span>
          </div>
          <div className="rounded-md border border-[#d1fadf] bg-[#ecfdf3] p-2 text-xs text-[#344054]">
            {t("todayBoard.cleaner")}: <span className="font-semibold">{cleanerNames ? cleanerNames.split(",").filter(Boolean).length : 0}</span>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-[#667085]">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#667085]">{t("todayBoard.noTemplate")}</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
            <div className="space-y-3">
              <div className="text-xs text-[#667085]">
                {t("todayBoard.tapHint")}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] border-collapse text-sm">
                  <tbody>
                    {Array.from({ length: matrix.max }, (_, rowIndex) => (
                      <tr key={rowIndex}>
                        {matrix.columns.map((col, colIndex) => {
                          const room = col[rowIndex];
                          if (!room) {
                            return <td key={`${colIndex}-${rowIndex}`} className="border border-[#d1d5db] px-3 py-2" />;
                          }
                          return (
                            <td
                              key={room.roomNumber}
                              className={`border border-[#111827] px-0 py-0 ${roomColorClass(room.assignmentType)}`}
                              style={{ backgroundColor: roomBgColor(room.assignmentType) }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  updateRow(room.roomNumber, { assignmentType: nextAssignment(room.assignmentType) });
                                }}
                                className="w-full px-3 py-2 text-left text-sm"
                              >
                                <span className="font-semibold">{room.roomNumber}</span>
                                {room.roomType ? <span className="ml-1 text-xs text-[#374151]">({room.roomType})</span> : null}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-md border border-[#d0d5dd] bg-[#f9fafb] p-3">
                <p className="mb-2 text-sm font-semibold text-[#101828]">{t("todayBoard.listAssignments")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    list="personnel-options"
                    value={cleanerNames}
                    onChange={(event) => setCleanerNames(event.target.value)}
                    className="h-10 w-full rounded-md border border-[#d0d5dd] px-2 text-sm outline-none ring-[#98a2b3] focus:ring-2"
                    placeholder={t("todayBoard.cleanerPlaceholder")}
                  />
                  <input
                    type="text"
                    list="personnel-options"
                    value={checkerName}
                    onChange={(event) => setCheckerName(event.target.value)}
                    className="h-10 w-full rounded-md border border-[#d0d5dd] px-2 text-sm outline-none ring-[#98a2b3] focus:ring-2"
                    placeholder={t("todayBoard.checkerPlaceholder")}
                  />
                </div>
                <datalist id="personnel-options">
                  {personnelOptions.map((p) => (
                    <option key={`${p.staff_no ?? "x"}-${p.name}`} value={p.name}>
                      {p.staff_no ? `${p.name} (${p.staff_no})` : p.name}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="grid gap-2 sm:grid-cols-1">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-[#344054]">{t("todayBoard.shiftStart")}</span>
                  <input
                    type="time"
                    value={shiftStart}
                    onChange={(event) => setShiftStart(event.target.value)}
                    className="h-10 w-full rounded-md border border-[#d0d5dd] px-2 outline-none ring-[#98a2b3] focus:ring-2"
                  />
                </label>
            </div>
            </div>

            <div className="print-area rounded-md border border-[#d0d5dd] bg-[#f8fafc] p-3">
              <p className="print-hidden mb-2 text-sm font-semibold text-[#101828]">{t("todayBoard.livePreview")}</p>
              <div ref={printSheetRef} className="print-sheet mx-auto w-full max-w-[560px] rounded-md border border-[#111827] bg-white p-3">
                <div className="mb-2 flex items-start justify-between gap-3 text-xs text-[#111827]">
                  <div className="space-y-1">
                    <div>{t("todayBoard.checkerLabel")}: {checkerName || "-"}</div>
                    <div>{t("todayBoard.cleanerLabel")}: {cleanerNames || "-"}</div>
                    <div>{t("todayBoard.dateLabel")}: {selectedDate}</div>
                  </div>
                  <img src="/brand/umut-logo.png" alt="UHS" className="h-8 w-auto object-contain" />
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <tbody>
                    {Array.from({ length: matrix.max }, (_, rowIndex) => (
                      <tr key={`preview-${rowIndex}`}>
                        {matrix.columns.map((col, colIndex) => {
                          const room = col[rowIndex];
                          if (!room) return <td key={`preview-empty-${colIndex}-${rowIndex}`} className="border border-[#111827] p-1" />;
                          return (
                            <td
                              key={`preview-${room.roomNumber}`}
                              className={`border border-[#111827] p-1 ${roomColorClass(room.assignmentType)}`}
                              style={{ backgroundColor: roomBgColor(room.assignmentType) }}
                            >
                              {room.roomNumber}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-[#111827] px-2 py-1">{t("todayBoard.beginnLabel")}: {shiftStart || "-"}</div>
                  <div className="rounded border border-[#111827] px-2 py-1">{t("todayBoard.endeLabel")}: ______</div>
                </div>
                <div className="mt-2 text-xs text-[#344054]">
                  Abreise: {totals.abreise} | Bleibe: {totals.bleibe}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h2 className="text-base font-semibold text-[#101828]">{t("todayBoard.savedListsTitle")}</h2>
        {isAdmin && (
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-[#344054]">
            <input
              type="checkbox"
              checked={showAllHotelsSaved}
              onChange={(event) => setShowAllHotelsSaved(event.target.checked)}
            />
            {t("todayBoard.allHotelsSaved")}
          </label>
        )}
        {savedLists.length === 0 ? (
          <p className="mt-2 text-sm text-[#667085]">{t("todayBoard.noSavedLists")}</p>
        ) : (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {checkerGroups.map((group) => {
                const latest = group.items[0];
                return (
                <div key={group.checker} className={`rounded-md border px-3 py-2 text-left text-sm ${
                  group.items.some((i) => i.id === roomListId) ? "border-brand bg-brand-muted" : "border-[#d0d5dd] bg-[#f9fafb]"
                }`}>
                  <button
                    type="button"
                    onClick={() => setViewerCheckerKey(group.checker.toLocaleLowerCase())}
                    className="w-full text-left"
                  >
                    {latest.preview_image_url ? (
                      <img
                        src={latest.preview_image_url}
                        alt={group.checker}
                        className="mb-2 h-28 w-full rounded border border-[#d0d5dd] object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex h-28 items-center justify-center rounded border border-[#d0d5dd] bg-white text-xs text-[#667085]">
                        {t("todayBoard.noPreviewImage")}
                      </div>
                    )}
                    <p className="font-semibold text-[#101828]">{group.checker}</p>
                    <div className="mt-1 space-y-0.5 text-xs text-[#667085]">
                      {group.items.slice(0, 3).map((it) => (
                        <p key={it.id}>
                          {getHotelDisplayName(it.hotel_id)} | A:{it.abreise_total ?? 0} B:{it.bleibe_total ?? 0}
                        </p>
                      ))}
                    </div>
                  </button>
                  {!showAllHotelsSaved && (
                    <button
                      type="button"
                      onClick={() => {
                        void loadListIntoForm(latest.id, templateRows);
                      }}
                      className="mt-2 w-full rounded-md border border-[#d0d5dd] bg-white px-2 py-1 text-xs font-semibold text-[#344054]"
                    >
                      {t("todayBoard.loadToForm")}
                    </button>
                  )}
                </div>
              )})}
            </div>
            <div className="mt-4 h-[260px] rounded-md border border-[#eaecf0] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={listChartData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" />
                  <XAxis dataKey="label" tick={{ fill: "#667085", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#667085", fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Abreise" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Bleibe" fill="#ca8a04" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      {viewerGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
          <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setViewerCheckerKey(null)} />
          <div className="relative z-10 w-[min(96vw,980px)] rounded-xl border border-line bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#101828]">
                {viewerGroup.checker}
              </p>
              <p className="text-xs text-[#667085]">{viewerGroup.items.length} {t("todayBoard.savedListsTitle")}</p>
            </div>
            <div className="max-h-[75vh] space-y-3 overflow-auto rounded border border-[#d0d5dd] bg-[#f9fafb] p-3">
              {viewerGroup.items.map((item) => (
                <div key={item.id} className="rounded-md border border-[#d0d5dd] bg-white p-2">
                  <p className="mb-1 text-xs text-[#667085]">
                    {getHotelDisplayName(item.hotel_id)} | A:{item.abreise_total ?? 0} B:{item.bleibe_total ?? 0}
                  </p>
                  {item.preview_image_url ? (
                    <img src={item.preview_image_url} alt={viewerGroup.checker} className="w-full rounded border border-[#e5e7eb]" />
                  ) : (
                    <p className="text-sm text-[#667085]">{t("todayBoard.noPreviewImage")}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm font-medium text-[#b42318]">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="rounded-md border border-[#abefc6] bg-[#ecfdf3] px-3 py-2 text-sm font-medium text-[#067647]">
          {successMessage}
        </div>
      )}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          .print-sheet,
          .print-sheet * {
            visibility: visible !important;
          }
          .print-sheet {
            position: relative !important;
            left: auto !important;
            top: auto !important;
            transform: none !important;
            margin: 0 auto !important;
            width: 198mm !important;
            max-width: 198mm !important;
            min-height: 0 !important;
            border: 1px solid #111827 !important;
            background: white !important;
            padding: 2.5mm !important;
            box-sizing: border-box;
            break-inside: avoid-page !important;
            break-after: avoid-page !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-sheet * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
