import type { Viewport } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed, Manrope, Sora } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import { SkipLink } from "@/components/shared/skip-link";
import { OperationalNotice } from "@/components/shared/operational-notice";
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
      <head>
        <script
          id="skysend-anti-fouc"
          dangerouslySetInnerHTML={{ __html: ANTI_FOUC_SCRIPT }}
        />
      </head>
      <body className="min-h-screen min-h-svh overflow-x-clip font-sans antialiased">
        <Providers>
          <SkipLink />
          <OperationalNotice />
          {children}
        </Providers>
      </body>
    </html>
  );
}
