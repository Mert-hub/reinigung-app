"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getCurrentUser, getDefaultRouteForRole, resolveUserRole } from "@/src/lib/auth";
import { useI18n } from "@/src/i18n/provider";

export default function Home() {
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    const routeUser = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace("/login");
          return;
        }

        const role = await resolveUserRole(user);
        router.replace(getDefaultRouteForRole(role));
      } catch {
        router.replace("/login");
      }
    };

    void routeUser();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-[#4b5563]">
      {t("common.redirecting")}
    </div>
  );
}
