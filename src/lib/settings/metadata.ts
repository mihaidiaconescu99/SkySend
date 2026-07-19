import "server-only";
import type { Metadata } from "next";
import { siteConfig } from "@/constants/site";
import { getLanguageFromCookies } from "@/lib/settings/server";

export async function createLocalizedMetadata(
  pages: { ro: { title: string; description: string }; en: { title: string; description: string } },
): Promise<Metadata> {
  const language = await getLanguageFromCookies();
  const { title, description } =
    language === "en" ? pages.en : pages.ro;

  return {
    title,
    description,
    alternates: {
      languages: {
        ro: pages.ro.description,
        en: pages.en.description,
      },
    },
    openGraph: {
      title,
      description,
      url: siteConfig.url,
      siteName: siteConfig.name,
    },
    twitter: {
      title,
      description,
      card: "summary_large_image",
    },
  };
}
