"use client";

import { addDays, format } from "date-fns";
import { de, enUS, tr, uk } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHotelScope } from "@/src/contexts/hotel-scope-context";
import { useI18n } from "@/src/i18n/provider";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";
import { getCurrentUser } from "@/src/lib/auth";

type ForecastRow = {
  date: string;
  label: string;
  abreise: number;
  bleibe: number;
  occupancy: number;
};

function getWeekBaseRows(locale: "de" | "en" | "tr" | "uk") {
  const dfLocale = locale === "tr" ? tr : locale === "en" ? enUS : locale === "uk" ? uk : de;
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index);
    return {
      date: format(day, "yyyy-MM-dd"),
      label: format(day, "EEE dd.MM", { locale: dfLocale }),
      abreise: 0,
      bleibe: 0,
      occupancy: 0,
    };
  });
}

export function ForecastModule() {
  const { locale, t } = useI18n();
  const { effectiveHotelId, isAdmin, hotelOptions, isLoading: hotelScopeLoading, setSelectedHotelId, selectedHotelId } =
    useHotelScope();
  const [rows, setRows] = useState<ForecastRow[]>(() => getWeekBaseRows(locale));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    void Promise.resolve().then(() => {
      setRows(getWeekBaseRows(locale));
    });
  }, [locale]);

  useEffect(() => {
    if (hotelScopeLoading) {
      return;
    }

    const load = async () => {
      await Promise.resolve();
      if (!effectiveHotelId) {
        setIsLoading(false);
        setErrorMessage(t("forecast.noHotel"));
        return;
      }
      setIsLoading(true);
      setErrorMessage("");
      try {
        const supabase = getSupabaseClient();
        const dates = getWeekBaseRows(locale).map((row) => row.date);
        const { data, error } = await supabase
          .from("pms_forecasts")
          .select("forecast_date, abreise_expected, bleibe_expected")
          .eq("hotel_id", effectiveHotelId)
          .in("forecast_date", dates);

        if (error) {
          throw error;
        }

        if (data) {
          setRows((prev) =>
            prev.map((row) => {
              const match = data.find(
                (item) => String(item.forecast_date) === String(row.date).slice(0, 10),
              );
              return {
                ...row,
                abreise: match?.abreise_expected ?? row.abreise,
                bleibe: match?.bleibe_expected ?? row.bleibe,
                // Belegung: `total_occupancy` sütunu yoksa sadece bu oturumda; kalici kayit icin `setup-production.sql` ile sütun ekleyin
                occupancy: row.occupancy,
              };
            }),
          );
        }
      } catch (error) {
        setErrorMessage(`${t("forecast.loadFailed")}: ${formatSupabaseError(error)}`);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [effectiveHotelId, hotelScopeLoading, locale, t]);

  const chartData = useMemo(
    () =>
      rows.map((row) => ({
        day: row.label,
        [t("reports.departure")]: row.abreise,
        [t("reports.stay")]: row.bleibe,
      })),
    [rows, t],
  );

  const updateCell = (index: number, field: "abreise" | "bleibe" | "occupancy", value: number) => {
    setRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    );
  };

  const saveForecast = async () => {
    if (!effectiveHotelId) {
      setErrorMessage(t("forecast.noHotel"));
      return;
    }
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error(t("forecast.noSession"));
      }

      const supabase = getSupabaseClient();
      const payload = rows.map((row) => ({
        hotel_id: effectiveHotelId,
        forecast_date: row.date,
        abreise_expected: row.abreise,
        bleibe_expected: row.bleibe,
      }));

      for (const rowPayload of payload) {
        const { data: existing, error: selectError } = await supabase
          .from("pms_forecasts")
          .select("id")
          .eq("hotel_id", rowPayload.hotel_id)
          .eq("forecast_date", rowPayload.forecast_date)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (selectError) {
          throw selectError;
        }

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from("pms_forecasts")
            .update({
              abreise_expected: rowPayload.abreise_expected,
              bleibe_expected: rowPayload.bleibe_expected,
            })
            .eq("id", existing.id);
          if (updateError) {
            throw updateError;
          }
        } else {
          const { error: insertError } = await supabase.from("pms_forecasts").insert(rowPayload);
          if (insertError) {
            throw insertError;
          }
        }
      }

      setSuccessMessage(t("forecast.saveSuccess"));
      window.setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(`${t("forecast.saveFailed")}: ${formatSupabaseError(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h1 className="text-2xl font-semibold text-[#101828]">{t("forecast.title")}</h1>
        <p className="mt-1 text-sm text-[#475467]">
          {t("forecast.subtitle")}
        </p>
        {isAdmin && !hotelScopeLoading && (
          <div className="mt-3 max-w-sm">
            <label className="mb-1 block text-sm font-medium text-[#344054]">{t("admin.selectHotel")}</label>
            <select
              value={selectedHotelId}
              onChange={(event) => setSelectedHotelId(event.target.value)}
              className="h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
            >
              {hotelOptions.length === 0 ? (
                <option value="">{t("layout.noHotelsInDb")}</option>
              ) : (
                hotelOptions.map((hotelOption) => (
                  <option key={hotelOption} value={hotelOption}>
                    {hotelOption}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-[#667085]">{t("layout.hotelScopeHint")}</p>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#f9fafb] text-left text-[#475467]">
                  <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("forecast.day")}</th>
                  <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("reports.departure")}</th>
                  <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("reports.stay")}</th>
                  <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("forecast.occupancy")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.date} className="odd:bg-white even:bg-[#f9fafb]">
                    <td className="border border-[#eaecf0] px-3 py-2 font-medium text-[#344054]">{row.label}</td>
                    <td className="border border-[#eaecf0] px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.abreise}
                        onChange={(event) =>
                          updateCell(index, "abreise", Number(event.target.value || 0))
                        }
                        className="h-9 w-24 rounded-md border border-[#d0d5dd] px-2 outline-none ring-[#98a2b3] focus:ring-2"
                      />
                    </td>
                    <td className="border border-[#eaecf0] px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.bleibe}
                        onChange={(event) =>
                          updateCell(index, "bleibe", Number(event.target.value || 0))
                        }
                        className="h-9 w-24 rounded-md border border-[#d0d5dd] px-2 outline-none ring-[#98a2b3] focus:ring-2"
                      />
                    </td>
                    <td className="border border-[#eaecf0] px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.occupancy}
                        onChange={(event) =>
                          updateCell(index, "occupancy", Number(event.target.value || 0))
                        }
                        className="h-9 w-28 rounded-md border border-[#d0d5dd] px-2 outline-none ring-[#98a2b3] focus:ring-2"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => void saveForecast()}
            disabled={isSaving || isLoading}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-[#9ca3af]"
          >
            {isSaving ? t("forecast.savingButton") : t("forecast.saveButton")}
          </button>
        </section>

        <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
          <h2 className="text-base font-semibold text-[#101828]">{t("forecast.chartTitle")}</h2>
          <div className="mt-3 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaecf0" />
                <XAxis dataKey="day" tick={{ fill: "#667085", fontSize: 11 }} />
                <YAxis tick={{ fill: "#667085", fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey={t("reports.departure")} fill="var(--brand)" radius={[4, 4, 0, 0]} />
                <Bar dataKey={t("reports.stay")} fill="#98a2b3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

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
    </div>
  );
}
