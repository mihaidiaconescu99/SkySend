"use client";

import { useSettings } from "@/lib/settings/settings-context";

export function SkipLink() {
  const { t } = useSettings();

  return (
    <a href="#main-content" className="skip-link">
      {t("a11y.skipToContent")}
    </a>
  );
}
