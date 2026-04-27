"use client";

import { format } from "date-fns";
import { de, enUS, tr, uk } from "date-fns/locale";
import { ChevronLeft, ChevronRight, FileText, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/src/i18n/provider";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";
import { ForecastModule } from "@/src/components/reports/forecast-module";
import { getHotelCatalogIds, getHotelDisplayName } from "@/src/lib/hotel-catalog";

type ProfileRow = {
  id: string;
  role: string;
  hotel_id: string | null;
  created_at: string | null;
};

type DailyReportRow = {
  id: string;
  created_at: string | null;
  hotel_id: string | null;
  abreise_count: number | null;
  bleibe_count: number | null;
  checker_count: number | null;
  cleaner_count: number | null;
  public_count: number | null;
  spuler_count: number | null;
  photo_url: string | null;
};

type HotelUploadStatus = {
  hotelId: string;
  hotelName: string;
  sent: boolean;
  sentAt: string | null;
};

/** Local calendar day bounds (same idea as DailyReportModule: midnight → next midnight in browser TZ). */
function useLocalDayBoundsMs(ymd: string) {
  return useMemo(() => {
    const parts = ymd.split("-").map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (!y || !m || !d) {
      return null;
    }
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [ymd]);
}

function createdAtInLocalDay(createdAt: string | null, bounds: { startMs: number; endMs: number } | null) {
  if (!createdAt || !bounds) {
    return false;
  }
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) {
    return false;
  }
  return t >= bounds.startMs && t < bounds.endMs;
}

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

export default function AdminPage() {
  const { locale, t } = useI18n();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportRow[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [profilesError, setProfilesError] = useState("");
  const [reportsError, setReportsError] = useState("");
  const [selectedHotel, setSelectedHotel] = useState<string>("all");
  const [selectedReportDate, setSelectedReportDate] = useState<string>(todayIso);
  const [lightboxItems, setLightboxItems] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      setLoadingProfiles(true);
      setLoadingReports(true);
      setProfilesError("");
      setReportsError("");
      try {
        const supabase = getSupabaseClient();
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, role, hotel_id, created_at")
          .order("created_at", { ascending: false });

        if (profileError) {
          throw profileError;
        }
        setProfiles((profileData as ProfileRow[]) ?? []);

        const { data: reportData, error: reportError } = await supabase
          .from("daily_reports")
          .select(
            "id, created_at, hotel_id, abreise_count, bleibe_count, checker_count, cleaner_count, public_count, spuler_count, photo_url",
          )
          .order("created_at", { ascending: false });
        if (reportError) {
          throw reportError;
        }
        setDailyReports((reportData as DailyReportRow[]) ?? []);
      } catch (error) {
        const details = formatSupabaseError(error);
        setProfilesError(`${t("admin.loadEmployeesFailed")}: ${details}`);
        setReportsError(`${t("reports.reportLoadFailed")}: ${details}`);
      } finally {
        setLoadingProfiles(false);
        setLoadingReports(false);
      }
    };

    void loadData();
  }, [t]);

  const roleBadgeClass = useMemo(
    () => ({
      admin: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
      vorarbeiter: "border-[#d0d5dd] bg-[#f9fafb] text-[#344054]",
    }),
    [],
  );

  const hotelFilterOptions = useMemo(() => {
    const fromReports = dailyReports.map((report) => report.hotel_id).filter(Boolean) as string[];
    const fromProfiles = profiles.map((profile) => profile.hotel_id).filter(Boolean) as string[];
    return Array.from(new Set([...getHotelCatalogIds(), ...fromReports, ...fromProfiles])).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }, [dailyReports, profiles]);
  const calendarLocale = locale === "tr" ? tr : locale === "en" ? enUS : locale === "uk" ? uk : de;

  const selectedLocalDayBounds = useLocalDayBoundsMs(selectedReportDate);

  const selectedDateAsDate = useMemo(() => {
    if (!selectedLocalDayBounds) {
      return new Date();
    }
    return new Date(selectedLocalDayBounds.startMs);
  }, [selectedLocalDayBounds]);

  /** Latest report per hotel for the selected calendar day (avoids double-counting). */
  const latestReportsByHotelForDate = useMemo(() => {
    if (!selectedLocalDayBounds) {
      return [];
    }
    const rows = dailyReports.filter(
      (report) => !!report.hotel_id && createdAtInLocalDay(report.created_at, selectedLocalDayBounds),
    );
    const byHotel = new Map<string, DailyReportRow>();
    for (const row of rows) {
      const hid = row.hotel_id as string;
      const prev = byHotel.get(hid);
      if (!prev || (row.created_at ?? "") > (prev.created_at ?? "")) {
        byHotel.set(hid, row);
      }
    }
    return Array.from(byHotel.values());
  }, [dailyReports, selectedLocalDayBounds]);

  const dailyTotalsForDate = useMemo(() => {
    const rows = latestReportsByHotelForDate;
    return {
      abreise: rows.reduce((s, r) => s + (r.abreise_count ?? 0), 0),
      bleibe: rows.reduce((s, r) => s + (r.bleibe_count ?? 0), 0),
      checker: rows.reduce((s, r) => s + (r.checker_count ?? 0), 0),
      cleaner: rows.reduce((s, r) => s + (r.cleaner_count ?? 0), 0),
      public: rows.reduce((s, r) => s + (r.public_count ?? 0), 0),
      spuler: rows.reduce((s, r) => s + (r.spuler_count ?? 0), 0),
    };
  }, [latestReportsByHotelForDate]);

  const filteredReportsForAdminView = useMemo(
    () =>
      latestReportsByHotelForDate
        .filter((report) => selectedHotel === "all" || report.hotel_id === selectedHotel)
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
    [latestReportsByHotelForDate, selectedHotel],
  );

  const openLightbox = (items: string[], index: number) => {
    setLightboxItems(items);
    setLightboxIndex(index);
  };
  const closeLightbox = () => {
    setLightboxItems([]);
    setLightboxIndex(0);
  };
  const lightboxCurrent = lightboxItems[lightboxIndex] ?? null;

  useEffect(() => {
    if (!lightboxCurrent) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
        return;
      }
      if (lightboxItems.length < 2) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLightboxIndex((prev) => (prev - 1 + lightboxItems.length) % lightboxItems.length);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setLightboxIndex((prev) => (prev + 1) % lightboxItems.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxCurrent, lightboxItems.length]);

  const hotelUploadStatusRows = useMemo<HotelUploadStatus[]>(() => {
    if (!selectedLocalDayBounds) {
      return [];
    }
    const reportDateRows = dailyReports.filter(
      (report) => !!report.hotel_id && createdAtInLocalDay(report.created_at, selectedLocalDayBounds),
    );
    const hotelsFromReports = reportDateRows.map((row) => row.hotel_id!).filter(Boolean);
    const hotelsFromProfiles = profiles
      .filter((profile) => profile.role.toLowerCase() === "vorarbeiter" && profile.hotel_id)
      .map((profile) => profile.hotel_id as string);
    const hotelIds = Array.from(new Set([...getHotelCatalogIds(), ...hotelsFromReports, ...hotelsFromProfiles])).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    return hotelIds.map((hotelId) => {
      const reportsForHotel = reportDateRows
        .filter((row) => row.hotel_id === hotelId)
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      const latest = reportsForHotel[0];
      return {
        hotelId,
        hotelName: getHotelDisplayName(hotelId),
        sent: Boolean(latest?.created_at),
        sentAt: latest?.created_at ?? null,
      };
    });
  }, [dailyReports, profiles, selectedLocalDayBounds]);

  const formatOnlyTime = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(value))
      : "-";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#d0d5dd] bg-white p-6">
        <h1 className="text-2xl font-semibold text-[#101828]">{t("admin.title")}</h1>
        <p className="mt-1 text-sm text-[#475467]">
          {t("admin.subtitle")}
        </p>
      </section>

      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h2 className="text-xl font-semibold text-[#101828]">{t("admin.reportsOverviewTitle")}</h2>
        <p className="mt-1 text-sm text-[#475467]">{t("admin.reportsSameAsOperationsHint")}</p>
        <div className="mt-3 max-w-xl">
          <label className="mb-1 block text-sm font-medium text-[#344054]">{t("admin.selectHotel")}</label>
          <select
            value={selectedHotel}
            onChange={(event) => setSelectedHotel(event.target.value)}
            className="h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
          >
            <option value="all">{t("admin.allHotels")}</option>
            {hotelFilterOptions.map((hotelId) => (
              <option key={hotelId} value={hotelId} title={hotelId}>
                {getHotelDisplayName(hotelId)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 max-w-sm">
          <label className="mb-1 block text-sm font-medium text-[#344054]">{t("admin.selectReportDate")}</label>
          <div className="rounded-lg border border-[#d0d5dd] bg-white p-3">
            <DayPicker
              mode="single"
              selected={selectedDateAsDate}
              onSelect={(date) => {
                if (!date) return;
                setSelectedReportDate(format(date, "yyyy-MM-dd"));
              }}
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
                selected: "bg-brand text-white hover:bg-brand focus:bg-brand",
                today: "border border-[#98a2b3]",
                button_previous:
                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-brand bg-brand text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40",
                button_next:
                  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-brand bg-brand text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40",
                chevron: "h-4 w-4 text-inherit [color:currentColor]",
              }}
              locale={calendarLocale}
            />
          </div>
        </div>
        {selectedHotel === "all" && (
          <>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[#667085]">{t("admin.dailyTotalsTitle")}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-md border border-brand/30 bg-brand-muted px-3 py-2">
                <p className="text-xs text-[#475467]">{t("admin.totalAbreise")}</p>
                <p className="text-2xl font-bold text-brand">{loadingReports ? "—" : dailyTotalsForDate.abreise}</p>
              </div>
              <div className="rounded-md border border-brand/30 bg-brand-muted px-3 py-2">
                <p className="text-xs text-[#475467]">{t("admin.totalBleibe")}</p>
                <p className="text-2xl font-bold text-brand">{loadingReports ? "—" : dailyTotalsForDate.bleibe}</p>
              </div>
              <div className="rounded-md border border-brand/30 bg-brand-muted px-3 py-2">
                <p className="text-xs text-[#475467]">{t("admin.totalChecker")}</p>
                <p className="text-2xl font-bold text-brand">{loadingReports ? "—" : dailyTotalsForDate.checker}</p>
              </div>
              <div className="rounded-md border border-brand/30 bg-brand-muted px-3 py-2">
                <p className="text-xs text-[#475467]">{t("admin.totalCleaner")}</p>
                <p className="text-2xl font-bold text-brand">{loadingReports ? "—" : dailyTotalsForDate.cleaner}</p>
              </div>
              <div className="rounded-md border border-brand/30 bg-brand-muted px-3 py-2">
                <p className="text-xs text-[#475467]">{t("admin.totalPublic")}</p>
                <p className="text-2xl font-bold text-brand">{loadingReports ? "—" : dailyTotalsForDate.public}</p>
              </div>
              <div className="rounded-md border border-brand/30 bg-brand-muted px-3 py-2">
                <p className="text-xs text-[#475467]">{t("admin.totalSpuler")}</p>
                <p className="text-2xl font-bold text-brand">{loadingReports ? "—" : dailyTotalsForDate.spuler}</p>
              </div>
            </div>
          </>
        )}

        {reportsError && (
          <p className="mt-3 rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">
            {reportsError}
          </p>
        )}

        <div className="mt-4 space-y-3">
          {loadingReports ? (
            <p className="text-sm text-[#667085]">{t("common.loading")}</p>
          ) : filteredReportsForAdminView.length === 0 ? (
            <p className="text-sm text-[#667085]">{t("reports.noEntry")}</p>
          ) : (
            filteredReportsForAdminView.map((report) => {
              const photoUrls = parsePhotoUrls(report.photo_url);
              return (
                <article key={report.id} className="rounded-lg border border-[#eaecf0] bg-[#f9fafb] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#101828]">
                      {report.hotel_id ? getHotelDisplayName(report.hotel_id) : "-"}
                    </p>
                    <p className="text-xs text-[#667085]">
                      {report.created_at
                        ? new Intl.DateTimeFormat("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(report.created_at))
                        : "-"}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-md border border-[#d0d5dd] bg-white px-2.5 py-2">
                      <p className="text-[11px] text-[#667085]">{t("reports.departure")}</p>
                      <p className="text-base font-semibold text-brand">{report.abreise_count ?? 0}</p>
                    </div>
                    <div className="rounded-md border border-[#d0d5dd] bg-white px-2.5 py-2">
                      <p className="text-[11px] text-[#667085]">{t("reports.stay")}</p>
                      <p className="text-base font-semibold text-brand">{report.bleibe_count ?? 0}</p>
                    </div>
                    <div className="rounded-md border border-[#d0d5dd] bg-white px-2.5 py-2">
                      <p className="text-[11px] text-[#667085]">{t("reports.checkerCount")}</p>
                      <p className="text-base font-semibold text-brand">{report.checker_count ?? 0}</p>
                    </div>
                    <div className="rounded-md border border-[#d0d5dd] bg-white px-2.5 py-2">
                      <p className="text-[11px] text-[#667085]">{t("reports.cleanerCount")}</p>
                      <p className="text-base font-semibold text-brand">{report.cleaner_count ?? 0}</p>
                    </div>
                    <div className="rounded-md border border-[#d0d5dd] bg-white px-2.5 py-2">
                      <p className="text-[11px] text-[#667085]">{t("reports.publicCount")}</p>
                      <p className="text-base font-semibold text-brand">{report.public_count ?? 0}</p>
                    </div>
                    <div className="rounded-md border border-[#d0d5dd] bg-white px-2.5 py-2">
                      <p className="text-[11px] text-[#667085]">{t("reports.spulerCount")}</p>
                      <p className="text-base font-semibold text-brand">{report.spuler_count ?? 0}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-[#667085]">{t("admin.documentPreview")}</p>
                    {photoUrls.length === 0 ? (
                      <p className="text-xs text-[#667085]">{t("reports.noPhoto")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {photoUrls.map((url, index) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => openLightbox(photoUrls, index)}
                            className="overflow-hidden rounded-md border border-[#d0d5dd] bg-white"
                          >
                            <img src={url} alt={t("admin.documentPreview")} className="h-16 w-16 object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h2 className="text-xl font-semibold text-[#101828]">{t("admin.reportUploadStatusTitle")}</h2>
        <p className="mt-1 text-sm text-[#475467]">{t("admin.reportUploadStatusSubtitle")}</p>
        <div className="mt-3 max-w-sm">
          <label className="mb-1 block text-sm font-medium text-[#344054]">{t("admin.selectReportDate")}</label>
          <input
            type="date"
            value={selectedReportDate}
            onChange={(event) => setSelectedReportDate(event.target.value)}
            className="h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
          />
        </div>
        <div className="mt-3 space-y-2.5">
          {loadingProfiles || loadingReports ? (
            <p className="text-sm text-[#667085]">{t("common.loading")}</p>
          ) : hotelUploadStatusRows.length === 0 ? (
            <p className="text-sm text-[#667085]">{t("layout.noHotelsInDb")}</p>
          ) : (
            hotelUploadStatusRows.map((row) => (
              <div
                key={row.hotelId}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-[#eaecf0] bg-[#f9fafb] px-3 py-2.5"
              >
                <p className="text-sm font-medium text-[#101828]">{row.hotelName}</p>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      row.sent
                        ? "border-[#abefc6] bg-[#ecfdf3] text-[#067647]"
                        : "border-[#fecdca] bg-[#fef3f2] text-[#b42318]"
                    }`}
                  >
                    {row.sent ? t("admin.reportSent") : t("admin.reportMissing")}
                  </span>
                  {row.sent && row.sentAt && (
                    <span className="text-xs font-medium text-[#475467]">{formatOnlyTime(row.sentAt)}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h2 className="text-xl font-semibold text-[#101828]">{t("admin.forecastOverviewTitle")}</h2>
        <p className="mt-1 text-sm text-[#475467]">{t("admin.selectHotel")}</p>
        <div className="mt-3">
          <ForecastModule viewOnly />
        </div>
      </section>

      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h2 className="text-xl font-semibold text-[#101828]">{t("admin.employeesTitle")}</h2>
        <p className="mt-1 text-sm text-[#475467]">{t("admin.employeesSubtitle")}</p>

        {profilesError && (
          <p className="mt-3 rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">
            {profilesError}
          </p>
        )}

        {loadingProfiles ? (
          <p className="mt-3 text-sm text-[#667085]">{t("common.loading")}</p>
        ) : profiles.length === 0 ? (
          <p className="mt-3 text-sm text-[#667085]">{t("admin.noEmployees")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#f9fafb] text-left text-[#475467]">
                  <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("admin.employeeId")}</th>
                  <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("admin.role")}</th>
                  <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("admin.hotelId")}</th>
                  <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("reports.lastUpdate")}</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id} className="odd:bg-white even:bg-[#f9fafb]">
                    <td className="border border-[#eaecf0] px-3 py-2 font-mono text-xs text-[#344054]">
                      {profile.id}
                    </td>
                    <td className="border border-[#eaecf0] px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          roleBadgeClass[profile.role as keyof typeof roleBadgeClass] ??
                          "border-[#d0d5dd] bg-[#f9fafb] text-[#344054]"
                        }`}
                      >
                        {profile.role}
                      </span>
                    </td>
                    <td className="border border-[#eaecf0] px-3 py-2" title={profile.hotel_id ?? ""}>
                      {profile.hotel_id ? getHotelDisplayName(profile.hotel_id) : "-"}
                    </td>
                    <td className="border border-[#eaecf0] px-3 py-2">
                      {profile.created_at
                        ? new Intl.DateTimeFormat("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(profile.created_at))
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {lightboxCurrent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
          <button type="button" className="absolute inset-0 bg-black/80" onClick={closeLightbox} aria-label="Close" />
          <button
            type="button"
            className="absolute right-4 top-4 z-20 rounded-md bg-white/15 p-2 text-white transition hover:bg-white/25"
            onClick={closeLightbox}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxItems.length > 1 && (
            <button
              type="button"
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-md bg-white/15 p-2 text-white transition hover:bg-white/25"
              aria-label="Previous"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => (prev - 1 + lightboxItems.length) % lightboxItems.length);
              }}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {lightboxItems.length > 1 && (
            <button
              type="button"
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-md bg-white/15 p-2 text-white transition hover:bg-white/25"
              aria-label="Next"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => (prev + 1) % lightboxItems.length);
              }}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
          <div className="relative z-10 max-h-[90vh] max-w-[92vw] overflow-hidden rounded-xl border border-line bg-white">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm font-medium text-[#344054]">
              <FileText className="h-4 w-4" />
              {t("admin.documentPreview")}
            </div>
            <img src={lightboxCurrent} alt={t("admin.documentPreview")} className="max-h-[80vh] max-w-[92vw] object-contain" />
          </div>
          {lightboxItems.length > 1 && (
            <p className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 text-sm text-white/95">
              {lightboxIndex + 1} / {lightboxItems.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
