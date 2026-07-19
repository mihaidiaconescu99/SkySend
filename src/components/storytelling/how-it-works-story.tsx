"use client";

import { m, type MotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets } from "@/lib/storytelling-assets";
import { BackToTopButton } from "./back-to-top-button";
import { ScrollCue } from "./scroll-cue";
import { ScrollScrubVideo } from "./scroll-scrub-video";
import { StoryChapter } from "./story-chapter";
import { VCurvedTransition } from "./v-curved-transition";
import styles from "./storytelling.module.css";

type HowStoryCopy = PublicCopy["howItWorks"]["story"];
type TutorialScene = HowStoryCopy["tutorial"]["scenes"][number];

const TUTORIAL_SCENE_SCREENS = [9, 10, 9, 6, 7, 6] as const;
const TUTORIAL_CONTENT_SCREENS = TUTORIAL_SCENE_SCREENS.reduce((total, screens) => total + screens, 0);
const FINAL_DISSOLVE_SCREENS = 2;
const FINAL_TITLE_SCREENS = 3;
const TUTORIAL_TOTAL_SCREENS = TUTORIAL_CONTENT_SCREENS + FINAL_DISSOLVE_SCREENS + FINAL_TITLE_SCREENS;

function useTutorialMobileLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function tutorialSceneRange(index: number) {
  const start = TUTORIAL_SCENE_SCREENS.slice(0, index).reduce((total, screens) => total + screens, 0);
  return { start, end: start + TUTORIAL_SCENE_SCREENS[index] };
}

function TutorialCopyLayer({
  progress,
  scene,
  index,
  exitProgress,
  isMobile,
}: {
  progress: MotionValue<number>;
  scene: TutorialScene;
  index: number;
  exitProgress: MotionValue<number>;
  isMobile: boolean;
}) {
  const { start, end } = tutorialSceneRange(index);
  const isFirst = index === 0;
  const isLast = index === TUTORIAL_SCENE_SCREENS.length - 1;
  const layerRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [finalTitleOffset, setFinalTitleOffset] = useState({ x: 0, y: 0 });
  const input = [
    isFirst ? 0 : (start - 1) / TUTORIAL_CONTENT_SCREENS,
    isFirst ? 0.025 : (start + 1) / TUTORIAL_CONTENT_SCREENS,
    isLast ? 0.99 : (end - 1) / TUTORIAL_CONTENT_SCREENS,
    isLast ? 1 : (end + 1) / TUTORIAL_CONTENT_SCREENS,
  ];
  const opacity = useTransform(progress, input, [0, 1, 1, isLast ? 1 : 0]);
  const y = useTransform(progress, input, [42, 0, 0, isLast ? 0 : -34]);
  const filter = useTransform(progress, input, ["blur(12px)", "blur(0px)", "blur(0px)", isLast ? "blur(0px)" : "blur(10px)"]);
  const dissolveStart = TUTORIAL_CONTENT_SCREENS / TUTORIAL_TOTAL_SCREENS;
  const dissolveEnd = (TUTORIAL_CONTENT_SCREENS + FINAL_DISSOLVE_SCREENS) / TUTORIAL_TOTAL_SCREENS;
  const finalDetailOpacity = useTransform(exitProgress, [dissolveStart, dissolveEnd], [1, 0]);
  const finalDetailFilter = useTransform(exitProgress, [dissolveStart, dissolveEnd], ["blur(0px)", "blur(16px)"]);
  const finalDetailVisibility = useTransform(exitProgress, (value) => (
    value >= dissolveEnd ? "hidden" : "visible"
  ));
  const measureFinalTitle = useCallback(() => {
    if (!isLast || !layerRef.current || !titleRef.current) return;

    const layer = layerRef.current.getBoundingClientRect();
    const title = titleRef.current;
    const baseCenterX = layer.left + title.offsetLeft + title.offsetWidth / 2;
    const baseCenterY = layer.top + title.offsetTop + title.offsetHeight / 2;

    setFinalTitleOffset({
      x: window.innerWidth / 2 - baseCenterX,
      y: window.innerHeight / 2 - baseCenterY,
    });
  }, [isLast]);

  useEffect(() => {
    if (!isLast) return;

    const frame = window.requestAnimationFrame(measureFinalTitle);
    window.addEventListener("resize", measureFinalTitle);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measureFinalTitle);
    };
  }, [isLast, measureFinalTitle]);

  useMotionValueEvent(exitProgress, "change", (value) => {
    if (isLast && value >= dissolveEnd) {
      window.requestAnimationFrame(measureFinalTitle);
    }
  });

  const titleX = useTransform(exitProgress, [dissolveStart, dissolveEnd, 1], [0, 0, finalTitleOffset.x]);
  const titleY = useTransform(exitProgress, [dissolveStart, dissolveEnd, 1], [0, 0, finalTitleOffset.y]);
  const titleScale = useTransform(exitProgress, [dissolveStart, dissolveEnd, 1], [1, 1, isMobile ? 1.5 : 1.65]);

  return (
    <m.article
      ref={layerRef}
      className={styles.howTutorialCopyLayer}
      data-scene={index + 1}
      style={{ opacity, y, filter }}
    >
      <m.div className={styles.howTutorialMeta} style={{ opacity: isLast ? finalDetailOpacity : 1, filter: isLast ? finalDetailFilter : "none", visibility: isLast ? finalDetailVisibility : "visible" }}>
        <p className={styles.howTutorialStep}>0{index + 1}</p>
      </m.div>
      <m.h2
        ref={titleRef}
        style={{ x: isLast ? titleX : 0, y: isLast ? titleY : 0, scale: isLast ? titleScale : 1, transformOrigin: "center" }}
      >
        {scene.title}
      </m.h2>
      <m.div className={styles.howTutorialBody} style={{ opacity: isLast ? finalDetailOpacity : 1, filter: isLast ? finalDetailFilter : "none", visibility: isLast ? finalDetailVisibility : "visible" }}>
        {scene.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </m.div>
    </m.article>
  );
}

function HowItWorksTutorial({
  progress,
  copy,
}: {
  progress: MotionValue<number>;
  copy: HowStoryCopy;
}) {
  const assets = storytellingAssets.howItWorks.tutorial;
  const isMobile = useTutorialMobileLayout();
  const tutorialProgress = useTransform(
    progress,
    (value) => Math.min(1, value * (TUTORIAL_TOTAL_SCREENS / TUTORIAL_CONTENT_SCREENS)),
  );
  const dissolveStart = TUTORIAL_CONTENT_SCREENS / TUTORIAL_TOTAL_SCREENS;
  const dissolveEnd = (TUTORIAL_CONTENT_SCREENS + FINAL_DISSOLVE_SCREENS) / TUTORIAL_TOTAL_SCREENS;
  const videoOpacity = useTransform(
    progress,
    [dissolveStart, dissolveEnd],
    [1, 0],
  );
  const videoFilter = useTransform(progress, [dissolveStart, dissolveEnd], ["blur(0px)", "blur(18px)"]);
  const videoVisibility = useTransform(progress, (value) => (
    value >= dissolveEnd ? "hidden" : "visible"
  ));

  return (
    <div className={styles.howTutorialScene}>
      <div className={styles.howTutorialContent}>
        <div className={styles.howTutorialText}>
          {copy.tutorial.scenes.map((scene, index) => (
            <TutorialCopyLayer
              key={scene.title}
              progress={tutorialProgress}
              scene={scene}
              index={index}
              exitProgress={progress}
              isMobile={isMobile}
            />
          ))}
        </div>
        <m.div className={styles.howTutorialVideoCard} style={{ opacity: videoOpacity, filter: videoFilter, visibility: videoVisibility }}>
          <ScrollScrubVideo
            progress={tutorialProgress}
            desktopSrc={assets.desktop}
            mobileSrc={assets.mobile}
            desktopPoster={assets.posterDesktop}
            mobilePoster={assets.posterMobile}
            eager
            objectFit="contain"
            seekMode="damped"
            className={styles.howTutorialVideoHost}
            mediaClassName={styles.howTutorialVideo}
          />
        </m.div>
      </div>
    </div>
  );
}

function HowItWorksHero({
  progress,
  copy,
}: {
  progress: MotionValue<number>;
  copy: HowStoryCopy;
}) {
  const sky = storytellingAssets.landingWeather.sky;

  return (
    <div className={styles.howHeroScene}>
      <ScrollScrubVideo
        progress={progress}
        desktopSrc={sky.desktop}
        mobileSrc={sky.mobile}
        desktopPoster={sky.posterDesktop}
        mobilePoster={sky.posterMobile}
        eager
        seekMode="damped"
        mediaClassName={styles.howHeroVideo}
      />
      <div className={styles.howHeroShade} aria-hidden="true" />
      <header className={styles.howHeroCopy}>
        <h1 aria-label={copy.title}>
          {copy.titleLines.map((line) => (
            <span key={line} aria-hidden="true">{line}</span>
          ))}
        </h1>
        <p>{copy.subtitle}</p>
        <ScrollCue ariaLabel={copy.scrollHint} />
      </header>
      <VCurvedTransition
        progress={progress}
        color="var(--how-next-scene-color)"
        variant="valley"
        progressRange={[0.68, 1]}
        referenceCurve
      />
    </div>
  );
}

export function HowItWorksStory({ copy }: { copy: HowStoryCopy }) {
  return (
    <div id="how-story" className={styles.howStoryRoot}>
      <StoryChapter id="how-hero" label={copy.title} screens={5}>
        {(progress) => <HowItWorksHero progress={progress} copy={copy} />}
      </StoryChapter>
      <StoryChapter
        id="how-tutorial"
        label={copy.tutorial.label}
        className={styles.howTutorialChapter}
        stickyClassName={styles.howTutorialStage}
        screens={TUTORIAL_TOTAL_SCREENS}
      >
        {(progress) => <HowItWorksTutorial progress={progress} copy={copy} />}
      </StoryChapter>
      <section className={styles.howNextScene} aria-hidden="true" />
      <BackToTopButton
        ariaLabel={copy.backToTopAria}
        targetId="how-hero"
        className={styles.howBackToTopButton}
      />
    </div>
  );
}
