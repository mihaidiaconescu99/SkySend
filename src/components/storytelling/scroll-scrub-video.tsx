"use client";

import type { MotionValue } from "motion/react";
import { useMotionValueEvent } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { COMPACT_LAYOUT_MEDIA_QUERY } from "@/lib/responsive-layout";
import { cn } from "@/lib/utils";
import styles from "./storytelling.module.css";

type ScrollScrubVideoProps = {
  progress: MotionValue<number>;
  desktopSrc: string;
  mobileSrc: string;
  desktopPoster: string;
  mobilePoster: string;
  fallbackDesktop?: string;
  fallbackMobile?: string;
  className?: string;
  mediaClassName?: string;
  eager?: boolean;
  objectFit?: "cover" | "contain";
  seekMode?: "damped" | "direct";
  onReadyChange?: (ready: boolean) => void;
  showLoadingPoster?: boolean;
};

type ViewportKind = "desktop" | "mobile";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function ScrollScrubVideo({
  progress,
  desktopSrc,
  mobileSrc,
  desktopPoster,
  mobilePoster,
  fallbackDesktop,
  fallbackMobile,
  className,
  mediaClassName,
  eager = false,
  objectFit = "cover",
  seekMode = "damped",
  onReadyChange,
  showLoadingPoster = true,
}: ScrollScrubVideoProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetRef = useRef(0);
  const frameRef = useRef(0);
  const lastSeekAtRef = useRef(0);
  const [viewport, setViewport] = useState<ViewportKind | null>(null);
  const [nearViewport, setNearViewport] = useState(eager);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = viewport === "mobile";
  const src = isMobile ? mobileSrc : desktopSrc;
  const poster = isMobile ? mobilePoster : desktopPoster;
  const fallback = isMobile ? fallbackMobile : fallbackDesktop;
  const canLoad = viewport !== null && (nearViewport || eager);
  const showFallback = reducedMotion || failed;

  const scheduleSeek = useCallback(() => {
    if (frameRef.current || reducedMotion) return;

    const tick = (now: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
        frameRef.current = 0;
        return;
      }

      if (seekMode === "direct") {
        video.pause();
        video.currentTime = clamp(targetRef.current) * video.duration;
        frameRef.current = 0;
        return;
      }

      if (now - lastSeekAtRef.current < 28) {
        frameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      lastSeekAtRef.current = now;
      const targetTime = clamp(targetRef.current) * Math.max(0, video.duration - 0.025);
      const difference = targetTime - video.currentTime;
      const snapDistance = Math.max(0.018, video.duration * 0.0025);

      if (Math.abs(difference) <= snapDistance) {
        if (Math.abs(video.currentTime - targetTime) > 0.004) {
          video.currentTime = targetTime;
        }
        frameRef.current = 0;
        return;
      }

      const maxStep = Math.max(0.12, video.duration * 0.075);
      const dampedStep = Math.min(maxStep, Math.max(-maxStep, difference * 0.42));
      video.currentTime = clamp(video.currentTime + dampedStep, 0, video.duration);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);
  }, [reducedMotion, seekMode]);

  useMotionValueEvent(progress, "change", (value) => {
    targetRef.current = clamp(value);
    scheduleSeek();
  });

  useEffect(() => {
    const query = window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY);
    const update = () => setViewport(query.matches ? "mobile" : "desktop");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (eager || !hostRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNearViewport(true);
      },
      { rootMargin: "120% 0px" },
    );
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [eager]);

  useEffect(
    () => () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canLoad) return;

    setReady(false);
    setFailed(false);
    video.load();
  }, [canLoad, src]);

  const markReady = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    targetRef.current = clamp(progress.get());
    setReady(true);
    onReadyChange?.(true);
    scheduleSeek();
  }, [onReadyChange, scheduleSeek]);

  const markFailed = useCallback(() => {
    setFailed(true);
    setReady(true);
    onReadyChange?.(true);
  }, [onReadyChange]);

  return (
    <div ref={hostRef} className={cn(styles.scrubHost, className)} aria-hidden="true">
      {showFallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallback ?? poster}
          alt=""
          className={cn(styles.scrubMedia, mediaClassName)}
          style={{ objectFit }}
          draggable={false}
        />
      ) : (
        <>
          {!ready && showLoadingPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              className={cn(styles.scrubMedia, styles.scrubPoster, mediaClassName)}
              style={{ objectFit }}
              draggable={false}
            />
          ) : null}
          <video
            ref={videoRef}
            src={canLoad ? src : undefined}
            poster={showLoadingPoster ? poster : undefined}
            preload={eager || nearViewport ? "auto" : "none"}
            muted
            playsInline
            controls={false}
            disablePictureInPicture
            tabIndex={-1}
            className={cn(styles.scrubMedia, mediaClassName)}
            style={{ objectFit }}
            onCanPlay={markReady}
            onLoadedData={markReady}
            onError={markFailed}
          />
        </>
      )}

      {!ready && !showFallback ? (
        <div className={styles.mediaLoader}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </div>
  );
}
