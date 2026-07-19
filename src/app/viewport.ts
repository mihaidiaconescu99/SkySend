import type { Viewport } from "next";
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#070b10" },
    { media: "(prefers-color-scheme: dark)", color: "#070b10" },
  ],
};
