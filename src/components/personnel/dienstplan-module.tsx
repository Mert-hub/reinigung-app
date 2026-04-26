"use client";

import { FileText, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useHotelScope } from "@/src/contexts/hotel-scope-context";
import { useI18n } from "@/src/i18n/provider";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";

const DIENSTPLAN_BUCKET = "dienstplan";

type PlanFile = {
  name: string;
  created_at: string;
  url: string;
};

export function DienstplanModule() {
  const { t } = useI18n();
  const { effectiveHotelId: contextHotelId, isLoading: scopeLoading, isAdmin, hotelOptions, setSelectedHotelId, selectedHotelId } =
    useHotelScope();
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [planLabel, setPlanLabel] = useState("");
  const [plans, setPlans] = useState<PlanFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadPlans = useCallback(async (targetHotelId: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.from(DIENSTPLAN_BUCKET).list(targetHotelId, {
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) {
      if (error.message.toLowerCase().includes("bucket")) {
        throw new Error(t("dienstplan.bucketMissing"));
      }
      throw error;
    }

    const mappedPlans =
      data?.map((item) => {
        const { data: publicData } = supabase.storage
          .from(DIENSTPLAN_BUCKET)
          .getPublicUrl(`${targetHotelId}/${item.name}`);
        return {
          name: item.name,
          created_at: item.created_at ?? "",
          url: publicData.publicUrl,
        };
      }) ?? [];
    setPlans(mappedPlans);
  }, [t]);

  useEffect(() => {
    if (scopeLoading) {
      return;
    }
    const bootstrap = async () => {
      await Promise.resolve();
      if (!contextHotelId) {
        setErrorMessage(
          isAdmin ? t("layout.noHotelsInDb") : t("dienstplan.profileHotelMissing"),
        );
        setHotelId(null);
        setPlans([]);
        setIsLoading(false);
        return;
      }
      setHotelId(contextHotelId);
      setErrorMessage("");
      setIsLoading(true);
      try {
        await loadPlans(contextHotelId);
      } catch (error) {
        setErrorMessage(`${t("dienstplan.listLoadFailed")}: ${formatSupabaseError(error)}`);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, [loadPlans, t, contextHotelId, scopeLoading, isAdmin]);

  const handleUpload = async () => {
    const targetHotel = contextHotelId ?? hotelId;
    if (!targetHotel) {
      setErrorMessage(t("dienstplan.hotelContextMissing"));
      return;
    }
    if (!selectedFile) {
      setErrorMessage(t("dienstplan.fileMissing"));
      return;
    }

    setIsUploading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = getSupabaseClient();
      const ext = selectedFile.name.split(".").pop() ?? "pdf";
      const label = planLabel.trim() || t("dienstplan.defaultLabel");
      const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filePath = `${targetHotel}/${new Date().toISOString().slice(0, 10)}-${safeLabel}-${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from(DIENSTPLAN_BUCKET).upload(filePath, selectedFile, {
        upsert: false,
        contentType: selectedFile.type,
      });
      if (error) {
        if (error.message.toLowerCase().includes("bucket")) {
          throw new Error(t("dienstplan.bucketMissing"));
        }
        throw error;
      }

      await loadPlans(targetHotel);
      setSelectedFile(null);
      setPlanLabel("");
      setSuccessMessage(t("dienstplan.uploadSuccess"));
      window.setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage(`${t("dienstplan.uploadFailed")}: ${formatSupabaseError(error)}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h1 className="text-2xl font-semibold text-[#101828]">{t("dienstplan.title")}</h1>
        <p className="mt-1 text-sm text-[#475467]">
          {t("dienstplan.subtitle")}
        </p>
        {isAdmin && !scopeLoading && (
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
                hotelOptions.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-[#667085]">{t("layout.hotelScopeHint")}</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_160px]">
          <input
            type="text"
            value={planLabel}
            onChange={(event) => setPlanLabel(event.target.value)}
            placeholder={t("dienstplan.placeholder")}
            className="h-11 rounded-md border border-[#d0d5dd] px-3 text-sm outline-none ring-[#98a2b3] focus:ring-2"
          />
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#98a2b3] bg-[#f8fafc] text-sm font-medium text-[#344054]">
            <UploadCloud className="h-4 w-4" />
            {t("dienstplan.chooseFile")}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={isUploading || isLoading}
            className="h-11 rounded-md bg-brand px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-[#9ca3af]"
          >
            {isUploading ? t("dienstplan.uploading") : t("dienstplan.uploadButton")}
          </button>
        </div>
        {selectedFile && <p className="mt-2 text-xs text-[#667085]">{t("dienstplan.selectedFile")}: {selectedFile.name}</p>}
      </section>

      <section className="rounded-xl border border-[#d0d5dd] bg-white p-5">
        <h2 className="text-base font-semibold text-[#101828]">{t("dienstplan.uploadedPlans")}</h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-[#667085]">{t("common.loading")}</p>
        ) : plans.length === 0 ? (
          <p className="mt-2 text-sm text-[#667085]">{t("dienstplan.noPlans")}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <a
                key={plan.url}
                href={plan.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[#d0d5dd] bg-[#f9fafb] p-3 transition hover:border-[#98a2b3]"
              >
                <div className="flex items-center gap-2 text-[#344054]">
                  <FileText className="h-4 w-4" />
                  <p className="truncate text-sm font-medium">{plan.name}</p>
                </div>
                <p className="mt-2 text-xs text-[#667085]">{plan.created_at || t("common.noDate")}</p>
              </a>
            ))}
          </div>
        )}
      </section>

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
