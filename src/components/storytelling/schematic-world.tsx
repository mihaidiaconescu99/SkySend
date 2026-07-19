"use client";

import type { MotionValue } from "motion/react";
import { m, useMotionValue, useTransform } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import styles from "./storytelling.module.css";

type SchematicWorldProps = {
  progress?: MotionValue<number>;
  variant?: "contours" | "hub" | "route";
  className?: string;
};

export function SchematicWorld({
  progress,
  variant = "contours",
  className,
}: SchematicWorldProps) {
  const instanceId = useId().replaceAll(":", "");
  const idle = useMotionValue(0.35);
  const timeline = progress ?? idle;
  const driftX = useTransform(timeline, [0, 1], [-28, 36]);
  const driftY = useTransform(timeline, [0, 1], [12, -24]);
  const routeLength = useTransform(timeline, [0.05, 0.76], [0, 1]);

  return (
    <m.svg
      className={cn(styles.schematicWorld, className)}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      style={{ x: driftX, y: driftY }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`world-fade-${variant}-${instanceId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#20e7d5" stopOpacity=".48" />
          <stop offset="1" stopColor="#20e7d5" stopOpacity=".04" />
        </linearGradient>
        <radialGradient id={`world-glow-${variant}-${instanceId}`}>
          <stop offset="0" stopColor="#20e7d5" stopOpacity=".14" />
          <stop offset="1" stopColor="#20e7d5" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="720" cy="720" rx="650" ry="250" fill={`url(#world-glow-${variant}-${instanceId})`} />
      {[
        "M-80 742 C220 640 380 820 680 735 C960 655 1140 760 1510 625",
        "M-90 790 C210 685 430 875 735 775 C1020 680 1210 805 1520 690",
        "M-120 840 C245 735 420 930 790 825 C1080 742 1260 860 1550 760",
        "M-110 690 C200 585 400 760 650 680 C930 590 1170 700 1510 570",
      ].map((path) => (
        <path
          key={path}
          d={path}
          fill="none"
          stroke={`url(#world-fade-${variant}-${instanceId})`}
          strokeWidth="1.5"
        />
      ))}

      {variant === "hub" ? (
        <g transform="translate(190 445)">
          <path d="M0 190 L165 95 L330 190 L165 285 Z" fill="#071923" stroke="#20e7d5" />
          <path d="M165 95 V285 M0 190 L330 190" fill="none" stroke="#20e7d5" opacity=".5" />
          <circle cx="165" cy="190" r="58" fill="#050b14" stroke="#20e7d5" strokeWidth="2" />
          <circle cx="165" cy="190" r="28" fill="none" stroke="#f2efe6" strokeDasharray="5 8" />
          <path d="M135 190 H195 M165 160 V220" stroke="#20e7d5" strokeWidth="2" />
        </g>
      ) : null}

      {variant === "route" ? (
        <>
          <m.path
            d="M120 660 C360 330 655 755 905 385 C1075 135 1265 280 1410 150"
            fill="none"
            stroke="#20e7d5"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="2 10"
            style={{ pathLength: routeLength }}
          />
          <circle cx="120" cy="660" r="9" fill="#20e7d5" />
          <circle cx="1410" cy="150" r="9" fill="#f2efe6" />
        </>
      ) : null}

      <g fill="#20e7d5">
        <circle cx="118" cy="724" r="3" />
        <circle cx="1110" cy="642" r="3" />
        <circle cx="1278" cy="713" r="3" />
      </g>
    </m.svg>
  );
}

type SchematicBuildingProps = {
  progress: MotionValue<number>;
  distanceLabel: string;
  className?: string;
};

export function SchematicBuilding({
  progress,
  distanceLabel,
  className,
}: SchematicBuildingProps) {
  const instanceId = useId().replaceAll(":", "");
  const outline = useTransform(progress, [0.18, 0.67], [0, 1]);
  const details = useTransform(progress, [0.34, 0.74], [0, 1]);
  const opacity = useTransform(progress, [0.12, 0.28], [0, 1]);
  const labelOpacity = useTransform(progress, [0.46, 0.62], [0, 1]);

  return (
    <m.svg
      viewBox="0 0 720 900"
      className={cn(styles.schematicBuilding, className)}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`building-line-${instanceId}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#20e7d5" />
          <stop offset="1" stopColor="#f2efe6" stopOpacity=".72" />
        </linearGradient>
      </defs>
      <m.path
        d="M95 825 H655 M165 825 V282 L360 138 L555 282 V825 M165 282 H555"
        fill="none"
        stroke={`url(#building-line-${instanceId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pathLength: outline }}
      />
      <m.path
        d="M205 365 H515 M205 472 H515 M205 579 H515 M205 686 H515 M252 282 V825 M360 282 V825 M468 282 V825 M515 580 L625 635 V736 H515 M555 635 H625"
        fill="none"
        stroke="#20e7d5"
        strokeOpacity=".7"
        strokeWidth="2"
        style={{ pathLength: details }}
      />
      <m.g style={{ opacity: labelOpacity }}>
        <path d="M100 230 V730 M86 230 H114 M86 730 H114" stroke="#f2efe6" strokeWidth="2" />
        <rect x="42" y="446" width="116" height="58" rx="29" fill="#050b14" stroke="#20e7d5" />
        <text
          x="100"
          y="482"
          textAnchor="middle"
          fill="#f2efe6"
          fontSize="22"
          fontWeight="700"
          letterSpacing="3"
        >
          {distanceLabel}
        </text>
      </m.g>
    </m.svg>
  );
}
