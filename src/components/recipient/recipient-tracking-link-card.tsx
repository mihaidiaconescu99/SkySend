"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { AppButton } from "@/components/shared/app-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { getRecipientTrackingPath } from "@/lib/recipient-tracking";

type RecipientTrackingLinkCardProps = {
  missionId?: string | null;
  code?: string | null;
  token?: string | null;
  compact?: boolean;
};

function getAbsoluteRecipientLink(path: string) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (configuredBaseUrl) {
    return new URL(path, configuredBaseUrl).toString();
  }

  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

export function RecipientTrackingLinkCard({
  missionId,
  code,
  token,
  compact = false,
}: RecipientTrackingLinkCardProps) {
  const [copied, setCopiat] = useState(false);
  const recipientPath = getRecipientTrackingPath({ code, token });
  const trackingCode = code ?? null;
  const linkLabel = missionId
    ? "Linkul public este atașat livrării live"
    : trackingCode
      ? "Linkul public este rezervat pentru această comandă"
      : "Urmărirea publică devine disponibilă după confirmarea comenzii";

  const handleCopy = async () => {
    if (!trackingCode && !token) {
      return;
    }

    const absoluteLink = getAbsoluteRecipientLink(recipientPath);

    await navigator.clipboard.writeText(absoluteLink);
    setCopiat(true);
    window.setTimeout(() => setCopiat(false), 1800);
  };

  return (
    <div className="rounded-[calc(var(--radius)+0.375rem)] border border-border/80 bg-secondary/45 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full border border-border bg-background">
              <Link2 className="size-4 text-foreground" />
            </span>
            <div>
              <p className="font-medium text-foreground">Link de urmărire publică</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {linkLabel}
              </p>
            </div>
            <StatusBadge
              label={copied ? "Copiat" : missionId ? "Link live" : "Link comandă"}
              tone={missionId ? "success" : "info"}
            />
          </div>
          <div className="mt-3 grid gap-2">
            {trackingCode ? (
              <p className="w-fit rounded-full border border-border/80 bg-background px-3 py-1.5 font-mono text-sm font-semibold tracking-normal text-foreground">
                {trackingCode}
              </p>
            ) : null}
            <p className="truncate rounded-[var(--radius)] border border-border/80 bg-background px-3 py-2 text-sm text-muted-foreground">
              {recipientPath}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 md:min-w-80">
          <AppButton
            type="button"
            variant="outline"
            size={compact ? "default" : "lg"}
            onClick={handleCopy}
            disabled={!trackingCode && !token}
            className="w-full"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiat" : "Copiază linkul"}
          </AppButton>
          {trackingCode || token ? (
            <AppButton
              asChild
              variant="secondary"
              size={compact ? "default" : "lg"}
              className="w-full"
            >
              <Link href={recipientPath}>
                <ExternalLink className="size-4" />
                Deschide urmărirea
              </Link>
            </AppButton>
          ) : (
            <AppButton
              type="button"
              variant="secondary"
              size={compact ? "default" : "lg"}
              disabled
              className="w-full"
            >
              <ExternalLink className="size-4" />
              Deschide urmărirea
            </AppButton>
          )}
        </div>
      </div>
    </div>
  );
}
