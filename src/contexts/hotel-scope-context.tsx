"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCurrentUser, getUserProfile, type AppRole } from "@/src/lib/auth";
import { getSupabaseClient } from "@/src/lib/supabase";
import { formatSupabaseError } from "@/src/lib/supabase-errors";

const STORAGE_KEY = "reinigung.adminSelectedHotelId";

type HotelScopeValue = {
  isLoading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  /** Vorarbeiter oteli veya adminin sectigi hedef */
  effectiveHotelId: string | null;
  hotelOptions: string[];
  selectedHotelId: string;
  setSelectedHotelId: (id: string) => void;
  error: string;
};

const HotelScopeContext = createContext<HotelScopeValue | null>(null);

async function loadDistinctHotelIds(): Promise<string[]> {
  const supabase = getSupabaseClient();
  const out = new Set<string>();

  const addFrom = (rows: { hotel_id: string | null }[] | null) => {
    for (const row of rows ?? []) {
      if (row.hotel_id) {
        out.add(row.hotel_id);
      }
    }
  };

  const [dr, pms, prof] = await Promise.all([
    supabase.from("daily_reports").select("hotel_id").not("hotel_id", "is", null).limit(1_000),
    supabase.from("pms_forecasts").select("hotel_id").not("hotel_id", "is", null).limit(1_000),
    supabase.from("profiles").select("hotel_id").not("hotel_id", "is", null).limit(1_000),
  ]);

  if (!dr.error) {
    addFrom(dr.data);
  }
  if (!pms.error) {
    addFrom(pms.data);
  }
  if (!prof.error) {
    addFrom(prof.data);
  }

  return Array.from(out).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function HotelScopeProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [selectedHotelId, setSelectedHotelIdState] = useState<string>("");
  const [hotelOptions, setHotelOptions] = useState<string[]>([]);
  const [error, setError] = useState("");

  const isAdmin = role === "admin";

  const setSelectedHotelId = useCallback((id: string) => {
    setSelectedHotelIdState(id);
    if (typeof window !== "undefined" && id) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, id);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      try {
        const user = await getCurrentUser();
        if (!user) {
          if (!cancelled) {
            setIsLoading(false);
          }
          return;
        }
        const profile = await getUserProfile(user.id);
        if (cancelled) {
          return;
        }
        setRole(profile.role);

        if (profile.role === "admin") {
          const options = await loadDistinctHotelIds();
          if (cancelled) {
            return;
          }
          setHotelOptions(options);
          const stored =
            typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
          const next =
            stored && options.includes(stored) ? stored : (options[0] ?? "");
          setSelectedHotelIdState(next);
        } else {
          if (profile.hotelId) {
            setSelectedHotelIdState(profile.hotelId);
            setHotelOptions([profile.hotelId]);
          } else {
            setHotelOptions([]);
            setSelectedHotelIdState("");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatSupabaseError(e));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveHotelId = useMemo(() => {
    if (!role) {
      return null;
    }
    if (role === "admin") {
      return selectedHotelId || null;
    }
    return selectedHotelId || null;
  }, [role, selectedHotelId]);

  const value = useMemo<HotelScopeValue>(
    () => ({
      isLoading,
      role,
      isAdmin: Boolean(isAdmin),
      effectiveHotelId,
      hotelOptions,
      selectedHotelId,
      setSelectedHotelId,
      error,
    }),
    [isLoading, role, isAdmin, effectiveHotelId, hotelOptions, selectedHotelId, setSelectedHotelId, error],
  );

  return <HotelScopeContext.Provider value={value}>{children}</HotelScopeContext.Provider>;
}

export function useHotelScope() {
  const ctx = useContext(HotelScopeContext);
  if (!ctx) {
    throw new Error("useHotelScope must be used within HotelScopeProvider.");
  }
  return ctx;
}
