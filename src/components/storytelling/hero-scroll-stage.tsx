"use client";

import type { MotionValue } from "motion/react";
import { m, useTransform } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets } from "@/lib/storytelling-assets";
import { getHeroFrameIndex, ScrollFrameSequence } from "./scroll-frame-sequence";
import { ScrollCue } from "./scroll-cue";
import { StoryChapter } from "./story-chapter";
import { VCurvedTransition } from "./v-curved-transition";
import styles from "./storytelling.module.css";

type HeroScrollStageProps = {
  copy: PublicCopy["home"]["story"]["hero"];
};

function HeroScene({
  progress,
  copy,
}: {
  progress: MotionValue<number>;
  copy: HeroScrollStageProps["copy"];
}) {
  const reducedMotion = usePrefersReducedMotion();
  const frame = useTransform(progress, (value) =>
    getHeroFrameIndex(value, storytellingAssets.hero.desktop.frameCount),
  );
  const messageClearClip = useTransform(
    frame,
    [42, 82, 102, 123, 143, 160],
    [
      "inset(0 100% 0 0)",
      "inset(0 100% 0 0)",
      "inset(0 100% 0 0)",
      "inset(0 92% 0 0)",
      "inset(0 58% 0 0)",
      "inset(0 0% 0 0)",
    ],
  );
  const messageBlurClip = useTransform(
    frame,
    [42, 82, 102, 123, 143, 160],
    [
      "inset(0 100% 0 0)",
      "inset(0 100% 0 0)",
      "inset(0 100% 0 0)",
      "inset(0 84% 0 8%)",
      "inset(0 48% 0 42%)",
      "inset(0 0% 0 100%)",
    ],
  );
  const messageBlur = useTransform(
    frame,
    [42, 82, 102, 123, 143, 160],
    ["blur(0px)", "blur(0px)", "blur(13px)", "blur(10px)", "blur(7px)", "blur(0px)"],
  );
  const veilOpacity = useTransform(progress, [0, 0.739, 1], [0.08, 0.16, 0.58]);

  return (
    <div className={styles.landingHeroScene}>
      <ScrollFrameSequence
        progress={progress}
        desktop={storytellingAssets.hero.desktop}
        mobile={storytellingAssets.hero.mobile}
        className={styles.landingHeroFrames}
      />
      <div className={styles.landingHeroTint} aria-hidden="true" />
      <m.div className={styles.landingHeroVeil} style={{ opacity: veilOpacity }} aria-hidden="true" />

      <div className={styles.landingWordmarkWrap}>
        <h1 className={styles.landingWordmark}>{copy.title}</h1>
      </div>

      <m.p
        className={styles.landingMessage}
        aria-label={copy.message}
      >
        {reducedMotion ? (
          copy.message
        ) : (
          <>
            <m.span className={styles.messageClear} style={{ clipPath: messageClearClip }} aria-hidden="true">
              {copy.message}
            </m.span>
            <m.span
              className={styles.messageBlur}
              style={{ clipPath: messageBlurClip, filter: messageBlur }}
              aria-hidden="true"
            >
              {copy.message}
            </m.span>
          </>
        )}
      </m.p>

      <ScrollCue ariaLabel={copy.scrollHint} />

      <VCurvedTransition
        progress={progress}
        color="var(--story-editorial-base)"
        variant="valley"
        progressRange={[19 / 22, 1]}
        referenceCurve
      />
    </div>
  );
}

export function HeroScrollStage({ copy }: HeroScrollStageProps) {
  return (
    <StoryChapter id="story-hero" label={copy.title} screens={22}>
      {(progress) => <HeroScene progress={progress} copy={copy} />}
    </StoryChapter>
  );
}
