"use client";

import { X } from "lucide-react";
import { KeyboardEvent, useMemo, useState } from "react";
import { useI18n } from "@/src/i18n/provider";

const PALETTE = [
  "bg-emerald-100 text-emerald-900 border border-emerald-200",
  "bg-sky-100 text-sky-900 border border-sky-200",
  "bg-amber-100 text-amber-900 border border-amber-200",
  "bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-200",
  "bg-slate-200 text-slate-900 border border-slate-300",
  "bg-rose-100 text-rose-900 border border-rose-200",
];

function colorForLabel(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 33 + label.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

type TagChipsFieldProps = {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
};

/**
 * Notion-tarzı: aynı metin farklı etiketlerle ayırt edilebilir (ör. "Bez" vs "Bezler" farklı chip).
 */
export function TagChipsField({ value, onChange, className = "" }: TagChipsFieldProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const next = raw.trim();
    if (!next) {
      return;
    }
    if (value.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...value, next]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
    }
  };

  const suggestions = useMemo(
    () => t("labels.suggestionsList").split("|").map((s) => s.trim()).filter(Boolean),
    [t],
  );

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex min-h-10 flex-wrap gap-1.5 rounded-md border border-[#d0d5dd] bg-white px-2 py-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorForLabel(tag)}`}
            title={tag}
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              className="shrink-0 rounded-sm p-0.5 opacity-80 hover:opacity-100"
              aria-label={t("labels.removeTag")}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) {
              addTag(draft);
            }
          }}
          placeholder={value.length ? "" : t("labels.placeholder")}
          className="min-w-[6rem] flex-1 border-0 bg-transparent text-sm text-[#0a0a0a] outline-none placeholder:text-[#98a2b3]"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-[#667085]">{t("labels.quick")}</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded border border-dashed border-[#d0d5dd] px-2 py-0.5 text-xs text-[#344054] hover:border-brand hover:bg-brand-muted/50"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
