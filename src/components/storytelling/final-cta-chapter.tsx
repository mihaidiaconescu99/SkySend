"use client";

import Image from "next/image";
import Link from "next/link";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets } from "@/lib/storytelling-assets";
import { PartnerMarquee } from "./partner-marquee";
import { StoryChapter } from "./story-chapter";
import styles from "./storytelling.module.css";

type FinalCopy = PublicCopy["home"]["story"]["cta"];

function FinalCtaScene({ copy }: { copy: FinalCopy }) {
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

        <section className={styles.finalCtaGlass} aria-labelledby="landing-final-message">
          <div className={styles.finalCtaReflection} aria-hidden="true" />
          <h2 id="landing-final-message">{copy.message}</h2>
          <div className={styles.finalCtaActions}>
            <Link className={styles.finalCtaPrimary} href="/client/create-delivery">
              <span className={styles.finalCtaLabel}>{copy.primary}</span>
            </Link>
            <Link className={styles.finalCtaSecondary} href="/how-it-works">
              <span className={styles.finalCtaLabel}>{copy.secondary}</span>
            </Link>
          </div>
        </section>
      </div>

    </div>
  );
}

export function FinalCtaChapter({ copy }: { copy: FinalCopy }) {
  return (
    <>
      <StoryChapter
        id="story-final-cta"
        label={copy.chapterLabel}
        screens={4}
        className={styles.finalCtaLandingChapter}
        stickyClassName={styles.finalCtaLandingSticky}
      >
        {() => <FinalCtaScene copy={copy} />}
      </StoryChapter>
      <PartnerMarquee title={copy.partnersTitle} ariaLabel={copy.partnersAria} />
    </>
  );
}
