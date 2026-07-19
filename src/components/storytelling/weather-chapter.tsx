"use client";

import Image from "next/image";
import type { MotionValue } from "motion/react";
import { m, useTransform } from "motion/react";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets, type StoryWeather } from "@/lib/storytelling-assets";
import { cn } from "@/lib/utils";
import { ScrollScrubVideo } from "./scroll-scrub-video";
import { StoryChapter } from "./story-chapter";
import { VCurvedTransition } from "./v-curved-transition";
import styles from "./storytelling.module.css";

type WeatherCopy = PublicCopy["home"]["story"]["weather"]["items"][number];

const payloadByWeather = {
  rain: storytellingAssets.payload.food,
  clear: storytellingAssets.payload.pharmacy,
  snow: storytellingAssets.payload.electronics,
} satisfies Record<StoryWeather, string>;

const nextColor = {
  rain: "#0a3150",
  clear: "#111d2a",
  snow: "#050b14",
} satisfies Record<StoryWeather, string>;

function WeatherScene({
  progress,
  kind,
  eyebrow,
  copy,
}: {
  progress: MotionValue<number>;
  kind: StoryWeather;
  eyebrow: string;
  copy: WeatherCopy;
}) {
  const asset = storytellingAssets.weather[kind];
  const copyOpacity = useTransform(progress, [0.04, 0.16, 0.76, 0.9], [0, 1, 1, 0]);
  const copyY = useTransform(progress, [0.04, 0.22], [28, 0]);
  const payloadY = useTransform(progress, [0, 0.56, 0.86], [62, -8, -22]);
  const payloadScale = useTransform(progress, [0, 0.5, 0.82], [0.82, 1.06, 1]);
  const payloadOpacity = useTransform(progress, [0.08, 0.24, 0.82, 0.94], [0, 1, 1, 0]);
  const lockerOpacity = useTransform(progress, [0, 0.2, 0.72, 0.9], [0, 0.42, 0.2, 0]);
  const lockerScale = useTransform(progress, [0, 0.65], [0.9, 1.08]);

  return (
    <div className={cn(styles.weatherScene, styles[`weather_${kind}`])}>
      <ScrollScrubVideo
        progress={progress}
        desktopSrc={asset.desktop}
        mobileSrc={asset.mobile}
        desktopPoster={asset.posterDesktop}
        mobilePoster={asset.posterMobile}
        mediaClassName={styles.weatherVideo}
      />
      <div className={styles.weatherGrade} aria-hidden="true" />
      <div className={styles.weatherLines} aria-hidden="true" />

      <m.div
        className={styles.weatherLockerGhost}
        style={{ opacity: lockerOpacity, scale: lockerScale }}
        aria-hidden="true"
      >
        <Image
          src={storytellingAssets.product.lockerOpen}
          alt=""
          fill
          sizes="(max-width: 767px) 90vw, 52vw"
          className={styles.containImage}
        />
      </m.div>

      <m.div
        className={styles.weatherPayload}
        style={{ y: payloadY, scale: payloadScale, opacity: payloadOpacity }}
        aria-hidden="true"
      >
        <Image
          src={payloadByWeather[kind]}
          alt=""
          fill
          sizes="(max-width: 767px) 56vw, 24vw"
          className={styles.containImage}
        />
      </m.div>

      <m.header className={styles.weatherCopy} style={{ opacity: copyOpacity, y: copyY }}>
        <p>{eyebrow} · {copy.label}</p>
        <h2>{copy.title}</h2>
        <span>{copy.body}</span>
      </m.header>

      <VCurvedTransition
        progress={progress}
        color={nextColor[kind]}
        variant={kind === "clear" ? "valley" : "peak"}
      />
    </div>
  );
}

export function WeatherChapter({
  kind,
  eyebrow,
  copy,
  chapterLabel,
}: {
  kind: StoryWeather;
  eyebrow: string;
  copy: WeatherCopy;
  chapterLabel: string;
}) {
  return (
    <StoryChapter id={`story-weather-${kind}`} label={chapterLabel} screens={2.35}>
      {(progress) => (
        <WeatherScene progress={progress} kind={kind} eyebrow={eyebrow} copy={copy} />
      )}
    </StoryChapter>
  );
}
