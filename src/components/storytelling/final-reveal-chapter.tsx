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

function FinalRevealScene({ progress }: { progress: MotionValue<number> }) {
  const reducedMotion = usePrefersReducedMotion();
  const curtainOpacity = useTransform(progress, [0, 1], [0, 1]);
  const rain = storytellingAssets.landingWeather.rain;

  return (
    <div className={styles.finalRevealScene}>
      <Image
        src={rain.endPosterDesktop}
        alt=""
        fill
        sizes="100vw"
        className={`${styles.finalRevealRain} ${styles.finalRevealRainDesktop}`}
      />
      <Image
        src={rain.endPosterMobile}
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

export function FinalRevealChapter({ copy }: { copy: FinalCopy }) {
  return (
    <StoryChapter
      id="story-final-reveal"
      label={copy.chapterLabel}
      screens={4}
      className={styles.finalRevealChapter}
      stickyClassName={styles.finalRevealSticky}
    >
      {(progress) => <FinalRevealScene progress={progress} />}
    </StoryChapter>
  );
}
