/**
 * UI: full hotel names. DB (`profiles.hotel_id`, `daily_reports.hotel_id`, …): short `id`.
 */
export const HOTEL_CATALOG: readonly { id: string; name: string }[] = [
  { id: "TFM", name: "The Flag München Hotel" },
  { id: "H2", name: "H2 Hotel München Olympiapark" },
  { id: "TFMG", name: "The Flag Meiller Garten Hotel" },
  { id: "KHM", name: "King's Hotels München" },
  { id: "HPLUS", name: "H+ Hotel München" },
  { id: "DBS", name: "Das Dreiburgenseehotel" },
  { id: "H2H4", name: "H2/H4 Hotel München Messe" },
] as const;

const nameById = new Map(HOTEL_CATALOG.map((h) => [h.id, h.name]));

export function getHotelCatalogIds(): string[] {
  return HOTEL_CATALOG.map((h) => h.id);
}

/** Full name for UI; unknown ids pass through (legacy DB values). */
export function getHotelDisplayName(hotelId: string | null | undefined): string {
  if (!hotelId || !hotelId.trim()) {
    return "";
  }
  return nameById.get(hotelId) ?? hotelId;
}
