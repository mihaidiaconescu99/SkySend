import type { Transition, Variants } from "motion/react";

export const motionDurations = {
  instant: 0.12,
  fast: 0.14,
  base: 0.18,
  slow: 0.24,
} as const;

export const motionEasing = {
  standard: [0.22, 1, 0.36, 1],
  gentle: [0.25, 0.1, 0.25, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const motionTransitions = {
  base: {
    duration: motionDurations.base,
    ease: motionEasing.standard,
  } satisfies Transition,
  fast: {
    duration: motionDurations.fast,
    ease: motionEasing.gentle,
  } satisfies Transition,
  exit: {
    duration: motionDurations.fast,
    ease: motionEasing.exit,
  } satisfies Transition,
  modal: {
    duration: 0.2,
    ease: motionEasing.standard,
  } satisfies Transition,
  status: {
    duration: 0.16,
    ease: motionEasing.gentle,
  } satisfies Transition,
} as const;

export const motionStagger = {
  compact: 0.04,
  relaxed: 0.06,
} as const;

export const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: motionDurations.instant },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1 },
  },
};

export const motionTransitions_section: Transition = {
  duration: 0.6,
  ease: [0.16, 1, 0.3, 1],
};

export const motionPresets = {
  section: {
    initial: { opacity: 0, y: 40 },
    animate: {
      opacity: 1,
      y: 0,
      transition: motionTransitions_section,
    },
    exit: {
      opacity: 0,
      y: -16,
      transition: motionTransitions.exit,
    },
  } satisfies Variants,
  page: {
    initial: { opacity: 0, y: 6 },
    animate: {
      opacity: 1,
      y: 0,
      transition: motionTransitions.base,
    },
    exit: {
      opacity: 0,
      y: -4,
      transition: motionTransitions.exit,
    },
  } satisfies Variants,
  card: {
    initial: { opacity: 0, y: 6 },
    animate: {
      opacity: 1,
      y: 0,
      transition: motionTransitions.base,
    },
    exit: {
      opacity: 0,
      y: 4,
      transition: motionTransitions.exit,
    },
  } satisfies Variants,
  modal: {
    initial: { opacity: 0, y: 6, scale: 0.995 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: motionTransitions.modal,
    },
    exit: {
      opacity: 0,
      y: 4,
      scale: 0.995,
      transition: motionTransitions.exit,
    },
  } satisfies Variants,
  drawer: {
    initial: { opacity: 0, x: 8 },
    animate: {
      opacity: 1,
      x: 0,
      transition: motionTransitions.base,
    },
    exit: {
      opacity: 0,
      x: 6,
      transition: motionTransitions.exit,
    },
  } satisfies Variants,
  status: {
    initial: { opacity: 0, scale: 0.985 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: motionTransitions.status,
    },
    exit: {
      opacity: 0,
      scale: 0.99,
      transition: motionTransitions.fast,
    },
  } satisfies Variants,
  overlay: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: motionTransitions.fast,
    },
    exit: {
      opacity: 0,
      transition: motionTransitions.fast,
    },
  } satisfies Variants,
} as const;

export type MotionPreset = keyof typeof motionPresets;

export function resolveMotionPreset(
  preset: MotionPreset,
  shouldReduceMotion: boolean,
) {
  return shouldReduceMotion ? reducedMotionVariants : motionPresets[preset];
}
