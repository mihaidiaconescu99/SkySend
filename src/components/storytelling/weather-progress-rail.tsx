"use client";

import type { MotionValue } from "motion/react";
import { m, useMotionValueEvent, useTransform } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import styles from "./storytelling.module.css";

function WeatherRailSegment({
  progress,
  active,
  label,
}: {
  progress: MotionValue<number>;
  active: boolean;
  label: string;
}) {
  const fill = useTransform(progress, [0, 1], [0, 1]);

  return (
    <li className={cn(active && styles.weatherRailActive)}>
      <span className={styles.weatherRailTrack} aria-hidden="true">
        <m.span className={styles.weatherRailFill} style={{ scaleY: fill }} />
      </span>
      <span className={styles.weatherRailLabel}>{label}</span>
    </li>
  );
}

export function WeatherProgressRail({
  progress,
  sceneProgress,
  sceneDurations,
  labels,
  ariaLabel,
}: {
  progress: MotionValue<number>;
  sceneProgress: readonly MotionValue<number>[];
  sceneDurations: readonly number[];
  labels: readonly string[];
  ariaLabel: string;
}) {
  const [active, setActive] = useState(0);

  useMotionValueEvent(progress, "change", (value) => {
    const total = sceneDurations.reduce((sum, duration) => sum + duration, 0);
    const elapsed = value * total;
    let boundary = 0;
    let next = labels.length - 1;
    for (let index = 0; index < sceneDurations.length; index += 1) {
      boundary += sceneDurations[index] ?? 0;
      if (elapsed < boundary) {
        next = index;
        break;
      }
    }
    setActive((current) => (current === next ? current : next));
  });

  return (
    <aside className={styles.weatherProgressRail} aria-label={ariaLabel}>
      <ol>
        {labels.map((label, index) => (
          <WeatherRailSegment
            key={label}
            progress={sceneProgress[index]}
            active={index === active}
            label={label}
          />
        ))}
      </ol>
    </aside>
  );
}
