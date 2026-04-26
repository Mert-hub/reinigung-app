"use client";

import { useState } from "react";
import { TagChipsField } from "@/src/components/labels/tag-chips-field";
import { useI18n } from "@/src/i18n/provider";

type Row = { item: string; level: string; unit: string; tags: string[] };

export function InventoryAlertPanel() {
  const { t } = useI18n();
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([
    { item: "Cam temizleyici", level: t("admin.critical"), unit: "4 lt", tags: ["Kimya", "Zemin"] },
    { item: "Mikrofiber bez", level: t("admin.low"), unit: "12 adet", tags: ["Bez"] },
    { item: "Cop poseti", level: t("admin.normal"), unit: "58 adet", tags: ["Bezler", "Sarf"] },
  ]);

  const addMaterial = () => {
    if (!materialName.trim()) {
      return;
    }
    const parsed = Number(quantity || 0);
    setRows((prev) => [
      {
        item: materialName.trim(),
        level: parsed < 10 ? t("admin.critical") : parsed < 25 ? t("admin.low") : t("admin.normal"),
        unit: `${parsed} - ${location.trim() || "-"}`,
        tags: newTags.length > 0 ? newTags : ["Genel"],
      },
      ...prev,
    ]);
    setMaterialName("");
    setQuantity("");
    setLocation("");
    setNewTags([]);
  };

  return (
    <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
      <h2 className="text-base font-semibold text-[#101828]">{t("inventory.panelTitle")}</h2>
      <div className="mt-3 max-w-2xl">
        <p className="text-xs text-[#667085]">{t("inventory.tagLineHint")}</p>
        <TagChipsField value={newTags} onChange={setNewTags} className="mt-1" />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_120px_1fr_120px]">
        <input
          type="text"
          value={materialName}
          onChange={(event) => setMaterialName(event.target.value)}
          placeholder={t("inventory.materialPlaceholder")}
          className="h-10 rounded-md border border-[#d0d5dd] px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
        />
        <input
          type="number"
          min={0}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder={t("inventory.quantityPlaceholder")}
          className="h-10 rounded-md border border-[#d0d5dd] px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
        />
        <input
          type="text"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder={t("inventory.locationPlaceholder")}
          className="h-10 rounded-md border border-[#d0d5dd] px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
        />
        <button
          type="button"
          onClick={addMaterial}
          className="h-10 rounded-md bg-brand px-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover"
        >
          {t("inventory.addItem")}
        </button>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#f9fafb] text-left text-[#475467]">
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("inventory.item")}</th>
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("inventory.tags")}</th>
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("inventory.status")}</th>
              <th className="border border-[#eaecf0] px-3 py-2 font-medium">{t("inventory.remaining")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.item}-${row.unit}-${index}`} className="odd:bg-white even:bg-[#f9fafb]">
                <td className="border border-[#eaecf0] px-3 py-2 font-medium text-[#101828]">{row.item}</td>
                <td className="border border-[#eaecf0] px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[#d0d5dd] bg-[#f0fdf4] px-2 py-0.5 text-xs text-[#14532d]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="border border-[#eaecf0] px-3 py-2">{row.level}</td>
                <td className="border border-[#eaecf0] px-3 py-2">{row.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
