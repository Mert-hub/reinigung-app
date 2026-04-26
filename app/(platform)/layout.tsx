import { AppShell } from "@/src/components/layout/app-shell";
import { PlatformGuard } from "@/src/components/auth/platform-guard";
import { PlatformProviders } from "./providers";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PlatformGuard>
      <PlatformProviders>
        <AppShell>{children}</AppShell>
      </PlatformProviders>
    </PlatformGuard>
  );
}
