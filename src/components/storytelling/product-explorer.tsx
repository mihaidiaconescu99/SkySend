"use client";

import Image from "next/image";
import type { MotionValue } from "motion/react";
import { AnimatePresence, m, useTransform } from "motion/react";
import { ArrowLeft, Box, Plane, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCopy } from "@/lib/i18n/public-copy";
import { storytellingAssets } from "@/lib/storytelling-assets";
import { cn } from "@/lib/utils";
import { SchematicWorld } from "./schematic-world";
import { StoryChapter } from "./story-chapter";
import styles from "./storytelling.module.css";

type ExplorerView = "wide" | "drone" | "locker";
type ExplorerCopy = PublicCopy["home"]["story"]["explorer"];

function ProductHotspot({
  label,
  className,
  icon,
  buttonRef,
  onClick,
}: {
  label: string;
  className: string;
  icon: "drone" | "locker";
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onClick: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={cn(styles.hotspot, className)}
      onClick={onClick}
      aria-label={label}
    >
      <span className={styles.hotspotPulse} aria-hidden="true" />
      <span className={styles.hotspotIcon} aria-hidden="true">
        <Plus />
      </span>
      <span className={styles.hotspotLabel}>
        {icon === "drone" ? <Plane aria-hidden="true" /> : <Box aria-hidden="true" />}
        {label}
      </span>
    </button>
  );
}

function ProductExplorerScene({
  progress,
  copy,
}: {
  progress: MotionValue<number>;
  copy: ExplorerCopy;
}) {
  const [view, setView] = useState<ExplorerView>("wide");
  const [lockerOpen, setLockerOpen] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const droneButtonRef = useRef<HTMLButtonElement>(null);
  const lockerButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const lockerVideoRef = useRef<HTMLVideoElement>(null);
  const reverseFrameRef = useRef(0);
  const sourceButtonRef = useRef<HTMLButtonElement | null>(null);

  const sceneOpacity = useTransform(progress, [0, 0.08, 0.92, 1], [0, 1, 1, 0.8]);
  const sceneScale = useTransform(progress, [0, 0.14], [0.96, 1]);
  const hotspotsOpacity = useTransform(progress, [0.1, 0.2], [0, 1]);

  const cancelReverse = useCallback(() => {
    if (reverseFrameRef.current) {
      window.cancelAnimationFrame(reverseFrameRef.current);
      reverseFrameRef.current = 0;
    }
  }, []);

  const closeDetail = useCallback(() => {
    cancelReverse();
    const video = lockerVideoRef.current;
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setLockerOpen(false);
    setView("wide");
    window.requestAnimationFrame(() => sourceButtonRef.current?.focus());
  }, [cancelReverse]);

  const openDetail = useCallback((next: Exclude<ExplorerView, "wide">) => {
    sourceButtonRef.current = next === "drone" ? droneButtonRef.current : lockerButtonRef.current;
    setView(next);
    window.requestAnimationFrame(() => backButtonRef.current?.focus());
  }, []);

  const closeLocker = useCallback(() => {
    const video = lockerVideoRef.current;
    if (!video) {
      setLockerOpen(false);
      return;
    }

    cancelReverse();
    video.pause();
    const startTime = performance.now();
    const startAt = video.currentTime;
    const durationMs = Math.max(450, startAt * 1000);

    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - startTime) / durationMs);
      video.currentTime = Math.max(0, startAt * (1 - elapsed));
      if (elapsed < 1) {
        reverseFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        reverseFrameRef.current = 0;
        setLockerOpen(false);
      }
    };
    reverseFrameRef.current = window.requestAnimationFrame(tick);
  }, [cancelReverse]);

  const toggleLocker = useCallback(() => {
    const video = lockerVideoRef.current;
    if (lockerOpen) {
      closeLocker();
      return;
    }

    setLockerOpen(true);
    if (video) {
      cancelReverse();
      video.currentTime = 0;
      video.playbackRate = 1;
      void video.play().catch(() => setVideoFailed(true));
    }
  }, [cancelReverse, closeLocker, lockerOpen]);

  useEffect(() => {
    if (view === "wide") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKeyDown);
    document.documentElement.classList.add("story-explorer-open");
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.documentElement.classList.remove("story-explorer-open");
    };
  }, [closeDetail, view]);

  useEffect(() => () => cancelReverse(), [cancelReverse]);

  return (
    <m.div className={styles.explorerScene} style={{ opacity: sceneOpacity, scale: sceneScale }}>
      <SchematicWorld progress={progress} />
      <div className={styles.ambientOrb} aria-hidden="true" />

      <AnimatePresence mode="wait" initial={false}>
        {view === "wide" ? (
          <m.div
            key="wide"
            className={styles.explorerWide}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className={styles.storyHeader}>
              <p>{copy.eyebrow}</p>
              <h2>{copy.title}</h2>
              <span>{copy.body}</span>
            </header>

            <div className={styles.rigFrame}>
              <Image
                src={storytellingAssets.product.rigFront}
                alt=""
                fill
                priority
                sizes="(max-width: 767px) 96vw, 72vw"
                className={styles.containImage}
              />
              <m.div className={styles.hotspotLayer} style={{ opacity: hotspotsOpacity }}>
                <ProductHotspot
                  label={copy.droneHotspot}
                  icon="drone"
                  className={styles.droneHotspot}
                  buttonRef={droneButtonRef}
                  onClick={() => openDetail("drone")}
                />
                <ProductHotspot
                  label={copy.lockerHotspot}
                  icon="locker"
                  className={styles.lockerHotspot}
                  buttonRef={lockerButtonRef}
                  onClick={() => openDetail("locker")}
                />
              </m.div>
            </div>
          </m.div>
        ) : (
          <m.div
            key={view}
            className={styles.explorerDetail}
            initial={{ opacity: 0, scale: 0.92, x: view === "drone" ? 46 : -46 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.66, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              ref={backButtonRef}
              type="button"
              onClick={closeDetail}
              className={styles.backButton}
            >
              <ArrowLeft aria-hidden="true" />
              {copy.back}
            </button>

            <div className={styles.detailCopy} id={`explorer-${view}-copy`}>
              <p>{view === "drone" ? copy.drone.title : copy.locker.title}</p>
              <h2>{view === "drone" ? copy.drone.body : copy.locker.body}</h2>
              <ul>
                {(view === "drone" ? copy.drone.facts : copy.locker.facts).map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>

            {view === "drone" ? (
              <div className={styles.droneDetailVisual} aria-describedby="explorer-drone-copy">
                <Image
                  src={storytellingAssets.product.drone}
                  alt=""
                  fill
                  sizes="(max-width: 767px) 100vw, 68vw"
                  className={styles.containImage}
                />
                <div className={styles.rotorField} aria-hidden="true">
                  <span style={{ left: "19%", top: "42%" }} />
                  <span style={{ left: "36%", top: "49%" }} />
                  <span style={{ left: "66%", top: "48%" }} />
                  <span style={{ left: "83%", top: "42%" }} />
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={styles.lockerDetailVisual}
                onClick={toggleLocker}
                aria-pressed={lockerOpen}
                aria-describedby="explorer-locker-copy"
                aria-label={lockerOpen ? copy.locker.close : copy.locker.open}
              >
                {videoFailed ? (
                  <Image
                    src={lockerOpen ? storytellingAssets.product.lockerOpen : storytellingAssets.product.lockerClosed}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 90vw, 62vw"
                    className={styles.containImage}
                  />
                ) : (
                  <video
                    ref={lockerVideoRef}
                    src={storytellingAssets.interactive.lockerOpen}
                    poster={storytellingAssets.interactive.poster}
                    muted
                    playsInline
                    preload="auto"
                    disablePictureInPicture
                    onError={() => setVideoFailed(true)}
                    onEnded={() => setLockerOpen(true)}
                  />
                )}
                <span className={styles.lockerAction}>
                  <RotateCcw aria-hidden="true" />
                  {lockerOpen ? copy.locker.close : copy.locker.open}
                </span>
              </button>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
}

export function ProductExplorer({ copy, chapterLabel }: { copy: ExplorerCopy; chapterLabel: string }) {
  return (
    <StoryChapter id="story-explorer" label={chapterLabel} screens={1.85}>
      {(progress) => <ProductExplorerScene progress={progress} copy={copy} />}
    </StoryChapter>
  );
}
