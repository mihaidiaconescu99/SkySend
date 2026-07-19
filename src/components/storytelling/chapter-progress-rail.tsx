"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import styles from "./storytelling.module.css";

type ChapterProgressRailProps = {
  rootId: string;
  labels: readonly string[];
  ariaLabel: string;
};

type ChapterBounds = { top: number; end: number; bottom: number };

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function ChapterProgressRail({
  rootId,
  labels,
  ariaLabel,
}: ChapterProgressRailProps) {
  const fillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const activeRef = useRef(0);
  const visibleRef = useRef(true);

  useEffect(() => {
    let frame = 0;
    let bounds: ChapterBounds[] = [];
    const root = document.getElementById(rootId);
    if (!root) return;

    const measure = () => {
      const viewport = window.innerHeight;
      bounds = Array.from(
        root.querySelectorAll<HTMLElement>("[data-story-chapter]"),
      ).map((chapter) => {
        const rect = chapter.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const bottom = top + chapter.offsetHeight;
        return {
          top,
          bottom,
          end: Math.max(top + 1, bottom - viewport),
        };
      });
    };

    const update = () => {
      frame = 0;
      if (!bounds.length) measure();

      const y = window.scrollY;
      const viewportAnchor = y + window.innerHeight * 0.45;
      let nextActive = 0;

      bounds.forEach((chapter, index) => {
        const progress = clamp((y - chapter.top) / Math.max(1, chapter.end - chapter.top));
        const fill = fillRefs.current[index];
        if (fill) fill.style.transform = `scaleY(${progress})`;
        if (viewportAnchor >= chapter.top && viewportAnchor < chapter.bottom) {
          nextActive = index;
        }
      });

      if (activeRef.current !== nextActive) {
        activeRef.current = nextActive;
        setActive(nextActive);
      }
      const first = bounds[0];
      const last = bounds.at(-1);
      const nextVisible = Boolean(
        first && last && viewportAnchor >= first.top && viewportAnchor <= last.bottom,
      );
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
  }, [rootId, labels.length]);

  return (
    <nav
      className={cn(styles.progressRail, visible && styles.progressRailVisible)}
      aria-label={ariaLabel}
    >
      <ol>
        {labels.map((label, index) => (
          <li key={`${label}-${index}`} className={cn(index === active && styles.railActive)}>
            <span className={styles.railTrack} aria-hidden="true">
              <span
                ref={(node) => {
                  fillRefs.current[index] = node;
                }}
                className={styles.railFill}
              />
            </span>
            <span className={styles.railLabel} aria-current={index === active ? "step" : undefined}>
              {label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
