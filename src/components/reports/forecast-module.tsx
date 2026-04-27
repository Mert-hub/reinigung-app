"use client";

import { addDays, format } from "date-fns";
import { de, enUS, tr, uk } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHotelScope } from "@/src/contexts/hotel-scope-context";
import { useI18n } from "@/src/i18n/provider";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";
import { getHotelCatalogIds, getHotelDisplayName } from "@/src/lib/hotel-catalog";
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

type ForecastModuleProps = {
  /** Admin panel: show data + hotel scope only; no edits or save. */
  viewOnly?: boolean;
};

export function ForecastModule({ viewOnly = false }: ForecastModuleProps) {
  const { locale, t } = useI18n();
  const {
    effectiveHotelId,
    isAdmin,
    hotelOptions,
    isLoading: hotelScopeLoading,
    setSelectedHotelId,
    selectedHotelId,
  } = useHotelScope();
  /** Admin: aggregate all hotels in chart; single-hotel uses global scope + save. */
  const [aggregateAllHotels, setAggregateAllHotels] = useState(false);
  const [rows, setRows] = useState<ForecastRow[]>(() => getWeekBaseRows(locale));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const isAllHotelsSelected = isAdmin && aggregateAllHotels;
  const selectedHotelForForecast = isAllHotelsSelected ? null : effectiveHotelId;
  const tableReadOnly = viewOnly || isAllHotelsSelected;

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
      const availableHotels = Array.from(new Set([...getHotelCatalogIds(), ...hotelOptions]));
      if (!selectedHotelForForecast && !isAllHotelsSelected) {
        setIsLoading(false);
        setErrorMessage(t("forecast.noHotel"));
        return;
      }
      if (isAllHotelsSelected && availableHotels.length === 0) {
        setIsLoading(false);
        setErrorMessage(t("layout.noHotelsInDb"));
        return;
      }
      setIsLoading(true);
      setErrorMessage("");
      try {
        const supabase = getSupabaseClient();
        const dates = getWeekBaseRows(locale).map((row) => row.date);
        const query = supabase
          .from("pms_forecasts")
          .select("hotel_id, forecast_date, abreise_expected, bleibe_expected")
          .in("forecast_date", dates);
        const { data, error } = isAllHotelsSelected
          ? await query.in("hotel_id", availableHotels)
          : await query.eq("hotel_id", selectedHotelForForecast);

        if (error) {
          throw error;
        }

        if (data) {
          setRows((prev) =>
            prev.map((row) => {
              const matches = data.filter(
                (item) => String(item.forecast_date) === String(row.date).slice(0, 10),
              );
              const abreise = matches.reduce((sum, item) => sum + (item.abreise_expected ?? 0), 0);
              const bleibe = matches.reduce((sum, item) => sum + (item.bleibe_expected ?? 0), 0);
              return {
                ...row,
                abreise,
                bleibe,
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
  }, [selectedHotelForForecast, hotelScopeLoading, locale, t, isAllHotelsSelected, hotelOptions]);

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
    if (!selectedHotelForForecast) {
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
        hotel_id: selectedHotelForForecast,
        forecast_date: row.date,
        abreise_expected: row.abreise,
        bleibe_expected: row.bleibe,
      }));

      for (const rowPayload of payload) {
        const { data: existing, error: selectError } = await supabase
          .from("pms_forecasts")
          .select("hotel_id, forecast_date")
          .eq("hotel_id", rowPayload.hotel_id)
          .eq("forecast_date", rowPayload.forecast_date)
          .maybeSingle();

        if (selectError) {
          throw selectError;
        }

        if (existing) {
          const { error: updateError } = await supabase
            .from("pms_forecasts")
            .update({
              abreise_expected: rowPayload.abreise_expected,
              bleibe_expected: rowPayload.bleibe_expected,
            })
            .eq("hotel_id", rowPayload.hotel_id)
            .eq("forecast_date", rowPayload.forecast_date);
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
          <div className="mt-3 max-w-xl">
            <label className="mb-1 block text-sm font-medium text-[#344054]">{t("admin.selectHotel")}</label>
            <select
              value={aggregateAllHotels ? "all" : selectedHotelId}
              onChange={(event) => {
                const v = event.target.value;
                if (v === "all") {
                  setAggregateAllHotels(true);
                  return;
                }
                setAggregateAllHotels(false);
                setSelectedHotelId(v);
              }}
              className="h-10 w-full rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
            >
              <option value="all">{t("admin.allHotels")}</option>
              {hotelOptions.map((hotelId) => (
                <option key={hotelId} value={hotelId} title={hotelId}>
                  {getHotelDisplayName(hotelId)}
                </option>
              ))}
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
                      {tableReadOnly ? (
                        <span className="inline-block min-w-[4.5rem] px-1 text-sm font-semibold text-[#101828]">
                          {row.abreise}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={row.abreise}
                          onChange={(event) =>
                            updateCell(index, "abreise", Number(event.target.value || 0))
                          }
                          className="h-9 w-24 rounded-md border border-[#d0d5dd] px-2 outline-none ring-[#98a2b3] focus:ring-2"
                        />
                      )}
                    </td>
                    <td className="border border-[#eaecf0] px-3 py-2">
                      {tableReadOnly ? (
                        <span className="inline-block min-w-[4.5rem] px-1 text-sm font-semibold text-[#101828]">
                          {row.bleibe}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={row.bleibe}
                          onChange={(event) =>
                            updateCell(index, "bleibe", Number(event.target.value || 0))
                          }
                          className="h-9 w-24 rounded-md border border-[#d0d5dd] px-2 outline-none ring-[#98a2b3] focus:ring-2"
                        />
                      )}
                    </td>
                    <td className="border border-[#eaecf0] px-3 py-2">
                      {tableReadOnly ? (
                        <span className="inline-block min-w-[5rem] px-1 text-sm font-semibold text-[#101828]">
                          {row.occupancy}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={row.occupancy}
                          onChange={(event) =>
                            updateCell(index, "occupancy", Number(event.target.value || 0))
                          }
                          className="h-9 w-28 rounded-md border border-[#d0d5dd] px-2 outline-none ring-[#98a2b3] focus:ring-2"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!viewOnly && (
            <button
              type="button"
              onClick={() => void saveForecast()}
              disabled={isSaving || isLoading || isAllHotelsSelected}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-[#9ca3af]"
            >
              {isSaving ? t("forecast.savingButton") : t("forecast.saveButton")}
            </button>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-[#d0d5dd] bg-white p-5">
          <h2 className="text-base font-semibold text-[#101828]">{t("forecast.chartTitle")}</h2>
          <div className="mt-3 h-[320px] min-h-[320px] min-w-0">
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
