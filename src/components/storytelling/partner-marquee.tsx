import Image from "next/image";
import { storytellingAssets } from "@/lib/storytelling-assets";
import styles from "./storytelling.module.css";

const GROUP_COUNT = 6;

export function PartnerMarquee({ title, ariaLabel }: { title: string; ariaLabel: string }) {
  const partners = storytellingAssets.landingFinal.partners;

  return (
    <section className={styles.partnerCarousel} aria-labelledby="landing-partners-title">
      <h2 id="landing-partners-title" className={styles.partnerCarouselTitle}>{title}</h2>
      <div className={styles.partnerMarquee} tabIndex={0} aria-label={ariaLabel}>
      <span className={styles.partnerMarqueeAccessible}>
        {partners.map((partner) => partner.name).join(", ")}
      </span>
      <div className={styles.partnerMarqueeTrack} aria-hidden="true">
        {Array.from({ length: GROUP_COUNT }, (_, groupIndex) => (
          <div className={styles.partnerMarqueeGroup} key={`partner-group-${groupIndex + 1}`}>
            {partners.map((partner) => (
              <span className={styles.partnerLogo} key={`${groupIndex}-${partner.id}`}>
                <Image src={partner.src} alt="" fill sizes="12rem" />
              </span>
            ))}
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}
