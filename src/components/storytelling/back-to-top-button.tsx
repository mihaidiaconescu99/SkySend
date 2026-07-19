"use client";

import { ArrowUp } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import styles from "./storytelling.module.css";

export function BackToTopButton({
  ariaLabel,
  targetId = "story-hero",
  className,
}: {
  ariaLabel: string;
  targetId?: string;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <button
      type="button"
      className={[styles.backToTopButton, className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      onClick={() => {
        document.getElementById(targetId)?.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "start",
        });
      }}
    >
      <ArrowUp aria-hidden="true" />
    </button>
  );
}
