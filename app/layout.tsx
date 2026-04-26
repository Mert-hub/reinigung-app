import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/src/i18n/provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Umut Hotelservice und Reinigungs GmbH",
  description:
    "Umut Operations — clean is our concept. Hotel operasyon, raporlama ve personel yonetim paneli.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
