"use client";

import { useEffect } from "react";

type InertiaScrollOptions = {
  duration?: number;
  maxGlideDistance?: number;
  glideMultiplier?: number;
};

export function useInertiaScroll(
  enabled = true,
  {
    duration = 340,
    maxGlideDistance = 130,
    glideMultiplier = 1.35,
  }: InertiaScrollOptions = {},
) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (reducedMotion || coarsePointer) return;

    let lastDeltaY = 0;
    let quietTimer: ReturnType<typeof setTimeout> | null = null;
    let glideFrame = 0;
    let wheelActive = false;

    function getScrollTop() {
      return window.scrollY ?? document.documentElement.scrollTop ?? 0;
    }

    function getMaxScrollTop() {
      const docEl = document.documentElement;
      return Math.max(0, docEl.scrollHeight - docEl.clientHeight);
    }

    function cancelGlide() {
      if (glideFrame) {
        window.cancelAnimationFrame(glideFrame);
        glideFrame = 0;
      }
    }

    function startGlide() {
      cancelGlide();

      const impulse = Math.abs(lastDeltaY);
      if (impulse < 8) return;

      const direction = lastDeltaY > 0 ? 1 : -1;
      const glideDistance = Math.min(impulse * glideMultiplier, maxGlideDistance) * direction;
      const startTop = getScrollTop();
      const targetTop = Math.min(
        Math.max(startTop + glideDistance, 0),
        getMaxScrollTop(),
      );
      if (targetTop === startTop) return;

      const startTime = performance.now();

      function tick(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const nextTop = startTop + (targetTop - startTop) * eased;
        window.scrollTo({ top: nextTop, behavior: "auto" });

        if (progress < 1 && wheelActive === false) {
          glideFrame = window.requestAnimationFrame(tick);
        } else {
          glideFrame = 0;
        }
      }

      wheelActive = false;
      glideFrame = window.requestAnimationFrame(tick);
    }

    function handleWheel(event: WheelEvent) {
      wheelActive = true;
      cancelGlide();
      lastDeltaY = event.deltaY;

      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        quietTimer = null;
        const top = getScrollTop();
        const max = getMaxScrollTop();
        const canMove =
          lastDeltaY > 0 ? top < max : top > 0;
        if (canMove) startGlide();
      }, 110);
    }

    function cancelUser() {
      cancelGlide();
      wheelActive = true;
    }

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("pointerdown", cancelUser, { passive: true });
    window.addEventListener("keydown", cancelUser, { passive: true });
    window.addEventListener("touchstart", cancelUser, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("pointerdown", cancelUser);
      window.removeEventListener("keydown", cancelUser);
      window.removeEventListener("touchstart", cancelUser);
      if (quietTimer) clearTimeout(quietTimer);
      cancelGlide();
    };
  }, [duration, enabled, glideMultiplier, maxGlideDistance]);
}
