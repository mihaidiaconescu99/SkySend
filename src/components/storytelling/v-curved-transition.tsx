"use client";

import type { MotionValue } from "motion/react";
import { m, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import styles from "./storytelling.module.css";

type VCurvedTransitionProps = {
  progress: MotionValue<number>;
  color?: string;
  variant?: "valley" | "peak";
  flattenOnMobile?: boolean;
  progressRange?: [number, number];
  referenceCurve?: boolean;
};

export function VCurvedTransition({
  progress,
  color = "#050b14",
  variant = "valley",
  flattenOnMobile = false,
  progressRange = [0.739, 1],
  referenceCurve = false,
}: VCurvedTransitionProps) {
  const y = useTransform(progress, progressRange, ["105%", "0%"]);
  const path = referenceCurve
    ? "M-20 34 C248 72 520 278 720 278 C920 278 1192 72 1460 34 L1460 340 L-20 340 Z"
    : variant === "valley"
      ? "M-20 104 C290 108 500 178 720 178 C940 178 1150 108 1460 104 L1460 340 L-20 340 Z"
      : "M-20 210 C260 215 390 25 720 25 C1050 25 1180 215 1460 210 L1460 340 L-20 340 Z";
  const mobilePath =
    referenceCurve
      ? "M-20 46 C250 82 520 266 720 266 C920 266 1190 82 1460 46 L1460 340 L-20 340 Z"
      : flattenOnMobile && variant === "valley"
      ? "M-20 118 C300 120 520 164 720 164 C920 164 1140 120 1460 118 L1460 340 L-20 340 Z"
      : path;

  return (
    <m.div
      className={cn(
        styles.vCurve,
        flattenOnMobile && styles.vCurveMobileCompact,
        referenceCurve && styles.vCurveReference,
      )}
      style={{ y }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1440 340" preserveAspectRatio="none">
        <path className={styles.vCurveDesktopPath} d={path} fill={color} />
        <path className={styles.vCurveMobilePath} d={mobilePath} fill={color} />
      </svg>
      <span style={{ backgroundColor: color }} />
    </m.div>
  );
}
