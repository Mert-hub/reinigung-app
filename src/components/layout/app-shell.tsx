"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Boxes,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Cog,
  LayoutDashboard,
  Search,
  Settings2,
  ShieldUser,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { signOut, type AppRole } from "@/src/lib/auth";
import { useHotelScope } from "@/src/contexts/hotel-scope-context";
import { BrandMark } from "@/src/components/brand/brand-mark";
import { LanguageSwitcher } from "@/src/components/i18n/language-switcher";
import { useI18n } from "@/src/i18n/provider";

type MenuItem = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type MenuSection = {
  titleKey: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
};

const adminMenuSections: MenuSection[] = [
  {
    titleKey: "layout.menu.dashboardSection",
    icon: LayoutDashboard,
    items: [{ labelKey: "layout.menu.dashboardOverview", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    titleKey: "layout.menu.operationSection",
    icon: Briefcase,
    items: [
      { labelKey: "layout.menu.dailyReports", href: "/operations/daily-reports", icon: ClipboardCheck },
      { labelKey: "layout.menu.pmsForecast", href: "/operations/forecast", icon: BarChart3 },
      { labelKey: "layout.menu.taskManagement", href: "/operations/tasks", icon: Wrench },
    ],
  },
  {
    titleKey: "layout.menu.logisticsSection",
    icon: Boxes,
    items: [{ labelKey: "layout.menu.inventoryTracking", href: "/logistics/inventory", icon: Boxes }],
  },
  {
    titleKey: "layout.menu.personnelSection",
    icon: Users,
    items: [{ labelKey: "layout.menu.dienstplan", href: "/personnel/dienstplan", icon: CalendarDays }],
  },
  {
    titleKey: "layout.menu.settingsSection",
    icon: Settings2,
    items: [
      { labelKey: "layout.menu.hotelDefinitions", href: "/settings/hotels", icon: Cog },
      { labelKey: "layout.menu.systemParameters", href: "/settings/system", icon: Settings2 },
      { labelKey: "layout.menu.adminCenter", href: "/admin", icon: ShieldUser },
    ],
  },
];

const vorarbeiterMenuSections: MenuSection[] = [
  {
    titleKey: "layout.menu.dashboardSection",
    icon: LayoutDashboard,
    items: [{ labelKey: "layout.menu.dashboardOverview", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    titleKey: "layout.menu.operationSection",
    icon: Briefcase,
    items: [
      { labelKey: "layout.menu.dailyReports", href: "/operations/daily-reports", icon: ClipboardCheck },
      { labelKey: "layout.menu.pmsForecast", href: "/operations/forecast", icon: BarChart3 },
    ],
  },
  {
    titleKey: "layout.menu.personnelSection",
    icon: Users,
    items: [{ labelKey: "layout.menu.dienstplan", href: "/personnel/dienstplan", icon: CalendarDays }],
  },
];

function formatBreadcrumb(pathname: string) {
  if (pathname === "/dashboard") {
    return "Dashboard > Genel Bakis";
  }

  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, " "))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" > ");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { role, selectedHotelId, setSelectedHotelId, hotelOptions, isLoading: hotelScopeLoading } =
    useHotelScope();
  const currentRole: AppRole = role === "admin" ? "admin" : "vorarbeiter";
  const hotelLabel = hotelScopeLoading
    ? t("common.loading")
    : selectedHotelId || (currentRole === "admin" ? t("layout.noHotelsInDb") : t("layout.hotelMissing"));
  const breadcrumb = useMemo(() => formatBreadcrumb(pathname), [pathname]);
  const visibleSections = currentRole === "admin" ? adminMenuSections : vorarbeiterMenuSections;
  const nowLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("de-DE", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface text-[#0a0a0a] shadow-[2px_0_12px_rgba(0,0,0,0.04)] transition-all md:block ${
            isCollapsed ? "w-20" : "w-[19rem]"
          }`}
        >
          <div className="h-1 w-full bg-brand" aria-hidden />
          <div className="flex min-h-[4.5rem] items-center justify-between gap-2 border-b border-line px-3 py-2.5 sm:px-4">
            {isCollapsed ? (
              <div className="flex min-w-0 flex-1 justify-center pr-0.5">
                <BrandMark variant="sidebarCompact" />
              </div>
            ) : (
              <BrandMark variant="sidebar" className="min-w-0 flex-1 pr-2" />
            )}
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="shrink-0 self-center rounded-md border border-line bg-white p-1.5 text-[#0a0a0a] hover:bg-brand-muted"
              aria-label={isCollapsed ? "Expand menu" : "Collapse menu"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
          <nav className="h-[calc(100%-4.25rem)] space-y-4 overflow-y-auto px-3 py-4">
            {visibleSections.map((section) => (
              <div key={section.titleKey} className="space-y-1">
                {!isCollapsed && (
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4b5563]">
                    {t(section.titleKey)}
                  </p>
                )}
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const ItemIcon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg border border-transparent py-2 pl-2 pr-2.5 text-sm transition-colors ${
                        isActive
                          ? "border-l-4 border-brand bg-brand-muted pl-1.5 font-semibold text-[#0a0a0a] shadow-sm"
                          : "text-[#1f2937] hover:bg-brand-muted/70"
                      }`}
                    >
                      <ItemIcon className={`h-4 w-4 shrink-0 ${isActive ? "text-brand" : "text-[#4b5563]"}`} />
                      {!isCollapsed && <span className="truncate">{t(item.labelKey)}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
            {currentRole === "admin" && !isCollapsed && (
              <div className="mt-1 border-t border-line pt-3">
                <p className="mb-1.5 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4b5563]">
                  <Building2 className="h-3.5 w-3.5 text-brand" aria-hidden />
                  {t("layout.hotelScopeTitle")}
                </p>
                {hotelOptions.length === 0 ? (
                  <p className="px-2 text-xs text-[#667085]">{t("layout.noHotelsInDb")}</p>
                ) : (
                  <div className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
                    {hotelOptions.map((id) => {
                      const isSelected = id === selectedHotelId;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedHotelId(id)}
                          className={`w-full rounded-md border px-2 py-1.5 text-left text-xs font-medium transition ${
                            isSelected
                              ? "border-brand bg-brand-muted text-[#0a0a0a] shadow-sm"
                              : "border-transparent bg-[#f9fafb] text-[#374151] hover:border-line hover:bg-white"
                          }`}
                        >
                          {id}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b-2 border-brand/25 bg-surface">
            <div className="flex min-h-16 items-center justify-between gap-2 px-3 sm:px-4 md:gap-3 md:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3.5">
                <BrandMark variant="headerMobile" className="md:hidden" />
                <div className="min-w-0 pl-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#4b5563] sm:text-xs">
                    {t("layout.breadcrumb")}
                  </p>
                  <p className="truncate text-sm font-semibold leading-tight text-[#0a0a0a]">{breadcrumb}</p>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                <div className="hidden items-center gap-2 rounded-md border border-line bg-background px-3 py-2 md:flex md:w-80">
                  <Search className="h-4 w-4 text-[#6b7280]" />
                  <input
                    type="text"
                    placeholder={t("layout.searchPlaceholder")}
                    className="w-full bg-transparent text-sm text-[#0a0a0a] outline-none placeholder:text-[#9ca3af]"
                  />
                </div>
                <span className="hidden rounded-md border border-line bg-background px-2.5 py-1 text-xs font-medium text-[#0a0a0a] md:block">
                  {currentRole === "admin" ? t("common.roleAdmin") : t("common.roleVorarbeiter")}
                </span>
                <span className="hidden max-w-[140px] truncate rounded-md border border-line bg-background px-2.5 py-1 text-xs font-medium text-[#0a0a0a] md:block">
                  {hotelLabel}
                </span>
                <span className="hidden text-xs font-medium text-[#6b7280] lg:block">{nowLabel}</span>
                <button
                  type="button"
                  className="relative rounded-md border border-line bg-surface p-2 text-[#374151] hover:bg-brand-muted/60"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#e11d48]" />
                </button>
                <LanguageSwitcher />
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-[#0a0a0a] hover:bg-brand-muted/80"
                >
                  {t("common.signOut")}
                </button>
              </div>
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex-1 px-4 py-5 md:px-6 md:py-6"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
