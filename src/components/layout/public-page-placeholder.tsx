"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicPageContent } from "@/constants/public-pages";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { AppButton } from "@/components/shared/app-button";
import { useSettings } from "@/lib/settings/settings-context";

type PublicPagePlaceholderProps = {
  content: PublicPageContent;
};

export function PublicPagePlaceholder({
  content,
}: PublicPagePlaceholderProps) {
  const { t } = useSettings();
  return (
    <div className="app-section-stack">
      <PageHeader
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
        actions={[
          {
            label: t("public.placeholder.cta"),
            href: "/sign-in",
            variant: "outline",
            icon: <ArrowRight className="size-4" />,
          },
        ]}
      />

      <SectionCard
        eyebrow={t("public.placeholder.cardEyebrow")}
        title={t("public.placeholder.cardTitle")}
        description={content.summary}
        footer={
          <div className="flex flex-wrap gap-2">
            <AppButton asChild>
              <Link href="/client/create-delivery">
                {t("public.placeholder.primaryCta")}
              </Link>
            </AppButton>
            <AppButton asChild variant="ghost">
              <Link href="/#coverage">{t("public.placeholder.secondaryCta")}</Link>
            </AppButton>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {content.pillars.map((pillar) => (
            <StatCard
              key={pillar.title}
              label={pillar.title}
              value={t("public.placeholder.active")}
              hint={pillar.body}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}