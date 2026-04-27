"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { de, enUS, tr, uk } from "date-fns/locale";
import { CalendarDays, Camera, CheckCircle2, ChevronLeft, ChevronRight, PackageSearch, Wrench, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useHotelScope } from "@/src/contexts/hotel-scope-context";
import { useI18n } from "@/src/i18n/provider";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";
import { getHotelDisplayName } from "@/src/lib/hotel-catalog";

const REPORT_PHOTOS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_REPORTS_BUCKET ?? "room-list";
type DailyReport = {
  id: string;
  created_at: string;
  hotel_id: string | null;
  abreise_count: number | null;
  bleibe_count: number | null;
  photo_url: string | null;
  checker_count: number | null;
  cleaner_count: number | null;
  public_count: number | null;
  spuler_count: number | null;
};

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown object error";
    }
  }

  return String(error);
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function formatTime(isoDate: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

/** Supports legacy single URL in `photo_url` or a JSON string array. */
function parsePhotoUrls(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  const t = raw.trim();
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((u): u is string => typeof u === "string" && u.length > 0);
      }
    } catch {
      return [t];
    }
  }
  return [t];
}

function serializePhotoUrls(urls: string[]): string {
  if (urls.length === 0) {
    return "";
  }
  if (urls.length === 1) {
    return urls[0];
  }
  return JSON.stringify(urls);
}

export function DailyReportModule() {
  const { locale, t } = useI18n();
  const { effectiveHotelId, isAdmin, hotelOptions, isLoading: scopeLoading, setSelectedHotelId, selectedHotelId } =
    useHotelScope();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [abreise, setAbreise] = useState("");
  const [bleibe, setBleibe] = useState("");
  const [checkerCount, setCheckerCount] = useState("");
  const [cleanerCount, setCleanerCount] = useState("");
  const [publicCount, setPublicCount] = useState("");
  const [spulerCount, setSpulerCount] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<{ source: "entry" | "pending"; index: number } | null>(null);
  const [lastEntry, setLastEntry] = useState<DailyReport | null>(null);
  const [isLoadingLastEntry, setIsLoadingLastEntry] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const calendarLocale = locale === "tr" ? tr : locale === "en" ? enUS : locale === "uk" ? uk : de;
  const reportTitle = `${format(selectedDate, "d MMMM yyyy", { locale: calendarLocale })} - ${t("reports.reportDateTitle")}`;

  const currentHotelId = effectiveHotelId;
  const currentHotel = effectiveHotelId ? getHotelDisplayName(effectiveHotelId) : t("layout.hotelMissing");
  const filePickerLabel =
    photoFiles.length === 0
      ? t("reports.chooseFile")
      : photoFiles.length === 1
        ? photoFiles[0].name
        : t("reports.nFilesSelected").replace("{{n}}", String(photoFiles.length));

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPendingPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [photoFiles]);

  const entryPhotoUrls = lastEntry ? parsePhotoUrls(lastEntry.photo_url) : [];
  const lightboxUrls = lightbox?.source === "pending" ? pendingPreviews : entryPhotoUrls;
  const lightboxCurrentUrl =
    lightbox && lightboxUrls[lightbox.index] ? lightboxUrls[lightbox.index] : null;
  const lightboxCount = lightbox ? lightboxUrls.length : 0;

  useEffect(() => {
    if (!lightbox) {
      return;
    }
    if (lightboxCount === 0) {
      return;
    }
    const n = lightboxCount;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
        return;
      }
      if (n < 2) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLightbox((L) => {
          if (!L) {
            return L;
          }
          return { ...L, index: (L.index - 1 + n) % n };
        });
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setLightbox((L) => {
          if (!L) {
            return L;
          }
          return { ...L, index: (L.index + 1) % n };
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, lightboxCount]);

  useEffect(() => {
    if (scopeLoading) {
      return;
    }

    const fetchReportForDate = async () => {
      await Promise.resolve();
      if (!currentHotelId) {
        setIsLoadingLastEntry(false);
        return;
      }
      setIsLoadingLastEntry(true);
      const supabase = getSupabaseClient();
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const nextDay = new Date(startOfDay);
      nextDay.setDate(nextDay.getDate() + 1);

      const query = supabase
        .from("daily_reports")
        .select("id, created_at, hotel_id, abreise_count, bleibe_count, photo_url, checker_count, cleaner_count, public_count, spuler_count")
        .eq("hotel_id", currentHotelId)
        .gte("created_at", startOfDay.toISOString())
        .lt("created_at", nextDay.toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error("Tarih bazli rapor getirme hatasi", { details: getErrorDetails(error) });
        setErrorMessage(t("reports.reportLoadFailed"));
        setIsLoadingLastEntry(false);
        return;
      }

      if (data) {
        setLastEntry(data);
        setAbreise(String(data.abreise_count ?? ""));
        setBleibe(String(data.bleibe_count ?? ""));
        setCheckerCount(String(data.checker_count ?? ""));
        setCleanerCount(String(data.cleaner_count ?? ""));
        setPublicCount(String(data.public_count ?? ""));
        setSpulerCount(String(data.spuler_count ?? ""));
      } else {
        setLastEntry(null);
        setAbreise("");
        setBleibe("");
        setCheckerCount("");
        setCleanerCount("");
        setPublicCount("");
        setSpulerCount("");
      }

      setIsLoadingLastEntry(false);
    };

    void fetchReportForDate();
  }, [selectedDate, currentHotelId, t, scopeLoading]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!currentHotelId) {
        throw new Error(t("reports.profileHotelMissing"));
      }

      const existingUrls = parsePhotoUrls(lastEntry?.photo_url);
      if (photoFiles.length === 0 && existingUrls.length === 0) {
        throw new Error(t("reports.photoRequired"));
      }

      const supabase = getSupabaseClient();
      const uploadedUrls: string[] = [];

      for (const file of photoFiles) {
        const fileExtension = file.name.split(".").pop() || "jpg";
        const normalizedExtension = sanitizeFileName(fileExtension.toLowerCase());
        const cleanName = sanitizeFileName(file.name.replace(/\.[^.]+$/, ""));
        const filePath = `reports/${Date.now()}-${crypto.randomUUID()}-${cleanName}.${normalizedExtension}`;

        const { error: uploadError } = await supabase.storage
          .from(REPORT_PHOTOS_BUCKET)
          .upload(filePath, file, {
            upsert: false,
            contentType: file.type || "image/jpeg",
            cacheControl: "3600",
          });

        if (uploadError) {
          throw new Error(`Storage upload hatasi: ${uploadError.message}`);
        }

        const { data } = supabase.storage.from(REPORT_PHOTOS_BUCKET).getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }

      const mergedUrls = uploadedUrls.length > 0 ? [...existingUrls, ...uploadedUrls] : existingUrls;
      const photoUrlSerialized = serializePhotoUrls(mergedUrls);

      const basePayload = {
        hotel_id: currentHotelId,
        abreise_count: Number(abreise),
        bleibe_count: Number(bleibe),
        checker_count: Number(checkerCount || 0),
        cleaner_count: Number(cleanerCount || 0),
        public_count: Number(publicCount || 0),
        spuler_count: Number(spulerCount || 0),
        photo_url: photoUrlSerialized,
        created_at: lastEntry?.created_at ?? new Date(selectedDate).toISOString(),
      };

      let insertError: Error | null = null;
      if (lastEntry?.id) {
        const result = await supabase
          .from("daily_reports")
          .update({
            abreise_count: basePayload.abreise_count,
            bleibe_count: basePayload.bleibe_count,
            checker_count: basePayload.checker_count,
            cleaner_count: basePayload.cleaner_count,
            public_count: basePayload.public_count,
            spuler_count: basePayload.spuler_count,
            photo_url: basePayload.photo_url,
          })
          .eq("id", lastEntry.id);
        insertError = result.error;
      } else {
        const result = await supabase.from("daily_reports").insert(basePayload);
        insertError = result.error;
      }

      if (insertError) {
        throw insertError;
      }

      setLastEntry({
        id: lastEntry?.id ?? crypto.randomUUID(),
        created_at: basePayload.created_at,
        hotel_id: currentHotelId,
        abreise_count: Number(abreise),
        bleibe_count: Number(bleibe),
        checker_count: Number(checkerCount || 0),
        cleaner_count: Number(cleanerCount || 0),
        public_count: Number(publicCount || 0),
        spuler_count: Number(spulerCount || 0),
        photo_url: photoUrlSerialized || null,
      });
      setSuccessMessage(t("reports.reportSaved"));
      setPhotoFiles([]);
      setFileInputKey((prev) => prev + 1);
      window.setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      const errorDetails = formatSupabaseError(error);
      console.error("Daily report modulu hatasi", { details: errorDetails });
      setErrorMessage(errorDetails);
      window.setTimeout(() => setErrorMessage(""), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h1 className="text-2xl font-semibold text-[#101828]">{currentHotel} - {t("reports.hotelReportTitle")}</h1>
        <p className="mt-1 text-sm text-[#475467]">
          {t("reports.subtitle")}
        </p>
        {isAdmin && !scopeLoading && (
            <div className="mt-3 max-w-xl">
              <label className="mb-1 block text-sm font-medium text-[#344054]">{t("admin.selectHotel")}</label>
              <select
                value={selectedHotelId}
                onChange={(event) => setSelectedHotelId(event.target.value)}
                className="h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
              >
                {hotelOptions.length === 0 ? (
                  <option value="">{t("layout.noHotelsInDb")}</option>
                ) : (
                  hotelOptions.map((h) => (
                    <option key={h} value={h} title={h}>
                      {getHotelDisplayName(h)}
                    </option>
                  ))
                )}
              </select>
            <p className="mt-1 text-xs text-[#667085]">{t("reports.adminHotelNote")}</p>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#344054]">
            <CalendarDays className="h-4 w-4 text-brand" />
            {t("reports.calendar")}
          </div>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(date) => setSelectedDate(date ?? new Date())}
            className="rounded-md bg-white"
            classNames={{
              month: "space-y-4",
              caption: "flex justify-center py-2 text-sm font-semibold text-[#344054]",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell: "w-9 text-xs text-[#667085] font-medium",
              row: "mt-2 flex w-full",
              cell: "w-9 h-9 text-center text-sm",
              day: "h-9 w-9 rounded-md hover:bg-[#e4ecf7]",
              selected:
                "bg-brand text-white hover:bg-brand focus:bg-brand",
              today: "border border-[#98a2b3]",
              button_previous:
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-brand bg-brand text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40",
              button_next:
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-brand bg-brand text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40",
              chevron: "h-4 w-4 text-inherit [color:currentColor]",
            }}
          />
        </section>

        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d0d5dd] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#101828]">{t("reports.reportInput")}</h2>
          <p className="mt-1 text-sm text-[#667085]">{reportTitle}</p>

          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-[#344054]">{t("reports.departure")}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={abreise}
                  onChange={(event) => setAbreise(event.target.value)}
                  required
                  className="h-11 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-[#344054]">{t("reports.stay")}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={bleibe}
                  onChange={(event) => setBleibe(event.target.value)}
                  required
                  className="h-11 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-[#344054]">{t("reports.checkerCount")}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={checkerCount}
                  onChange={(event) => setCheckerCount(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-[#344054]">{t("reports.cleanerCount")}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={cleanerCount}
                  onChange={(event) => setCleanerCount(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-[#344054]">{t("reports.publicCount")}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={publicCount}
                  onChange={(event) => setPublicCount(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-[#344054]">{t("reports.spulerCount")}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={spulerCount}
                  onChange={(event) => setSpulerCount(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
                />
              </label>
            </div>

            <div className="block">
              <span className="mb-1.5 block text-sm font-medium text-[#344054]">{t("reports.uploadPhoto")}</span>
              <p className="mb-1.5 text-xs text-[#667085]">{t("reports.photoMultiselectHint")}</p>
              <label className="block cursor-pointer">
                <div className="flex h-12 items-center gap-2 rounded-md border border-dashed border-[#98a2b3] bg-[#f8fafc] px-3 text-sm text-[#344054]">
                  <Camera className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{filePickerLabel}</span>
                </div>
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(event) => setPhotoFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              {pendingPreviews.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium text-[#667085]">{t("reports.photoPreview")}</p>
                  <ul className="flex flex-wrap gap-2">
                    {pendingPreviews.map((url, i) => (
                      <li key={url}>
                        <button
                          type="button"
                          onClick={() => setLightbox({ source: "pending", index: i })}
                          className="group block overflow-hidden rounded-md border border-[#d0d5dd] ring-[#98a2b3] transition hover:scale-105 hover:ring-2 focus-visible:outline focus-visible:ring-2"
                        >
                          <img
                            src={url}
                            alt={`${t("reports.listPhotoAlt")} ${i + 1}`}
                            className="h-20 w-20 object-cover"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-md border border-[#d0d5dd] bg-[#f9fafb] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
                {t("reports.futureModuleTitle")}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-md border border-dashed border-[#d0d5dd] bg-white p-2 text-xs text-[#475467]">
                  <PackageSearch className="h-4 w-4 text-[#344054]" />
                  {t("reports.futureInventoryQuestion")}
                </div>
                <div className="flex items-center gap-2 rounded-md border border-dashed border-[#d0d5dd] bg-white p-2 text-xs text-[#475467]">
                  <Wrench className="h-4 w-4 text-[#344054]" />
                  {t("reports.futureTaskQuestion")}
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-brand px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-[#9ca3af]"
          >
            {isSaving ? t("reports.savingButton") : t("reports.doneButton")}
          </button>
        </form>

        <section className="space-y-4">
          <div className="rounded-xl border border-[#d0d5dd] bg-white p-5">
            <h3 className="text-base font-semibold text-[#101828]">{t("reports.latestEntry")}</h3>
            {isLoadingLastEntry ? (
              <p className="mt-2 text-sm text-[#667085]">{t("common.loading")}</p>
            ) : lastEntry ? (
              <div className="mt-3 space-y-3">
                <p className="text-xs font-medium text-[#667085]">
                  {t("reports.lastUpdate")}: {formatTime(lastEntry.created_at)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-[#d0d5dd] bg-[#f8fafc] p-3">
                    <p className="text-xs text-[#667085]">{t("reports.departure")}</p>
                    <p className="text-2xl font-semibold text-brand">{lastEntry.abreise_count ?? 0}</p>
                  </div>
                  <div className="rounded-md border border-[#d0d5dd] bg-[#f8fafc] p-3">
                    <p className="text-xs text-[#667085]">{t("reports.stay")}</p>
                    <p className="text-2xl font-semibold text-brand">{lastEntry.bleibe_count ?? 0}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-[#d0d5dd] bg-[#f8fafc] p-3">
                    <p className="text-xs text-[#667085]">{t("reports.checkerCount")}</p>
                    <p className="text-2xl font-semibold text-brand">{lastEntry.checker_count ?? 0}</p>
                  </div>
                  <div className="rounded-md border border-[#d0d5dd] bg-[#f8fafc] p-3">
                    <p className="text-xs text-[#667085]">{t("reports.cleanerCount")}</p>
                    <p className="text-2xl font-semibold text-brand">{lastEntry.cleaner_count ?? 0}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-[#d0d5dd] bg-[#f8fafc] p-3">
                    <p className="text-xs text-[#667085]">{t("reports.publicCount")}</p>
                    <p className="text-2xl font-semibold text-brand">{lastEntry.public_count ?? 0}</p>
                  </div>
                  <div className="rounded-md border border-[#d0d5dd] bg-[#f8fafc] p-3">
                    <p className="text-xs text-[#667085]">{t("reports.spulerCount")}</p>
                    <p className="text-2xl font-semibold text-brand">{lastEntry.spuler_count ?? 0}</p>
                  </div>
                </div>
                <div className="rounded-md border border-[#d0d5dd] bg-[#f8fafc] p-3">
                  <p className="mb-2 text-xs text-[#667085]">{t("reports.photoPreview")}</p>
                  {entryPhotoUrls.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {entryPhotoUrls.map((url, i) => (
                        <li key={url + String(i)}>
                          <button
                            type="button"
                            onClick={() => setLightbox({ source: "entry", index: i })}
                            className="group block overflow-hidden rounded-md border border-[#d0d5dd] ring-[#98a2b3] transition hover:scale-105 hover:ring-2 focus-visible:outline focus-visible:ring-2"
                          >
                            <img
                              src={url}
                              alt={`${t("reports.listPhotoAlt")} ${i + 1}`}
                              className="h-20 w-20 object-cover"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[#667085]">{t("reports.noPhoto")}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#667085]">{t("reports.noEntry")}</p>
            )}
          </div>

          <div className="rounded-xl border border-[#d0d5dd] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">{t("reports.statusTitle")}</p>
            <p className="mt-2 text-sm text-[#344054]">
              {t("reports.statusBody")}
            </p>
          </div>
        </section>
      </div>

      {lightbox && lightboxCurrentUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal
          aria-label={t("reports.photoPreview")}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/80"
            aria-label={t("reports.closeLightbox")}
            onClick={() => setLightbox(null)}
          />
          <button
            type="button"
            className="absolute right-4 top-4 z-20 rounded-md bg-white/15 p-2 text-white transition hover:bg-white/25"
            aria-label={t("reports.closeLightbox")}
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxCount > 1 && (
            <button
              type="button"
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-md bg-white/15 p-2 text-white transition hover:bg-white/25"
              aria-label="Previous"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((L) => {
                  if (!L) {
                    return L;
                  }
                  const list = L.source === "pending" ? pendingPreviews : entryPhotoUrls;
                  if (list.length < 2) {
                    return L;
                  }
                  return { source: L.source, index: (L.index - 1 + list.length) % list.length };
                });
              }}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {lightboxCount > 1 && (
            <button
              type="button"
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-md bg-white/15 p-2 text-white transition hover:bg-white/25"
              aria-label="Next"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox((L) => {
                  if (!L) {
                    return L;
                  }
                  const list = L.source === "pending" ? pendingPreviews : entryPhotoUrls;
                  if (list.length < 2) {
                    return L;
                  }
                  return { source: L.source, index: (L.index + 1) % list.length };
                });
              }}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
          <img
            src={lightboxCurrentUrl}
            alt={t("reports.listPhotoAlt")}
            className="relative z-10 max-h-[min(90vh,90vw)] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxCount > 1 && (
            <p className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 text-sm text-white/95">
              {lightbox.index + 1} / {lightboxCount}
            </p>
          )}
        </div>
      )}

      {successMessage && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-md border border-[#abefc6] bg-[#ecfdf3] px-3 py-2 text-sm font-medium text-[#067647]">
          <CheckCircle2 className="h-4 w-4" />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="fixed bottom-5 right-5 z-40 rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm font-medium text-[#b42318]">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
