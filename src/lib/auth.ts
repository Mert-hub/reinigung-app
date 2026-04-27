import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/src/lib/supabase";

export type AppRole = "vorarbeiter" | "admin";

type ProfileRecord = {
  role: string | null;
  hotel_id: string | null;
};

export type UserContext = {
  role: AppRole;
  hotelId: string | null;
};

export function getDefaultRouteForRole(role: AppRole) {
  return role === "admin" ? "/admin" : "/operations/daily-reports";
}

export async function getCurrentUser() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return data.user;
}

export async function signInWithEmailPassword(email: string, password: string) {
  const supabase = getSupabaseClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = getSupabaseClient();
  return supabase.auth.signOut();
}

export async function resolveUserRole(user: User): Promise<AppRole> {
  const profile = await getUserProfile(user.id);
  return profile.role;
}

export async function getUserProfile(userId: string): Promise<UserContext> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("role, hotel_id")
    .eq("id", userId)
    .maybeSingle<ProfileRecord>();

  if (error) {
    console.error("Profil rol bilgisi alinamadi", { details: error.message, userId });
    throw new Error(`Profile read failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("Profile not found for current user.");
  }

  const role: AppRole =
    data?.role === "admin" || data?.role === "patron" ? "admin" : "vorarbeiter";

  return {
    role,
    hotelId: data?.hotel_id ?? null,
  };
}
