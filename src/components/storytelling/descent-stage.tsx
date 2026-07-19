"use client";

import type { MotionValue } from "motion/react";
import { m, useTransform } from "motion/react";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets } from "@/lib/storytelling-assets";
import { SchematicBuilding, SchematicWorld } from "./schematic-world";
import { ScrollScrubVideo } from "./scroll-scrub-video";
import { StoryChapter } from "./story-chapter";
import { VCurvedTransition } from "./v-curved-transition";
import styles from "./storytelling.module.css";

type DescentCopy = PublicCopy["home"]["story"]["descent"];

function DescentScene({ progress, copy }: { progress: MotionValue<number>; copy: DescentCopy }) {
  const copyOpacity = useTransform(progress, [0.02, 0.14, 0.78, 0.92], [0, 1, 1, 0]);
  const copyY = useTransform(progress, [0.04, 0.25], [30, 0]);
  const productScale = useTransform(progress, [0, 0.22, 0.8], [1.08, 0.96, 0.98]);
  const cloudX = useTransform(progress, [0, 1], [-50, 90]);

  const asset = storytellingAssets.sequences.lowerLocker;

  return (
    <div className={styles.descentScene}>
      <SchematicWorld progress={progress} />
      <m.div className={styles.descentCloud} style={{ x: cloudX }} aria-hidden="true" />
      <SchematicBuilding progress={progress} distanceLabel={copy.distance} />

      <m.div className={styles.descentProduct} style={{ scale: productScale }}>
        <ScrollScrubVideo
          progress={progress}
          desktopSrc={asset.desktop}
          mobileSrc={asset.mobile}
          desktopPoster={asset.posterDesktop}
          mobilePoster={asset.posterMobile}
          fallbackDesktop={asset.fallbackDesktop}
          fallbackMobile={asset.fallbackMobile}
          objectFit="contain"
        />
      </m.div>

      <m.header className={styles.descentCopy} style={{ opacity: copyOpacity, y: copyY }}>
        <p>{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <span>{copy.body}</span>
      </m.header>

      <VCurvedTransition progress={progress} color="#0b1420" variant="peak" />
    </div>
  );
}

export function DescentStage({ copy, chapterLabel }: { copy: DescentCopy; chapterLabel: string }) {
  return (
    <StoryChapter id="story-descent" label={chapterLabel} screens={3.05}>
      {(progress) => <DescentScene progress={progress} copy={copy} />}
    </StoryChapter>
  );
}
