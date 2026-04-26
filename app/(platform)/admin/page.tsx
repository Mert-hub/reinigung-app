"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/src/i18n/provider";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";
import { ForecastModule } from "@/src/components/reports/forecast-module";

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
};

export default function AdminPage() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportRow[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [profilesError, setProfilesError] = useState("");
  const [reportsError, setReportsError] = useState("");
  const [selectedHotel, setSelectedHotel] = useState<string>("all");

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
          .select("id, created_at, hotel_id, abreise_count, bleibe_count, checker_count, cleaner_count")
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

  const hotelOptions = useMemo(
    () =>
      Array.from(new Set(dailyReports.map((report) => report.hotel_id).filter(Boolean))) as string[],
    [dailyReports],
  );

  const filteredReports = useMemo(
    () =>
      selectedHotel === "all"
        ? dailyReports
        : dailyReports.filter((report) => report.hotel_id === selectedHotel),
    [dailyReports, selectedHotel],
  );

  const overviewTotals = useMemo(
    () =>
      filteredReports.reduce(
        (acc, report) => {
          acc.abreise += report.abreise_count ?? 0;
          acc.bleibe += report.bleibe_count ?? 0;
          acc.checker += report.checker_count ?? 0;
          acc.cleaner += report.cleaner_count ?? 0;
          return acc;
        },
        { abreise: 0, bleibe: 0, checker: 0, cleaner: 0 },
      ),
    [filteredReports],
  );

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
        <div className="mt-3 max-w-sm">
          <label className="mb-1 block text-sm font-medium text-[#344054]">{t("admin.selectHotel")}</label>
          <select
            value={selectedHotel}
            onChange={(event) => setSelectedHotel(event.target.value)}
            className="h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
          >
            <option value="all">{t("admin.allHotels")}</option>
            {hotelOptions.map((hotel) => (
              <option key={hotel} value={hotel}>
                {hotel}
              </option>
            ))}
          </select>
        </div>

        {reportsError && (
          <p className="mt-3 rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">
            {reportsError}
          </p>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-[#d0d5dd] bg-[#f9fafb] p-3">
            <p className="text-xs text-[#667085]">{t("admin.totalAbreise")}</p>
            <p className="text-2xl font-semibold text-brand">{overviewTotals.abreise}</p>
          </div>
          <div className="rounded-md border border-[#d0d5dd] bg-[#f9fafb] p-3">
            <p className="text-xs text-[#667085]">{t("admin.totalBleibe")}</p>
            <p className="text-2xl font-semibold text-brand">{overviewTotals.bleibe}</p>
          </div>
          <div className="rounded-md border border-[#d0d5dd] bg-[#f9fafb] p-3">
            <p className="text-xs text-[#667085]">{t("admin.totalChecker")}</p>
            <p className="text-2xl font-semibold text-brand">{overviewTotals.checker}</p>
          </div>
          <div className="rounded-md border border-[#d0d5dd] bg-[#f9fafb] p-3">
            <p className="text-xs text-[#667085]">{t("admin.totalCleaner")}</p>
            <p className="text-2xl font-semibold text-brand">{overviewTotals.cleaner}</p>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#f9fafb] text-left text-[#475467]">
                <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("admin.hotelId")}</th>
                <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("reports.departure")}</th>
                <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("reports.stay")}</th>
                <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("reports.checkerCount")}</th>
                <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("reports.cleanerCount")}</th>
                <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("reports.lastUpdate")}</th>
              </tr>
            </thead>
            <tbody>
              {loadingReports ? (
                <tr>
                  <td colSpan={6} className="border border-[#eaecf0] px-3 py-3 text-center text-[#667085]">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-[#eaecf0] px-3 py-3 text-center text-[#667085]">
                    {t("reports.noEntry")}
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr key={report.id} className="odd:bg-white even:bg-[#f9fafb]">
                    <td className="border border-[#eaecf0] px-3 py-2">{report.hotel_id ?? "-"}</td>
                    <td className="border border-[#eaecf0] px-3 py-2">{report.abreise_count ?? 0}</td>
                    <td className="border border-[#eaecf0] px-3 py-2">{report.bleibe_count ?? 0}</td>
                    <td className="border border-[#eaecf0] px-3 py-2">{report.checker_count ?? 0}</td>
                    <td className="border border-[#eaecf0] px-3 py-2">{report.cleaner_count ?? 0}</td>
                    <td className="border border-[#eaecf0] px-3 py-2">
                      {report.created_at
                        ? new Intl.DateTimeFormat("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(report.created_at))
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h2 className="text-xl font-semibold text-[#101828]">{t("admin.forecastOverviewTitle")}</h2>
        <p className="mt-1 text-sm text-[#475467]">{t("admin.selectHotel")}</p>
        <div className="mt-3">
          <ForecastModule />
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
                    <td className="border border-[#eaecf0] px-3 py-2">{profile.hotel_id ?? "-"}</td>
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
    </div>
  );
}
