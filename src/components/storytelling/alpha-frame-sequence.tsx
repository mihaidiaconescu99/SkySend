"use client";

import type { MotionValue } from "motion/react";
import { useMotionValueEvent } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { COMPACT_LAYOUT_MEDIA_QUERY } from "@/lib/responsive-layout";
import { cn } from "@/lib/utils";
import styles from "./storytelling.module.css";

type AlphaSequenceAsset = {
  frameRoot: string;
  frameCount: number;
  poster: string;
};

type AlphaFrameSequenceProps = {
  progress: MotionValue<number>;
  desktop: AlphaSequenceAsset;
  mobile: AlphaSequenceAsset;
  className?: string;
};

const TRAILING_FRAMES = 6;
const LEADING_FRAMES = 14;
const MAX_CACHED_FRAMES = 36;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function frameUrl(asset: AlphaSequenceAsset, index: number) {
  return `${asset.frameRoot}/frame-${String(index + 1).padStart(4, "0")}.webp`;
}

function nearestFrame(frames: Map<number, HTMLImageElement>, target: number) {
  let closest: HTMLImageElement | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (const [index, image] of frames) {
    const nextDistance = Math.abs(index - target);
    if (nextDistance < distance) {
      closest = image;
      distance = nextDistance;
    }
  }
  return closest;
}

export function AlphaFrameSequence({
  progress,
  desktop,
  mobile,
  className,
}: AlphaFrameSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLImageElement>(null);
  const framesRef = useRef(new Map<number, HTMLImageElement>());
  const pendingRef = useRef(new Set<number>());
  const requestWindowRef = useRef<(frame: number, direction: number) => void>(() => {});
  const targetFrameRef = useRef(0);
  const previousFrameRef = useRef(0);
  const animationFrameRef = useRef(0);
  const isMobile = useMediaQuery(COMPACT_LAYOUT_MEDIA_QUERY);
  const reducedMotion = usePrefersReducedMotion();
  const asset = isMobile ? mobile : desktop;

  const draw = useCallback((requestedFrame: number) => {
    const canvas = canvasRef.current;
    const image = nearestFrame(framesRef.current, requestedFrame);
    if (!canvas || !image || !canvas.clientWidth || !canvas.clientHeight) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const width = Math.round(cssWidth * ratio);
    const height = Math.round(cssHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    const scale = Math.min(cssWidth / image.naturalWidth, cssHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(
      image,
      (cssWidth - drawWidth) / 2,
      (cssHeight - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    canvas.style.opacity = "1";
    if (fallbackRef.current) fallbackRef.current.style.opacity = "0";
  }, []);

  const scheduleDraw = useCallback(
    (frame: number) => {
      targetFrameRef.current = frame;
      if (animationFrameRef.current) return;
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = 0;
        draw(targetFrameRef.current);
      });
    },
    [draw],
  );

  useMotionValueEvent(progress, "change", (value) => {
    if (reducedMotion) return;
    const target = Math.round(clamp(value, 0, 1) * (asset.frameCount - 1));
    const direction = Math.sign(target - previousFrameRef.current) || 1;
    previousFrameRef.current = target;
    scheduleDraw(target);
    requestWindowRef.current(target, direction);
  });

  useEffect(() => {
    if (fallbackRef.current) fallbackRef.current.style.opacity = "1";
    if (canvasRef.current) canvasRef.current.style.opacity = "0";
    if (reducedMotion) return;
    let active = true;
    framesRef.current.clear();
    pendingRef.current.clear();

    const loadFrame = (index: number) => {
      if (
        !active ||
        index < 0 ||
        index >= asset.frameCount ||
        framesRef.current.has(index) ||
        pendingRef.current.has(index)
      ) return;

      pendingRef.current.add(index);
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        pendingRef.current.delete(index);
        if (!active) return;
        framesRef.current.set(index, image);
        if (framesRef.current.size > MAX_CACHED_FRAMES) {
          const farthest = [...framesRef.current.keys()].sort(
            (a, b) => Math.abs(b - targetFrameRef.current) - Math.abs(a - targetFrameRef.current),
          )[0];
          if (farthest !== undefined) framesRef.current.delete(farthest);
        }
        scheduleDraw(targetFrameRef.current);
      };
      image.onerror = () => {
        pendingRef.current.delete(index);
      };
      image.src = frameUrl(asset, index);
    };

    requestWindowRef.current = (frame, direction) => {
      loadFrame(frame);
      for (let offset = 1; offset <= LEADING_FRAMES; offset += 1) {
        loadFrame(frame + offset * direction);
        if (offset <= TRAILING_FRAMES) loadFrame(frame - offset * direction);
      }
    };

    const initialFrame = Math.round(clamp(progress.get(), 0, 1) * (asset.frameCount - 1));
    targetFrameRef.current = initialFrame;
    previousFrameRef.current = initialFrame;
    requestWindowRef.current(initialFrame, 1);

    return () => {
      active = false;
      requestWindowRef.current = () => {};
    };
  }, [asset, progress, reducedMotion, scheduleDraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion) return;
    const observer = new ResizeObserver(() => scheduleDraw(targetFrameRef.current));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [reducedMotion, scheduleDraw]);

  useEffect(
    () => () => window.cancelAnimationFrame(animationFrameRef.current),
    [],
  );

  return (
    <div className={cn(styles.alphaSequence, className)} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={fallbackRef}
        src={asset.poster}
        alt=""
        draggable={false}
        className={styles.alphaSequenceFallback}
      />
      {!reducedMotion ? <canvas ref={canvasRef} className={styles.alphaSequenceCanvas} /> : null}
    </div>
  );
}
