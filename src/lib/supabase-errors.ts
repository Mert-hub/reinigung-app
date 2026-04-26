/**
 * Supabase PostgREST/Storage/Auth hatalari Error ornegi degildir; [object Object] cikmamasi icin.
 */
export function formatSupabaseError(error: unknown): string {
  if (error === null || error === undefined) {
    return "Unknown error";
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object") {
    const o = error as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.message === "string" && o.message) {
      parts.push(o.message);
    }
    if (typeof o.code === "string" && o.code) {
      parts.push(`code: ${o.code}`);
    }
    if (typeof o.details === "string" && o.details) {
      parts.push(o.details);
    }
    if (typeof o.hint === "string" && o.hint) {
      parts.push(o.hint);
    }
    if (parts.length > 0) {
      return parts.join(" | ");
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}
