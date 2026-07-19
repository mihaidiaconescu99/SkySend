"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import styles from "./storytelling.module.css";

type LandingProgressRailProps = {
  labels: readonly [string, string, string, string, string, string];
  ariaLabel: string;
};

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function LandingProgressRail({ labels, ariaLabel }: LandingProgressRailProps) {
  const fillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const activeRef = useRef(0);
  const visibleRef = useRef(false);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    let boundaries: number[] = [];
    let storyBottom = 0;

    const measure = () => {
      const hero = document.getElementById("story-hero");
      const editorial = document.getElementById("story-editorial");
      const weather = document.getElementById("story-weather-resilience");
      const final = document.getElementById("story-final-cta");
      if (!hero || !editorial || !weather || !final) return;

      const absoluteTop = (element: HTMLElement) =>
        element.getBoundingClientRect().top + window.scrollY;
      const heroTop = absoluteTop(hero);
      const editorialTop = absoluteTop(editorial);
      const weatherTop = absoluteTop(weather);
      const weatherSpan = final.getBoundingClientRect().top + window.scrollY - weatherTop;
      const finalTop = absoluteTop(final);
      storyBottom = finalTop + final.offsetHeight;
      boundaries = [
        heroTop,
        editorialTop,
        weatherTop,
        weatherTop + weatherSpan * (9 / 25),
        weatherTop + weatherSpan * (17 / 25),
        finalTop,
        storyBottom,
      ];
    };

    const update = () => {
      frame = 0;
      if (boundaries.length !== 7) measure();
      if (boundaries.length !== 7) return;

      const y = window.scrollY + window.innerHeight * 0.5;
      let nextActive = 0;
      for (let index = 0; index < 6; index += 1) {
        const start = boundaries[index];
        const end = boundaries[index + 1];
        const progress = clamp((y - start) / Math.max(1, end - start));
        const fill = fillRefs.current[index];
        if (fill) fill.style.transform = `scaleY(${progress})`;
        if (y >= start && y < end) nextActive = index;
      }

      if (activeRef.current !== nextActive) {
        activeRef.current = nextActive;
        setActive(nextActive);
      }
      const nextVisible = y >= boundaries[0] && y <= storyBottom;
      if (visibleRef.current !== nextVisible) {
        visibleRef.current = nextVisible;
        setVisible(nextVisible);
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const resize = () => {
      measure();
      schedule();
    };

    measure();
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <nav
      className={cn(styles.landingProgressRail, visible && styles.landingProgressRailVisible)}
      aria-label={ariaLabel}
    >
      <ol>
        {labels.map((label, index) => (
          <li
            key={label}
            className={cn(index === active && styles.landingProgressActive)}
          >
            <span className={styles.landingProgressTrack} aria-hidden="true">
              <span
                ref={(node) => {
                  fillRefs.current[index] = node;
                }}
                className={styles.landingProgressFill}
              />
            </span>
            <span className={styles.landingProgressLabel} aria-current={index === active ? "step" : undefined}>
              {label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
