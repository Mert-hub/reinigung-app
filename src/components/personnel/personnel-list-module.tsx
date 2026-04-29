"use client";

import { useEffect, useState } from "react";
import { useHotelScope } from "@/src/contexts/hotel-scope-context";
import { useI18n } from "@/src/i18n/provider";
import { getHotelDisplayName } from "@/src/lib/hotel-catalog";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";

type PersonnelRow = {
  id: string;
  staff_no: string | null;
  name: string;
  role_label: string | null;
  is_active: boolean;
};

export function PersonnelListModule() {
  const { t } = useI18n();
  const { effectiveHotelId, isAdmin, hotelOptions, selectedHotelId, setSelectedHotelId, isLoading: scopeLoading } =
    useHotelScope();
  const [rows, setRows] = useState<PersonnelRow[]>([]);
  const [staffNo, setStaffNo] = useState("");
  const [name, setName] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (scopeLoading || !effectiveHotelId) return;
    const load = async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("personnel_directory")
        .select("id, staff_no, name, role_label, is_active")
        .eq("hotel_id", effectiveHotelId)
        .order("name", { ascending: true });
      if (error) {
        setErrorMessage(formatSupabaseError(error));
        return;
      }
      setRows((data ?? []) as PersonnelRow[]);
    };
    void load();
  }, [effectiveHotelId, scopeLoading]);

  const addPersonnel = async () => {
    if (!effectiveHotelId || !name.trim()) return;
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("personnel_directory").upsert({
      hotel_id: effectiveHotelId,
      staff_no: staffNo.trim() || null,
      name: name.trim(),
      role_label: roleLabel.trim() || null,
      is_active: true,
    });
    if (error) {
      setErrorMessage(formatSupabaseError(error));
      return;
    }
    setStaffNo("");
    setName("");
    setRoleLabel("");
    const { data } = await supabase
      .from("personnel_directory")
      .select("id, staff_no, name, role_label, is_active")
      .eq("hotel_id", effectiveHotelId)
      .order("name", { ascending: true });
    setRows((data ?? []) as PersonnelRow[]);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h1 className="text-2xl font-semibold text-[#101828]">{t("personnelList.title")}</h1>
        <p className="mt-1 text-sm text-[#475467]">{t("personnelList.subtitle")}</p>
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
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={staffNo} onChange={(e) => setStaffNo(e.target.value)} placeholder={t("personnelList.staffNo")} className="h-10 rounded-md border border-[#d0d5dd] px-2 text-sm" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("personnelList.name")} className="h-10 rounded-md border border-[#d0d5dd] px-2 text-sm" />
          <input value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} placeholder={t("personnelList.role")} className="h-10 rounded-md border border-[#d0d5dd] px-2 text-sm" />
          <button type="button" onClick={() => void addPersonnel()} className="h-10 rounded-md bg-brand px-3 text-sm font-semibold text-white">
            {t("personnelList.add")}
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#f9fafb] text-left text-[#475467]">
                <th className="border border-[#eaecf0] px-3 py-2">{t("personnelList.staffNo")}</th>
                <th className="border border-[#eaecf0] px-3 py-2">{t("personnelList.name")}</th>
                <th className="border border-[#eaecf0] px-3 py-2">{t("personnelList.role")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="border border-[#eaecf0] px-3 py-2">{row.staff_no ?? "-"}</td>
                  <td className="border border-[#eaecf0] px-3 py-2">{row.name}</td>
                  <td className="border border-[#eaecf0] px-3 py-2">{row.role_label ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {errorMessage && <div className="rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">{errorMessage}</div>}
    </div>
  );
}
