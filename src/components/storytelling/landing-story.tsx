"use client";

import type { PublicCopy } from "@/lib/i18n/public-copy";
import { BackToTopButton } from "./back-to-top-button";
import { CinematicWeatherChapter } from "./cinematic-weather-chapter";
import { EditorialChapter } from "./editorial-chapter";
import { FinalCtaChapter } from "./final-cta-chapter";
import { HeroScrollStage } from "./hero-scroll-stage";
import { LandingProgressRail } from "./landing-progress-rail";
import styles from "./storytelling.module.css";

type LandingStoryCopy = PublicCopy["home"]["story"];

export function LandingStory({ copy }: { copy: LandingStoryCopy }) {
  return (
    <div id="landing-story" className={styles.storyRoot}>
      <HeroScrollStage copy={copy.hero} />
      <EditorialChapter copy={copy.editorial} />
      <CinematicWeatherChapter copy={copy.resilience} />
      <FinalCtaChapter copy={copy.cta} />
      <LandingProgressRail labels={copy.progress.labels} ariaLabel={copy.progress.ariaLabel} />
      <BackToTopButton ariaLabel={copy.backToTopAria} />
    </div>
  );
}
