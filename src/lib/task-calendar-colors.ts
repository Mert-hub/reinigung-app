/** Stored on `ops_tasks.calendar_color`; Google-Calendar–style keys. */
export const CALENDAR_COLOR_KEYS = [
  "lavender",
  "sage",
  "peacock",
  "flamingo",
  "banana",
  "tangerine",
  "grape",
  "graphite",
  "tomato",
  "brand",
] as const;

export type CalendarColorKey = (typeof CALENDAR_COLOR_KEYS)[number];

export function isCalendarColorKey(v: string | null | undefined): v is CalendarColorKey {
  return Boolean(v && (CALENDAR_COLOR_KEYS as readonly string[]).includes(v));
}

/** Left bar + soft fill for week cells (urgency ring can stack on top). */
export const CALENDAR_COLOR_STYLE: Record<
  CalendarColorKey,
  { bar: string; fill: string; border: string }
> = {
  lavender: { bar: "#7986cb", fill: "#e8eaf6", border: "#c5cae9" },
  sage: { bar: "#33a853", fill: "#e6f4ea", border: "#ceead6" },
  peacock: { bar: "#039be5", fill: "#e1f5fe", border: "#b3e5fc" },
  flamingo: { bar: "#e67c73", fill: "#fce8e6", border: "#f9cbcd" },
  banana: { bar: "#f6bf26", fill: "#fef7e0", border: "#fde293" },
  tangerine: { bar: "#f4511e", fill: "#fbe9e7", border: "#ffccbc" },
  grape: { bar: "#8e24aa", fill: "#f3e5f5", border: "#e1bee7" },
  graphite: { bar: "#616161", fill: "#f5f5f5", border: "#e0e0e0" },
  tomato: { bar: "#d50000", fill: "#ffebee", border: "#ffcdd2" },
  brand: { bar: "#44d62c", fill: "#e8f6e3", border: "#b8e0a8" },
};

export function normalizeTaskColor(raw: string | null | undefined): CalendarColorKey {
  if (isCalendarColorKey(raw)) return raw;
  return "brand";
}
