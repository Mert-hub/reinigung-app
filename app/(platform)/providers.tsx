"use client";

import { HotelScopeProvider } from "@/src/contexts/hotel-scope-context";

export function PlatformProviders({ children }: { children: React.ReactNode }) {
  return <HotelScopeProvider>{children}</HotelScopeProvider>;
}
