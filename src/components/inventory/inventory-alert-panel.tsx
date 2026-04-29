"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useHotelScope } from "@/src/contexts/hotel-scope-context";
import { useI18n } from "@/src/i18n/provider";
import { getCurrentUser } from "@/src/lib/auth";
import { getHotelDisplayName } from "@/src/lib/hotel-catalog";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";

type InventoryRow = {
  id: string;
  hotel_id: string;
  name: string;
  quantity: number;
  unit: string;
  location: string;
  updated_at: string;
};

function normalizeName(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function looksSimilar(a: string, b: string) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

export function InventoryAlertPanel() {
  const { t } = useI18n();
  const { effectiveHotelId, isAdmin, hotelOptions, selectedHotelId, setSelectedHotelId, isLoading: scopeLoading } =
    useHotelScope();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("adet");
  const [location, setLocation] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (scopeLoading || !effectiveHotelId) return;
    const load = async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, hotel_id, item_name, quantity, unit, location, updated_at")
        .eq("hotel_id", effectiveHotelId)
        .order("item_name", { ascending: true });
      if (error) {
        setErrorMessage(formatSupabaseError(error));
        return;
      }
      const mapped =
        data?.map((row) => ({
          id: row.id as string,
          hotel_id: row.hotel_id as string,
          name: String(row.item_name ?? ""),
          quantity: Number(row.quantity ?? 0),
          unit: String(row.unit ?? "adet"),
          location: String(row.location ?? ""),
          updated_at: String(row.updated_at ?? ""),
        })) ?? [];
      setRows(mapped);
    };
    void load();
  }, [effectiveHotelId, scopeLoading]);

  const sortedRows = useMemo(
    () =>
      rows
        .filter((row) => {
          const q = searchTerm.trim().toLocaleLowerCase("tr-TR");
          if (!q) return true;
          return (
            row.name.toLocaleLowerCase("tr-TR").includes(q) ||
            row.location.toLocaleLowerCase("tr-TR").includes(q) ||
            row.unit.toLocaleLowerCase("tr-TR").includes(q)
          );
        })
        .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "tr")),
    [rows, searchTerm],
  );

  const addOrMergeItem = async () => {
    if (!effectiveHotelId) return;
    const cleanName = itemName.trim();
    const parsedQty = Number(quantity);
    const cleanLocation = location.trim();
    if (!cleanName || !Number.isFinite(parsedQty) || parsedQty <= 0 || !cleanLocation) {
      return;
    }
    setIsSaving(true);
    setErrorMessage("");
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error(t("forecast.noSession"));
      }

      const supabase = getSupabaseClient();
      const match = rows.find((row) => looksSimilar(row.name, cleanName));
      if (match && match.unit === unit && normalizeName(match.location) === normalizeName(cleanLocation)) {
        const nextQty = match.quantity + parsedQty;
        const { error } = await supabase
          .from("inventory_items")
          .update({
            quantity: nextQty,
            updated_by: user.id,
          })
          .eq("id", match.id);
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from("inventory_items").insert({
          hotel_id: effectiveHotelId,
          item_name: cleanName,
          normalized_name: normalizeName(cleanName),
          quantity: parsedQty,
          unit,
          location: cleanLocation,
          created_by: user.id,
          updated_by: user.id,
        });
        if (error) {
          throw error;
        }
      }

      const { data, error } = await supabase
        .from("inventory_items")
        .select("id, hotel_id, item_name, quantity, unit, location, updated_at")
        .eq("hotel_id", effectiveHotelId)
        .order("item_name", { ascending: true });
      if (error) {
        throw error;
      }
      setRows(
        (data ?? []).map((row) => ({
          id: row.id as string,
          hotel_id: row.hotel_id as string,
          name: String(row.item_name ?? ""),
          quantity: Number(row.quantity ?? 0),
          unit: String(row.unit ?? "adet"),
          location: String(row.location ?? ""),
          updated_at: String(row.updated_at ?? ""),
        })),
      );
      setItemName("");
      setQuantity("");
    } catch (error) {
      setErrorMessage(formatSupabaseError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const removeItem = async (id: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) {
      setErrorMessage(formatSupabaseError(error));
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const getLevel = (qty: number) =>
    qty < 10 ? t("admin.critical") : qty < 25 ? t("admin.low") : t("admin.normal");

  return (
    <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
      <h2 className="text-base font-semibold text-[#101828]">{t("inventory.panelTitle")}</h2>
      <p className="mt-2 text-xs text-[#667085]">{t("inventory.mergeHint")}</p>
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
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_140px_120px_1fr_120px]">
        <input
          type="text"
          value={itemName}
          onChange={(event) => setItemName(event.target.value)}
          placeholder={t("inventory.materialPlaceholder")}
          className="h-10 rounded-md border border-[#d0d5dd] px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
        />
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder={t("inventory.quantityPlaceholder")}
          className="h-10 rounded-md border border-[#d0d5dd] px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
        />
        <select
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          className="h-10 rounded-md border border-[#d0d5dd] bg-white px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
        >
          <option value="adet">{t("inventory.unitPiece")}</option>
          <option value="kg">{t("inventory.unitKg")}</option>
          <option value="lt">{t("inventory.unitLiter")}</option>
        </select>
        <input
          type="text"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder={t("inventory.locationPlaceholder")}
          className="h-10 rounded-md border border-[#d0d5dd] px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
        />
        <button
          type="button"
          onClick={addOrMergeItem}
          disabled={isSaving}
          className="h-10 rounded-md bg-brand px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover"
        >
          {t("inventory.addStock")}
        </button>
      </div>
      <div className="mt-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={t("inventory.searchPlaceholder")}
          className="h-10 w-full rounded-md border border-[#d0d5dd] px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
        />
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#f9fafb] text-left text-[#475467]">
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("inventory.item")}</th>
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("inventory.quantityPlaceholder")}</th>
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("inventory.unit")}</th>
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("inventory.locationPlaceholder")}</th>
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("inventory.status")}</th>
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("inventory.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td className="border border-[#eaecf0] px-3 py-3 text-sm text-[#667085]" colSpan={6}>
                  {t("inventory.empty")}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-[#f9fafb]">
                  <td className="border border-[#eaecf0] px-3 py-2 font-medium text-[#101828]">{row.name}</td>
                  <td className="border border-[#eaecf0] px-3 py-2">{row.quantity}</td>
                  <td className="border border-[#eaecf0] px-3 py-2">{row.unit}</td>
                  <td className="border border-[#eaecf0] px-3 py-2">{row.location}</td>
                  <td className="border border-[#eaecf0] px-3 py-2">{getLevel(row.quantity)}</td>
                  <td className="border border-[#eaecf0] px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeItem(row.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#fda29b] bg-[#fff1f0] px-2 py-1 text-xs font-semibold text-[#b42318]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("inventory.deleteItem")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {errorMessage && (
        <div className="mt-3 rounded-md border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm font-medium text-[#b42318]">
          {errorMessage}
        </div>
      )}
    </section>
  );
}
