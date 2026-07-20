"use client";

import Image from "next/image";
import type { MotionValue } from "motion/react";
import { m, useTransform } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets } from "@/lib/storytelling-assets";
import { StoryChapter } from "./story-chapter";
import styles from "./storytelling.module.css";

type FinalCopy = PublicCopy["home"]["story"]["cta"];
type FinalRevealAsset = {
  endPosterDesktop?: string;
  endPosterMobile?: string;
};

function FinalRevealScene({ progress, asset }: { progress: MotionValue<number>; asset: FinalRevealAsset }) {
  const reducedMotion = usePrefersReducedMotion();
  const curtainOpacity = useTransform(progress, [0, 1], [0, 1]);
  const rain = asset.endPosterDesktop ? asset : storytellingAssets.landingWeather.rain;
  const desktopPoster = rain.endPosterDesktop ?? storytellingAssets.landingWeather.rain.endPosterDesktop!;
  const mobilePoster = rain.endPosterMobile ?? desktopPoster;

  return (
    <div className={styles.finalRevealScene}>
      <Image
        src={desktopPoster}
        alt=""
        fill
        sizes="100vw"
        className={`${styles.finalRevealRain} ${styles.finalRevealRainDesktop}`}
      />
      <Image
        src={mobilePoster}
        alt=""
        fill
        sizes="100vw"
        className={`${styles.finalRevealRain} ${styles.finalRevealRainMobile}`}
      />
      <m.div
        className={styles.finalRevealCurtain}
        style={{ opacity: reducedMotion ? 1 : curtainOpacity }}
        aria-hidden="true"
      />
    </div>
  );
}

export function FinalRevealChapter({
  copy,
  id = "story-final-reveal",
  asset,
}: {
  copy: FinalCopy;
  id?: string;
  asset?: FinalRevealAsset;
}) {
  return (
    <StoryChapter
      id={id}
      label={copy.chapterLabel}
      screens={4}
      className={styles.finalRevealChapter}
      stickyClassName={styles.finalRevealSticky}
    >
      {(progress) => <FinalRevealScene progress={progress} asset={asset ?? storytellingAssets.landingWeather.rain} />}
    </StoryChapter>
  );
}
