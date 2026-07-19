"use client";

import { LandingStory } from "@/components/storytelling/landing-story";
import { getPublicCopy } from "@/lib/i18n/public-copy";
import { useSettings } from "@/lib/settings/settings-context";

export default function HomeContent() {
  const { language } = useSettings();
  const copy = getPublicCopy(language);

  return <LandingStory copy={copy.home.story} />;
}
