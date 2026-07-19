"use client";

import Image from "next/image";
import type { MotionValue } from "motion/react";
import { useMotionValueEvent, useTransform } from "motion/react";
import type { CSSProperties, MutableRefObject, RefCallback } from "react";
import { useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets } from "@/lib/storytelling-assets";
import { ScrollScrubVideo } from "./scroll-scrub-video";
import { StoryChapter } from "./story-chapter";
import styles from "./storytelling.module.css";

type ResilienceCopy = PublicCopy["home"]["story"]["resilience"];
type WeatherMessage = ResilienceCopy["items"][number];

const SCENE_DURATIONS = [9, 8, 8] as const;
const SCENE_STARTS = [0, 9, 17] as const;
const WEATHER_SCREENS = 25;
const FINAL_FADE_SCREENS = 4;
const TOTAL_SCREENS = WEATHER_SCREENS + FINAL_FADE_SCREENS;

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function mix(value: number, start: number, end: number) {
  return clamp((value - start) / (end - start));
}

function sceneOpacities(viewport: number) {
  const winter = viewport <= 8.6 ? 1 : 1 - mix(viewport, 8.6, 9.4);
  const sky =
    viewport < 8.6
      ? 0
      : viewport <= 9.4
        ? mix(viewport, 8.6, 9.4)
        : viewport <= 16.6
          ? 1
          : 1 - mix(viewport, 16.6, 17.4);
  const rain = viewport <= 16.6 ? 0 : mix(viewport, 16.6, 17.4);
  return [winter, sky, rain] as const;
}

function copyOpacities(viewport: number) {
  const winter = 1 - mix(viewport, 8.3, 8.75);
  const sky = mix(viewport, 8.85, 9.4) * (1 - mix(viewport, 16.3, 16.75));
  const rain = mix(viewport, 16.85, 17.4);
  return [winter, sky, rain] as const;
}

function setMessageProgress(scene: HTMLElement, localViewport: number) {
  const start = 4;
  const end = 6;
  const amount = mix(localViewport, start, end);
  scene.style.setProperty("--weather-primary-opacity", String(1 - amount));
  scene.style.setProperty("--weather-primary-y", `${-1.15 * amount}rem`);
  scene.style.setProperty("--weather-primary-blur", `${5 * amount}px`);
  scene.style.setProperty("--weather-secondary-opacity", String(amount));
  scene.style.setProperty("--weather-secondary-y", `${1.15 * (1 - amount)}rem`);
  scene.style.setProperty("--weather-secondary-blur", `${5 * (1 - amount)}px`);
}

function setContentLayer(
  layer: HTMLDivElement | null,
  visible: boolean,
  blur: number,
  scale: number,
) {
  if (!layer) return;
  layer.style.opacity = visible ? "1" : "0";
  layer.style.filter = `blur(${blur}px)`;
  layer.style.transform = `scale(${scale})`;
}

function updateLockerContents(viewport: number, layers: Array<HTMLDivElement | null>) {
  const winterIncoming = mix(viewport, 2, 3);
  const winterOutgoing = mix(viewport, 9, 10);
  const skyIncoming = mix(viewport, 10, 11);
  const skyOutgoing = mix(viewport, 17, 18);
  const rainIncoming = mix(viewport, 18, 19);

  setContentLayer(
    layers[0],
    viewport >= 2 && viewport < 10,
    viewport < 9 ? 14 * (1 - winterIncoming) : 14 * winterOutgoing,
    viewport < 9 ? 1.045 - 0.045 * winterIncoming : 1 + 0.045 * winterOutgoing,
  );
  setContentLayer(
    layers[1],
    viewport >= 10 && viewport < 18,
    viewport < 17 ? 14 * (1 - skyIncoming) : 14 * skyOutgoing,
    viewport < 17 ? 1.045 - 0.045 * skyIncoming : 1 + 0.045 * skyOutgoing,
  );
  setContentLayer(
    layers[2],
    viewport >= 18,
    14 * (1 - rainIncoming),
    1.045 - 0.045 * rainIncoming,
  );
}

function WeatherScene({
  item,
  progress,
  sceneRef,
  initialOpacity,
  index,
}: {
  item: WeatherMessage;
  progress: MotionValue<number>;
  sceneRef: RefCallback<HTMLElement>;
  initialOpacity: number;
  index: number;
}) {
  const asset = storytellingAssets.landingWeather[item.id];

  return (
    <article
      ref={sceneRef}
      className={styles.cinematicWeatherScene}
      style={
        {
          opacity: initialOpacity,
          "--weather-primary-opacity": 1,
          "--weather-primary-y": "0rem",
          "--weather-primary-blur": "0px",
          "--weather-secondary-opacity": 0,
          "--weather-secondary-y": "1.15rem",
          "--weather-secondary-blur": "5px",
          "--weather-copy-opacity": index === 0 ? 1 : 0,
        } as CSSProperties
      }
    >
      <div
        className={styles.cinematicWeatherMediaFrame}
      >
        <ScrollScrubVideo
          progress={progress}
          desktopSrc={asset.desktop}
          mobileSrc={asset.mobile}
          desktopPoster={asset.posterDesktop}
          mobilePoster={asset.posterMobile}
          mediaClassName={styles.cinematicWeatherVideo}
        />
        <div className={styles.cinematicWeatherShade} aria-hidden="true" />
      </div>
      <header className={styles.cinematicWeatherCopy}>
        <p>{item.label}</p>
        <div className={styles.cinematicWeatherMessages}>
          <h2 className={styles.cinematicWeatherPrimary}>{item.message}</h2>
          <h2 className={styles.cinematicWeatherSecondary}>{item.secondaryMessage}</h2>
        </div>
      </header>
    </article>
  );
}

function CinematicLocker({ contentRefs }: { contentRefs: MutableRefObject<Array<HTMLDivElement | null>> }) {
  const locker = storytellingAssets.landingLocker;
  const contents = [locker.contents.winter, locker.contents.sky, locker.contents.rain];

  return (
    <div className={styles.cinematicLocker} aria-hidden="true">
      <div className={styles.cinematicLockerOpening}>
        {contents.map((src, index) => (
          <div
            key={src}
            ref={(node) => {
              contentRefs.current[index] = node;
            }}
            className={styles.cinematicLockerContent}
            style={{ opacity: 0 }}
          >
            <Image src={src} alt="" fill sizes="56vw" />
          </div>
        ))}
      </div>
      <Image
        src={locker.shell}
        alt=""
        fill
        sizes="56vw"
        className={styles.cinematicLockerShell}
      />
    </div>
  );
}

function CinematicWeatherScene({
  progress,
  copy,
}: {
  progress: MotionValue<number>;
  copy: ResilienceCopy;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const winterProgress = useTransform(progress, (value) =>
    clamp((value * TOTAL_SCREENS - SCENE_STARTS[0]) / SCENE_DURATIONS[0]),
  );
  const skyProgress = useTransform(progress, (value) =>
    clamp((value * TOTAL_SCREENS - SCENE_STARTS[1]) / SCENE_DURATIONS[1]),
  );
  const rainProgress = useTransform(progress, (value) =>
    clamp((value * TOTAL_SCREENS - SCENE_STARTS[2]) / (SCENE_DURATIONS[2] - 2)),
  );
  const sceneProgress = [winterProgress, skyProgress, rainProgress] as const;
  const sceneRefs = useRef<Array<HTMLElement | null>>([]);
  const contentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lockerRef = useRef<HTMLDivElement | null>(null);
  const finalCurtainRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useMotionValueEvent(progress, "change", (value) => {
    const viewport = value * TOTAL_SCREENS;
    const opacity = sceneOpacities(viewport);
    const copyOpacity = copyOpacities(viewport);
    sceneRefs.current.forEach((scene, index) => {
      if (!scene) return;
      scene.style.opacity = String(opacity[index] ?? 0);
      scene.style.setProperty("--weather-copy-opacity", String(copyOpacity[index] ?? 0));
      setMessageProgress(scene, viewport - SCENE_STARTS[index]);
    });

    const entry = reducedMotion ? 1 : mix(viewport, 0, 1);
    if (lockerRef.current) {
      lockerRef.current.style.transform = `translate(-50%, -50%) scale(${0.72 + 0.28 * entry})`;
      lockerRef.current.style.filter = `blur(${14 * (1 - entry)}px)`;
      lockerRef.current.style.opacity = String(reducedMotion ? 1 : 0.55 + 0.45 * entry);
    }
    updateLockerContents(viewport, contentRefs.current);

    if (finalCurtainRef.current) {
      const fade = reducedMotion
        ? Number(viewport >= WEATHER_SCREENS)
        : mix(viewport, WEATHER_SCREENS, TOTAL_SCREENS);
      finalCurtainRef.current.style.opacity = String(fade);
    }

  });

  return (
    <div ref={stageRef} className={styles.cinematicWeatherStage}>
      {copy.items.map((item, index) => (
        <WeatherScene
          key={item.id}
          item={item}
          progress={sceneProgress[index]}
          initialOpacity={index === 0 ? 1 : 0}
          index={index}
          sceneRef={(scene) => {
            sceneRefs.current[index] = scene;
          }}
        />
      ))}
      <div ref={lockerRef} className={styles.cinematicLockerMotion}>
        <CinematicLocker contentRefs={contentRefs} />
      </div>
      <div
        ref={finalCurtainRef}
        className={styles.cinematicWeatherFinalCurtain}
        aria-hidden="true"
      />
    </div>
  );
}

export function CinematicWeatherChapter({ copy }: { copy: ResilienceCopy }) {
  return (
    <div className={styles.cinematicWeatherFlow}>
      <StoryChapter
        id="story-weather-resilience"
        label={copy.chapterLabel}
        screens={TOTAL_SCREENS}
        className={styles.cinematicWeatherChapter}
        stickyClassName={styles.cinematicWeatherSticky}
      >
        {(progress) => <CinematicWeatherScene progress={progress} copy={copy} />}
      </StoryChapter>
    </div>
  );
}
