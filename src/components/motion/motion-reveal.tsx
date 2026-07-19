"use client";

import type { HTMLMotionProps } from "motion/react";
import { m, useReducedMotion } from "motion/react";
import type { MotionPreset } from "@/lib/motion";
import { motionTransitions, resolveMotionPreset } from "@/lib/motion";

type MotionRevealProps = HTMLMotionProps<"div"> & {
  preset?: MotionPreset;
  delay?: number;
  inView?: boolean;
  once?: boolean;
  amount?: number;
  margin?: string;
};

export function MotionReveal({
  preset = "card",
  delay = 0,
  inView = true,
  once = true,
  amount = 0.2,
  margin,
  transition,
  children,
  ...props
}: MotionRevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const variants = resolveMotionPreset(preset, Boolean(shouldReduceMotion));

  if (inView) {
    return (
      <m.div
        initial="initial"
        whileInView="animate"
        exit="exit"
        viewport={
          margin ? { once, amount, margin } : { once, amount }
        }
        variants={variants}
        transition={{
          ...(transition ?? motionTransitions.base),
          delay,
        }}
        {...props}
      >
        {children}
      </m.div>
    );
  }

  return (
    <m.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={{
        ...(transition ?? motionTransitions.base),
        delay,
      }}
      {...props}
    >
      {children}
    </m.div>
  );
}
