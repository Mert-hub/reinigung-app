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
  Search,
  Settings2,
  ShieldUser,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut, type AppRole } from "@/src/lib/auth";
import { getHotelCatalogIds, getHotelDisplayName } from "@/src/lib/hotel-catalog";
import { getSupabaseClient } from "@/src/lib/supabase";
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
    titleKey: "layout.menu.adminSection",
    icon: ShieldUser,
    items: [{ labelKey: "layout.menu.adminCenter", href: "/admin", icon: ShieldUser }],
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
    ],
  },
];

const vorarbeiterMenuSections: MenuSection[] = [
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
    titleKey: "layout.menu.personnelSection",
    icon: Users,
    items: [{ labelKey: "layout.menu.dienstplan", href: "/personnel/dienstplan", icon: CalendarDays }],
  },
];

function formatBreadcrumb(pathname: string) {
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<string[]>([]);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const { role, selectedHotelId, setSelectedHotelId, hotelOptions, isLoading: hotelScopeLoading } =
    useHotelScope();
  const currentRole: AppRole = role === "admin" ? "admin" : "vorarbeiter";
  const hotelLabel = hotelScopeLoading
    ? t("common.loading")
    : selectedHotelId
      ? getHotelDisplayName(selectedHotelId)
      : currentRole === "admin"
        ? t("layout.noHotelsInDb")
        : t("layout.hotelMissing");
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

  useEffect(() => {
    if (!notificationsOpen) return;
    const close = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [notificationsOpen]);

  useEffect(() => {
    const loadNotifications = async () => {
      const now = new Date();
      if (now.getHours() < 18) {
        setNotificationItems([]);
        return;
      }
      const supabase = getSupabaseClient();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const { data, error } = await supabase
        .from("daily_reports")
        .select("hotel_id, created_at")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());
      if (error) {
        setNotificationItems([]);
        return;
      }
      const reportedHotelIds = new Set(
        (data ?? [])
          .map((row) => row.hotel_id)
          .filter((hotelId): hotelId is string => Boolean(hotelId)),
      );
      const expectedHotels =
        currentRole === "admin"
          ? Array.from(new Set([...getHotelCatalogIds(), ...hotelOptions]))
          : selectedHotelId
            ? [selectedHotelId]
            : [];
      const missingHotels = expectedHotels.filter((hotelId) => !reportedHotelIds.has(hotelId));
      setNotificationItems(
        missingHotels.map((hotelId) =>
          t("layout.notificationMissingHotel").replace("{{hotel}}", getHotelDisplayName(hotelId)),
        ),
      );
    };
    void loadNotifications();
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 60000);
    return () => window.clearInterval(intervalId);
  }, [currentRole, hotelOptions, selectedHotelId, t]);

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
                          title={id}
                        >
                          {getHotelDisplayName(id)}
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
            <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4 md:min-h-16 md:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
                <BrandMark variant="headerMobile" className="shrink-0 md:hidden" />
                <div className="min-w-0 flex-1 pl-0.5">
                  <p className="truncate text-sm font-semibold leading-tight text-[#0a0a0a]">{breadcrumb}</p>
                </div>
              </div>
              <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap sm:gap-2.5">
                <div className="hidden min-w-0 items-center gap-2 rounded-md border border-line bg-background px-2.5 py-1.5 md:flex md:max-w-[min(100%,18rem)] lg:max-w-xs">
                  <Search className="h-4 w-4 shrink-0 text-[#6b7280]" />
                  <input
                    type="text"
                    placeholder={t("layout.searchPlaceholder")}
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#0a0a0a] outline-none placeholder:text-[#9ca3af]"
                  />
                </div>
                <span className="hidden shrink-0 rounded-md border border-line bg-background px-2 py-1 text-xs font-medium text-[#0a0a0a] md:inline-flex">
                  {currentRole === "admin" ? t("common.roleAdmin") : t("common.roleVorarbeiter")}
                </span>
                <span
                  className="hidden max-w-[10rem] truncate rounded-md border border-line bg-background px-2 py-1 text-xs font-medium text-[#0a0a0a] md:inline-block lg:max-w-[14rem] xl:max-w-[18rem]"
                  title={hotelLabel}
                >
                  {hotelLabel}
                </span>
                <span className="hidden shrink-0 text-xs font-medium text-[#6b7280] lg:inline">{nowLabel}</span>
                <div ref={notificationsRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen((o) => !o)}
                    aria-expanded={notificationsOpen}
                    aria-haspopup="true"
                    aria-label={t("layout.notificationsTitle")}
                    className="rounded-md border border-line bg-surface p-2 text-[#374151] hover:bg-brand-muted/60"
                  >
                    <Bell className="h-4 w-4" />
                    {notificationItems.length > 0 && (
                      <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10px] font-semibold text-white">
                        {notificationItems.length}
                      </span>
                    )}
                  </button>
                  {notificationsOpen && (
                    <div
                      className="absolute right-0 z-50 mt-2 w-72 max-w-[min(100vw-1.5rem,18rem)] rounded-md border border-line bg-surface p-3 text-left shadow-md"
                      role="region"
                      aria-label={t("layout.notificationsTitle")}
                    >
                      <p className="text-xs font-semibold text-[#0a0a0a]">{t("layout.notificationsTitle")}</p>
                      {notificationItems.length === 0 ? (
                        <p className="mt-2 text-xs text-[#667085]">{t("layout.notificationsEmpty")}</p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {notificationItems.map((item) => (
                            <li key={item} className="rounded-md bg-[#fef3f2] px-2 py-1.5 text-xs text-[#b42318]">
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <LanguageSwitcher />
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="shrink-0 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium text-[#0a0a0a] hover:bg-brand-muted/80"
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
              className="flex min-h-0 flex-1 flex-col px-4 py-5 md:px-6 md:py-6"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
