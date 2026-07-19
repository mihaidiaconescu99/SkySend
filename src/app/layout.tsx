import type { Viewport } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed, Manrope, Sora } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/shared/providers";
import { SkipLink } from "@/components/shared/skip-link";
import { defaultMetadata } from "@/lib/metadata";
import { ANTI_FOUC_SCRIPT } from "@/lib/settings/anti-fouc";
import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const displayFont = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  preload: true,
  fallback: ["Segoe UI", "Arial", "sans-serif"],
});

const storyFont = Barlow_Condensed({
  subsets: ["latin", "latin-ext"],
  variable: "--font-story",
  display: "swap",
  preload: true,
  weight: ["500", "600", "700"],
  fallback: ["Arial Narrow", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata = defaultMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="ro"
      className={`dark ${bodyFont.variable} ${displayFont.variable} ${storyFont.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen min-h-svh overflow-x-clip font-sans antialiased">
        <Script id="skysend-anti-fouc" strategy="beforeInteractive">
          {ANTI_FOUC_SCRIPT}
        </Script>
        <Providers>
          <SkipLink />
          {children}
        </Providers>
      </body>
    </html>
  );
}
