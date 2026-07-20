"use client";

import { HowItWorksStory } from "@/components/storytelling/how-it-works-story";
import { getPublicCopy } from "@/lib/i18n/public-copy";
import { useSettings } from "@/lib/settings/settings-context";

export default function HowItWorksContent() {
  const { language } = useSettings();
  const copy = getPublicCopy(language);

  return <HowItWorksStory copy={copy.howItWorks.story} finalCopy={copy.home.story.cta} />;
}
