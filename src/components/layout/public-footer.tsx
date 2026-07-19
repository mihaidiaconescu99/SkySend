"use client";

import Link from "next/link";
import { publicNavigation } from "@/constants/public-navigation";
import { siteConfig } from "@/constants/site";
import { BrandMark } from "@/components/shared/brand-mark";
import { useSettings } from "@/lib/settings/settings-context";
import { getPublicCopy } from "@/lib/i18n/public-copy";

export function PublicFooter() {
  const { language, t } = useSettings();
  const copy = getPublicCopy(language);

  return (
    <footer className="border-t border-border/80">
      <div className="app-container py-10 md:py-12">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.95fr)]">
          <div className="space-y-4">
            <Link href="/" aria-label={t("brand.homeAria")}>
              <BrandMark />
            </Link>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              {copy.footer.about}
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="type-caption">{copy.footer.navHeading}</p>
              <nav aria-label={copy.footer.navAria} className="grid gap-2">
                {publicNavigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
                <Link
                  href="/admin"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {copy.footer.adminLink}
                </Link>
              </nav>
            </div>

            <div className="space-y-3">
              <p className="type-caption">{copy.footer.contactHeading}</p>
              <address className="grid gap-2 not-italic">
                <a
                  href={`mailto:${siteConfig.supportEmail}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {siteConfig.supportEmail}
                </a>
                <Link
                  href="/sign-in"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {copy.footer.signIn}
                </Link>
                <Link
                  href="/client/create-delivery"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {copy.footer.createDelivery}
                </Link>
              </address>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border/80 pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{copy.footer.copyright}</p>
          <p>{copy.footer.tagline}</p>
        </div>
      </div>
    </footer>
  );
}