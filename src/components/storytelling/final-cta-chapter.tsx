"use client";

import Image from "next/image";
import Link from "next/link";
import { m, type MotionValue, useTransform } from "motion/react";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets } from "@/lib/storytelling-assets";
import { PartnerMarquee } from "./partner-marquee";
import { StoryChapter } from "./story-chapter";
import styles from "./storytelling.module.css";

type FinalCopy = PublicCopy["home"]["story"]["cta"];

type FinalCtaChapterProps = {
  copy: FinalCopy;
  id?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  showPartners?: boolean;
  fadeIn?: boolean;
};

function FinalCtaScene({
  copy,
  secondaryHref = "/how-it-works",
  secondaryLabel = copy.secondary,
  headingId,
}: {
  copy: FinalCopy;
  secondaryHref?: string;
  secondaryLabel?: string;
  headingId: string;
}) {
  return (
    <div className={styles.finalCtaLandingScene}>
      <div className={styles.finalCtaComposition}>
        <div className={styles.finalCtaDrone} aria-hidden="true">
          <Image
            src={storytellingAssets.landingFinal.drone}
            alt=""
            fill
            sizes="54vw"
            className={styles.finalCtaDroneImage}
          />
        </div>

        <section className={styles.finalCtaGlass} aria-labelledby={headingId}>
          <div className={styles.finalCtaReflection} aria-hidden="true" />
          <h2 id={headingId}>{copy.message}</h2>
          <div className={styles.finalCtaActions}>
            <Link className={styles.finalCtaPrimary} href="/client/create-delivery">
              <span className={styles.finalCtaLabel}>{copy.primary}</span>
            </Link>
            <Link className={styles.finalCtaSecondary} href={secondaryHref}>
              <span className={styles.finalCtaLabel}>{secondaryLabel}</span>
            </Link>
          </div>
        </section>
      </div>

    </div>
  );
}

function FadingFinalCtaScene({
  progress,
  ...props
}: {
  progress: MotionValue<number>;
  copy: FinalCopy;
  secondaryHref?: string;
  secondaryLabel?: string;
  headingId: string;
}) {
  const opacity = useTransform(progress, [0, 0.16], [0, 1]);

  return (
    <m.div className={styles.finalCtaFadeIn} style={{ opacity }}>
      <FinalCtaScene {...props} />
    </m.div>
  );
}

export function FinalCtaChapter({
  copy,
  id = "story-final-cta",
  secondaryHref,
  secondaryLabel,
  showPartners = true,
  fadeIn = false,
}: FinalCtaChapterProps) {
  const headingId = `${id}-message`;

  return (
    <>
      <StoryChapter
        id={id}
        label={copy.chapterLabel}
        screens={4}
        className={styles.finalCtaLandingChapter}
        stickyClassName={styles.finalCtaLandingSticky}
      >
        {(progress) => (
          fadeIn ? (
            <FadingFinalCtaScene
              progress={progress}
              copy={copy}
              secondaryHref={secondaryHref}
              secondaryLabel={secondaryLabel}
              headingId={headingId}
            />
          ) : (
            <FinalCtaScene
              copy={copy}
              secondaryHref={secondaryHref}
              secondaryLabel={secondaryLabel}
              headingId={headingId}
            />
          )
        )}
      </StoryChapter>
      {showPartners ? <PartnerMarquee title={copy.partnersTitle} ariaLabel={copy.partnersAria} /> : null}
    </>
  );
}
