"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { motionTransitions } from "@/lib/motion";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={motionTransitions.base}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
