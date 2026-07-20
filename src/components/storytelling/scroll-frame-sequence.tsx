"use client";

import type { MotionValue } from "motion/react";
import { useMotionValueEvent } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { COMPACT_LAYOUT_MEDIA_QUERY } from "@/lib/responsive-layout";
import { cn } from "@/lib/utils";
import styles from "./storytelling.module.css";

export type FrameSequenceAsset = {
  frameRoot: string;
  frameCount: number;
  poster: string;
  reducedMotionFrame: number;
};

type ScrollFrameSequenceProps = {
  progress: MotionValue<number>;
  desktop: FrameSequenceAsset;
  mobile: FrameSequenceAsset;
  className?: string;
};

type ViewportKind = "desktop" | "mobile";

const DRONE_SEQUENCE_END = 143;
const FRAME_SEQUENCE_END = 240;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function frameUrl(asset: FrameSequenceAsset, index: number) {
  return `${asset.frameRoot}/frame-${String(index).padStart(3, "0")}.webp`;
}

function nearestFrame(
  frames: Map<number, HTMLImageElement>,
  requestedFrame: number,
) {
  let nearest: HTMLImageElement | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [index, image] of frames) {
    const distance = Math.abs(index - requestedFrame);
    if (distance < nearestDistance) {
      nearest = image;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

export function getHeroFrameIndex(progress: number, frameCount: number) {
  const finalFrame = Math.min(frameCount - 1, FRAME_SEQUENCE_END);
  const droneEnd = Math.min(finalFrame, DRONE_SEQUENCE_END);

  if (progress <= 0.454) {
    return Math.round((clamp(progress / 0.454) * droneEnd));
  }

  if (progress <= 0.652) {
    return Math.round(
      droneEnd + clamp((progress - 0.454) / 0.198) * (finalFrame - droneEnd),
    );
  }

  return finalFrame;
}

export function ScrollFrameSequence({
  progress,
  desktop,
  mobile,
  className,
}: ScrollFrameSequenceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef(new Map<number, HTMLImageElement>());
  const pendingFramesRef = useRef(new Set<number>());
  const requestPriorityFrameRef = useRef<(index: number) => void>(() => {});
  const targetFrameRef = useRef(0);
  const [viewport, setViewport] = useState<ViewportKind | null>(null);
  const [ready, setReady] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const asset = viewport === "mobile" ? mobile : desktop;

  const drawFrame = useCallback(
    (requestedFrame: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const image = nearestFrame(framesRef.current, requestedFrame);
      if (!image) return;

      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      if (!cssWidth || !cssHeight) return;

      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(cssWidth * devicePixelRatio);
      const targetHeight = Math.round(cssHeight * devicePixelRatio);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      drawCover(context, image, cssWidth, cssHeight);
    },
    [],
  );

  useMotionValueEvent(progress, "change", (value) => {
    const targetFrame = getHeroFrameIndex(value, asset.frameCount);
    targetFrameRef.current = targetFrame;
    drawFrame(targetFrame);
    requestPriorityFrameRef.current(targetFrame);
  });

  useEffect(() => {
    const query = window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY);
    const update = () => setViewport(query.matches ? "mobile" : "desktop");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => drawFrame(targetFrameRef.current));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawFrame]);

  useEffect(() => {
    if (reducedMotion) return;

    let active = true;
    framesRef.current = new Map();
    pendingFramesRef.current = new Set();
    const resetTimer = window.setTimeout(() => {
      if (active) setReady(false);
    }, 0);

    const loadFrame = (index: number) =>
      new Promise<void>((resolve) => {
        if (
          !active ||
          index < 0 ||
          index >= asset.frameCount ||
          framesRef.current.has(index) ||
          pendingFramesRef.current.has(index)
        ) {
          resolve();
          return;
        }

        pendingFramesRef.current.add(index);
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          pendingFramesRef.current.delete(index);
          if (active) {
            framesRef.current.set(index, image);
            if (index === 0) setReady(true);
            drawFrame(targetFrameRef.current);
          }
          resolve();
        };
        image.onerror = () => {
          pendingFramesRef.current.delete(index);
          resolve();
        };
        image.src = frameUrl(asset, index);
      });

    requestPriorityFrameRef.current = (index) => {
      void loadFrame(index);
    };

    const preload = async () => {
      await loadFrame(0);
      let nextFrame = 1;
      const worker = async () => {
        while (active && nextFrame < asset.frameCount) {
          const index = nextFrame;
          nextFrame += 1;
          await loadFrame(index);
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    };

    void preload();
    return () => {
      active = false;
      window.clearTimeout(resetTimer);
      requestPriorityFrameRef.current = () => {};
    };
  }, [asset, drawFrame, reducedMotion]);

  useEffect(() => {
    const targetFrame = getHeroFrameIndex(progress.get(), asset.frameCount);
    targetFrameRef.current = targetFrame;
    drawFrame(targetFrame);
  }, [asset.frameCount, drawFrame, progress]);

  if (reducedMotion) {
    return (
      <div className={cn(styles.frameSequence, className)} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frameUrl(asset, asset.reducedMotionFrame)}
          alt=""
          className={styles.framePoster}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div ref={hostRef} className={cn(styles.frameSequence, className)} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.poster} alt="" className={styles.framePoster} draggable={false} />
      <canvas ref={canvasRef} className={styles.frameCanvas} />
      {!ready ? <span className={styles.frameLoader}>Se pregătește zborul</span> : null}
    </div>
  );
}
