"use client";

import type { CSSProperties, ReactNode } from "react";
import { useRef } from "react";
import { useScroll, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import styles from "./storytelling.module.css";

type StoryChapterProps = {
  id: string;
  label: string;
  children: (progress: MotionValue<number>) => ReactNode;
  className?: string;
  stickyClassName?: string;
  screens?: number;
};

export function StoryChapter({
  id,
  label,
  children,
  className,
  stickyClassName,
  screens = 2.4,
}: StoryChapterProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <section
      ref={ref}
      id={id}
      data-story-chapter
      data-story-label={label}
      className={cn(styles.chapter, className)}
      style={{ "--story-screens": screens } as CSSProperties}
      aria-label={label}
    >
      <div className={cn(styles.stickyStage, stickyClassName)}>
        {children(scrollYProgress)}
      </div>
    </section>
  );
}
