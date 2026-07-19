"use client";

import type { MotionValue } from "motion/react";
import { useTransform } from "motion/react";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets } from "@/lib/storytelling-assets";
import { AlphaFrameSequence } from "./alpha-frame-sequence";
import { StoryChapter } from "./story-chapter";
import styles from "./storytelling.module.css";

type EditorialCopy = PublicCopy["home"]["story"]["editorial"];

const VIDEO_SCREENS = 14;
const HOLD_SCREENS = 1;
const TOTAL_SCREENS = VIDEO_SCREENS + HOLD_SCREENS;

function EditorialScene({
  progress,
  copy,
}: {
  progress: MotionValue<number>;
  copy: EditorialCopy;
}) {
  const videoProgress = useTransform(
    progress,
    [0, VIDEO_SCREENS / TOTAL_SCREENS],
    [0, 1],
    { clamp: true },
  );

  const [lineOne, lineTwo] = copy.lines;
  const sequence = storytellingAssets.editorial.sequence;

  return (
    <div className={styles.editorialScene}>
      <div className={styles.editorialHeadline}>
        <h2 aria-label={copy.headline}>
          <span aria-hidden="true">{lineOne}</span>
          <span aria-hidden="true">{lineTwo}</span>
        </h2>
      </div>

      <div className={styles.editorialVideoLayer}>
        <AlphaFrameSequence
          progress={videoProgress}
          desktop={sequence.desktop}
          mobile={sequence.mobile}
          className={styles.editorialObjectHost}
        />
      </div>
    </div>
  );
}

export function EditorialChapter({ copy }: { copy: EditorialCopy }) {
  return (
    <StoryChapter
      id="story-editorial"
      label={copy.label}
      screens={TOTAL_SCREENS}
      className={styles.editorialChapter}
      stickyClassName={styles.editorialStage}
    >
      {(progress) => <EditorialScene progress={progress} copy={copy} />}
    </StoryChapter>
  );
}
