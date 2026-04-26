"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, getDefaultRouteForRole, resolveUserRole } from "@/src/lib/auth";
import { useI18n } from "@/src/i18n/provider";

export function PlatformGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const guardRoute = async () => {
      try {
        const user = await getCurrentUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const role = await resolveUserRole(user);

        if (pathname.startsWith("/admin") && role !== "admin") {
          router.replace(getDefaultRouteForRole(role));
          return;
        }
      } catch (error) {
        console.error("Platform guard hatasi", { error });
        router.replace("/login");
        return;
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    void guardRoute();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-[#4b5563]">
        {t("common.loading")}
      </div>
    );
  }

  return <>{children}</>;
}
