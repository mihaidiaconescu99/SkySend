"use client";

import Image from "next/image";
import { m, type MotionValue, useMotionValueEvent, useSpring, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets } from "@/lib/storytelling-assets";
import { cn } from "@/lib/utils";
import { BackToTopButton } from "./back-to-top-button";
import { AlphaFrameSequence } from "./alpha-frame-sequence";
import { FinalCtaChapter } from "./final-cta-chapter";
import {
  getJourneyPhaseProgress,
  getJourneyViewport,
  HOW_JOURNEY_CHAPTER_SCREENS,
  HOW_JOURNEY_TIMELINE,
} from "./how-it-works-journey-timeline";
import { ScrollCue } from "./scroll-cue";
import { ScrollScrubVideo } from "./scroll-scrub-video";
import { StoryChapter } from "./story-chapter";
import { VCurvedTransition } from "./v-curved-transition";
import styles from "./storytelling.module.css";

type HowStoryCopy = PublicCopy["howItWorks"]["story"];
type FinalCopy = PublicCopy["home"]["story"]["cta"];
type TutorialScene = HowStoryCopy["tutorial"]["scenes"][number];

const FLIGHT_DRONE_POSITIONS = Array.from({ length: 50 }, (_, index) => index / 49);
const FLIGHT_DRONE_X = FLIGHT_DRONE_POSITIONS.map((position) => `${-58 + position * 168}vw`);
const FLIGHT_DRONE_SCALE = FLIGHT_DRONE_POSITIONS.map((_, index) => (index >= 45 ? 0.8 : index >= 40 ? 0.9 : 1));

const TUTORIAL_SCENE_SCREENS = [10, 20, 10, 7, 8, 6] as const;
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

function TutorialProgressRail({ scenes, ariaLabel }: { scenes: readonly TutorialScene[]; ariaLabel: string }) {
  const fillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const activeRef = useRef(0);
  const visibleRef = useRef(false);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    let chapterTop = 0;
    let scrollSpan = 1;

    const measure = () => {
      const chapter = document.getElementById("how-tutorial");
      if (!chapter) return;
      chapterTop = chapter.getBoundingClientRect().top + window.scrollY;
      scrollSpan = Math.max(1, chapter.offsetHeight - window.innerHeight);
    };

    const update = () => {
      frame = 0;
      measure();
      const rawScrollProgress = (window.scrollY + window.innerHeight * 0.5 - chapterTop) / scrollSpan;
      const scrollProgress = Math.min(1, Math.max(0, rawScrollProgress));
      const tutorialProgress = scrollProgress * TUTORIAL_TOTAL_SCREENS;
      let nextActive = TUTORIAL_SCENE_SCREENS.length - 1;

      TUTORIAL_SCENE_SCREENS.forEach((screens, index) => {
        const { start, end } = tutorialSceneRange(index);
        const fill = Math.min(1, Math.max(0, (tutorialProgress - start) / screens));
        const node = fillRefs.current[index];
        if (node) node.style.transform = `scaleY(${fill})`;
        if (tutorialProgress >= start && tutorialProgress < end) nextActive = index;
      });

      if (activeRef.current !== nextActive) {
        activeRef.current = nextActive;
        setActive(nextActive);
      }

      const nextVisible = rawScrollProgress >= 0 && rawScrollProgress <= 1;
      if (visibleRef.current !== nextVisible) {
        visibleRef.current = nextVisible;
        setVisible(nextVisible);
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    measure();
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <nav className={cn(styles.landingProgressRail, styles.howTutorialProgressRail, visible && styles.landingProgressRailVisible)} aria-label={ariaLabel}>
      <ol>
        {scenes.map((scene, index) => (
          <li key={scene.title} className={cn(index === active && styles.landingProgressActive)}>
            <span className={styles.landingProgressTrack} aria-hidden="true">
              <span ref={(node) => { fillRefs.current[index] = node; }} className={styles.landingProgressFill} />
            </span>
            <span className={styles.landingProgressLabel} aria-current={index === active ? "step" : undefined}>{scene.title}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
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
            showLoadingPoster={false}
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

function PickupJourney({ progress, copy }: { progress: MotionValue<number>; copy: HowStoryCopy }) {
  const pickup = storytellingAssets.howItWorks.pickup;
  const firstProgress = useTransform(progress, (value) => (
    getJourneyPhaseProgress(getJourneyViewport(value), HOW_JOURNEY_TIMELINE.pickupFirst)
  ));
  const secondProgress = useTransform(progress, (value) => (
    getJourneyPhaseProgress(getJourneyViewport(value), HOW_JOURNEY_TIMELINE.pickupSecond)
  ));
  const firstVisibility = useTransform(progress, (value) => (
    getJourneyViewport(value) < HOW_JOURNEY_TIMELINE.pickupSecond.start ? "visible" : "hidden"
  ));
  const secondVisibility = useTransform(progress, (value) => (
    getJourneyViewport(value) < HOW_JOURNEY_TIMELINE.pickupSecond.start ? "hidden" : "visible"
  ));

  return (
    <div className={`${styles.howJourneyPanel} ${styles.howPickupPanel}`}>
      <div className={styles.howJourneySplit}>
        <div className={styles.howJourneyVideoLeft}>
          <m.div className={styles.howJourneyVideoLayer} style={{ visibility: firstVisibility }}>
            <AlphaFrameSequence
              progress={firstProgress}
              desktop={pickup.first.sequence.desktop}
              mobile={pickup.first.sequence.mobile}
              className={styles.howJourneyFrameSequence}
            />
          </m.div>
          <m.div className={styles.howJourneyVideoLayer} style={{ visibility: secondVisibility }}>
            <AlphaFrameSequence
              progress={secondProgress}
              desktop={pickup.second.sequence.desktop}
              mobile={pickup.second.sequence.mobile}
              className={styles.howJourneyFrameSequence}
            />
          </m.div>
        </div>
        <article className={styles.howJourneyCopy}>
          <h2>{copy.journey.pickup.title}</h2>
          <p>{copy.journey.pickup.body}</p>
        </article>
      </div>
    </div>
  );
}

function FlightJourney({ progress, copy }: { progress: MotionValue<number>; copy: HowStoryCopy }) {
  const flight = storytellingAssets.howItWorks.flight;
  const reducedMotion = usePrefersReducedMotion();
  const flightProgress = useTransform(progress, (value) => (
    getJourneyPhaseProgress(getJourneyViewport(value), HOW_JOURNEY_TIMELINE.flight)
  ));
  const smoothProgress = useSpring(flightProgress, { stiffness: 120, damping: 24, mass: 0.45 });
  const resolvedProgress = reducedMotion ? flightProgress : smoothProgress;
  const panelX = useTransform(progress, (value) => {
    const viewport = getJourneyViewport(value);
    const entrance = getJourneyPhaseProgress(viewport, HOW_JOURNEY_TIMELINE.flightEntrance);
    if (reducedMotion) return viewport < HOW_JOURNEY_TIMELINE.flightEntrance.start ? "100%" : "0%";
    return `${(1 - entrance) * 100}%`;
  });
  const droneX = useTransform(resolvedProgress, FLIGHT_DRONE_POSITIONS, FLIGHT_DRONE_X);
  const droneScale = useTransform(resolvedProgress, FLIGHT_DRONE_POSITIONS, FLIGHT_DRONE_SCALE);

  return (
    <m.div className={`${styles.howJourneyPanel} ${styles.howFlightScene} ${styles.howFlightPanel}`} style={{ x: panelX }}>
      <Image src={flight.background.desktop} alt="" fill sizes="100vw" className={`${styles.howFlightBackground} ${styles.howFlightBackgroundDesktop}`} />
      <Image src={flight.background.mobile} alt="" fill sizes="100vw" className={`${styles.howFlightBackground} ${styles.howFlightBackgroundMobile}`} />
      <m.div className={styles.howFlightDroneFinal} style={{ x: droneX, scale: droneScale }}>
        <Image src={flight.droneFinal.desktop} alt="" fill sizes="(max-width: 767px) 84vw, 52vw" className={`${styles.howFlightDroneFinalImage} ${styles.howFlightDroneFinalDesktop}`} priority />
        <Image src={flight.droneFinal.mobile} alt="" fill sizes="84vw" className={`${styles.howFlightDroneFinalImage} ${styles.howFlightDroneFinalMobile}`} priority />
      </m.div>
      <article className={styles.howFlightCopy}>
        <h2>{copy.journey.flight.title}</h2>
        <p>{copy.journey.flight.body}</p>
      </article>
    </m.div>
  );
}

function DropoffJourney({ progress, copy }: { progress: MotionValue<number>; copy: HowStoryCopy }) {
  const dropoff = storytellingAssets.howItWorks.dropoff;
  const reducedMotion = usePrefersReducedMotion();
  const dropoffProgress = useTransform(progress, (value) => (
    getJourneyPhaseProgress(getJourneyViewport(value), HOW_JOURNEY_TIMELINE.dropoff)
  ));
  const panelX = useTransform(progress, (value) => {
    const viewport = getJourneyViewport(value);
    const entrance = getJourneyPhaseProgress(viewport, HOW_JOURNEY_TIMELINE.dropoffEntrance);
    if (reducedMotion) return viewport < HOW_JOURNEY_TIMELINE.dropoffEntrance.start ? "100%" : "0%";
    return `${(1 - entrance) * 100}%`;
  });

  return (
    <m.div className={`${styles.howJourneyPanel} ${styles.howDropoffPanel}`} style={{ x: panelX }}>
      <div className={`${styles.howJourneySplit} ${styles.howJourneySplitReverse}`}>
        <article className={styles.howJourneyCopy}>
          <h2>{copy.journey.dropoff.title}</h2>
          <p>{copy.journey.dropoff.body}</p>
        </article>
        <div className={styles.howJourneyVideoRight}>
          <AlphaFrameSequence
            progress={dropoffProgress}
            desktop={dropoff.sequence.desktop}
            mobile={dropoff.sequence.mobile}
            className={styles.howJourneyFrameSequence}
          />
        </div>
      </div>
    </m.div>
  );
}

function HowJourneyFlow({ progress, copy }: { progress: MotionValue<number>; copy: HowStoryCopy }) {
  const reducedMotion = usePrefersReducedMotion();
  const curtainOpacity = useTransform(progress, (value) => {
    const viewport = getJourneyViewport(value);
    if (reducedMotion) return viewport < HOW_JOURNEY_TIMELINE.finalFade.start ? 0 : 1;
    return getJourneyPhaseProgress(viewport, HOW_JOURNEY_TIMELINE.finalFade);
  });

  return (
    <div className={styles.howJourneyFlowScene}>
      <PickupJourney progress={progress} copy={copy} />
      <FlightJourney progress={progress} copy={copy} />
      <DropoffJourney progress={progress} copy={copy} />
      <m.div className={styles.howJourneyCurtain} style={{ opacity: curtainOpacity }} aria-hidden="true" />
    </div>
  );
}

export function HowItWorksStory({
  copy,
  finalCopy,
}: {
  copy: HowStoryCopy;
  finalCopy: FinalCopy;
}) {
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
      <StoryChapter
        id="how-journey"
        label={`${copy.journey.pickup.title}, ${copy.journey.flight.title}, ${copy.journey.dropoff.title}`}
        screens={HOW_JOURNEY_CHAPTER_SCREENS}
        className={styles.howJourneyChapter}
        stickyClassName={styles.howJourneyStage}
      >
        {(progress) => <HowJourneyFlow progress={progress} copy={copy} />}
      </StoryChapter>
      <FinalCtaChapter
        copy={finalCopy}
        id="how-final-cta"
        secondaryHref="/tracking"
        secondaryLabel={copy.journey.trackOrder}
      />
      <TutorialProgressRail scenes={copy.tutorial.scenes} ariaLabel={copy.tutorial.label} />
      <BackToTopButton
        ariaLabel={copy.backToTopAria}
        targetId="how-hero"
        className={styles.howBackToTopButton}
      />
    </div>
  );
}
