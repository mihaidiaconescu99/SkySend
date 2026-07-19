import release from "@/lib/storytelling-release.json";

export const storytellingRelease = release;

export function createStorytellingRoot(baseUrl: string | undefined = release.publicBaseUrl) {
  if (baseUrl === "") return "/assets/storytelling";
  const normalizedBaseUrl = (baseUrl ?? release.publicBaseUrl).trim().replace(/\/+$/u, "");
  return `${normalizedBaseUrl}/releases/${release.releaseId}/assets/storytelling`;
}

const STORY_ROOT = createStorytellingRoot(
  process.env.NEXT_PUBLIC_STORYTELLING_MEDIA_BASE_URL,
);
const RUNTIME_ROOT = `${STORY_ROOT}/runtime`;
const HERO_ROOT = `${STORY_ROOT}/hero`;

type ResponsiveVideoAsset = {
  desktop: string;
  mobile: string;
  posterDesktop: string;
  posterMobile: string;
  endPosterDesktop?: string;
  endPosterMobile?: string;
};

type ResponsiveFrameSequenceAsset = {
  frameRoot: string;
  frameCount: number;
  poster: string;
  reducedMotionFrame: number;
};

type AlphaFrameSequenceAsset = {
  frameRoot: string;
  frameCount: number;
  poster: string;
};

type AlphaVideoAsset = ResponsiveVideoAsset & {
  fallbackDesktop: string;
  fallbackMobile: string;
};

const LANDING_RUNTIME_ROOT = `${RUNTIME_ROOT}/landing`;
const HOW_IT_WORKS_RUNTIME_ROOT = `${RUNTIME_ROOT}/how-it-works`;

export const storytellingAssets = {
  hero: {
    desktop: {
      frameRoot: `${HERO_ROOT}/frames/desktop/images`,
      frameCount: 241,
      poster: `${HERO_ROOT}/frames/desktop/poster.webp`,
      reducedMotionFrame: 175,
    },
    mobile: {
      frameRoot: `${HERO_ROOT}/frames/mobile/images`,
      frameCount: 241,
      poster: `${HERO_ROOT}/frames/mobile/poster.webp`,
      reducedMotionFrame: 175,
    },
  } satisfies Record<"desktop" | "mobile", ResponsiveFrameSequenceAsset>,
  editorial: {
    winterFrame: {
      desktop: `${LANDING_RUNTIME_ROOT}/winter-first-frame-desktop.webp`,
      mobile: `${LANDING_RUNTIME_ROOT}/winter-first-frame-mobile.webp`,
    },
    sequence: {
      desktop: {
        frameRoot: `${LANDING_RUNTIME_ROOT}/video1-frames/desktop`,
        frameCount: 139,
        poster: `${LANDING_RUNTIME_ROOT}/video1-alpha.webp`,
      },
      mobile: {
        frameRoot: `${LANDING_RUNTIME_ROOT}/video1-frames/mobile`,
        frameCount: 139,
        poster: `${LANDING_RUNTIME_ROOT}/video1-alpha.webp`,
      },
    } satisfies Record<"desktop" | "mobile", AlphaFrameSequenceAsset>,
  },
  landingWeather: {
    winter: {
      desktop: `${LANDING_RUNTIME_ROOT}/winter-desktop-scrub.mp4`,
      mobile: `${LANDING_RUNTIME_ROOT}/winter-mobile-scrub.mp4`,
      posterDesktop: `${LANDING_RUNTIME_ROOT}/winter-first-frame-desktop.webp`,
      posterMobile: `${LANDING_RUNTIME_ROOT}/winter-first-frame-mobile.webp`,
    },
    sky: {
      desktop: `${LANDING_RUNTIME_ROOT}/sky-desktop-scrub.mp4`,
      mobile: `${LANDING_RUNTIME_ROOT}/sky-mobile-scrub.mp4`,
      posterDesktop: `${LANDING_RUNTIME_ROOT}/sky-desktop-poster.webp`,
      posterMobile: `${LANDING_RUNTIME_ROOT}/sky-mobile-poster.webp`,
    },
    rain: {
      desktop: `${LANDING_RUNTIME_ROOT}/rain-desktop-scrub.mp4`,
      mobile: `${LANDING_RUNTIME_ROOT}/rain-mobile-scrub.mp4`,
      posterDesktop: `${LANDING_RUNTIME_ROOT}/rain-desktop-poster.webp`,
      posterMobile: `${LANDING_RUNTIME_ROOT}/rain-mobile-poster.webp`,
      endPosterDesktop: `${LANDING_RUNTIME_ROOT}/rain-desktop-end.webp`,
      endPosterMobile: `${LANDING_RUNTIME_ROOT}/rain-mobile-end.webp`,
    },
  } satisfies Record<"winter" | "sky" | "rain", ResponsiveVideoAsset>,
  landingLocker: {
    shell: `${LANDING_RUNTIME_ROOT}/locker-shell.webp`,
    contents: {
      winter: `${LANDING_RUNTIME_ROOT}/locker-content-winter.webp`,
      sky: `${LANDING_RUNTIME_ROOT}/locker-content-sky.webp`,
      rain: `${LANDING_RUNTIME_ROOT}/locker-content-rain.webp`,
    },
  },
  landingFinal: {
    drone: `${LANDING_RUNTIME_ROOT}/final-drone.webp`,
    partners: [
      { id: "uber-eats", name: "Uber Eats", src: `${LANDING_RUNTIME_ROOT}/partner-uber-eats.webp` },
      { id: "wolt", name: "Wolt", src: `${LANDING_RUNTIME_ROOT}/partner-wolt.webp` },
      { id: "bolt-food", name: "Bolt Food", src: `${LANDING_RUNTIME_ROOT}/partner-bolt-food.webp` },
      { id: "sameday", name: "Sameday", src: `${LANDING_RUNTIME_ROOT}/partner-sameday.webp` },
      { id: "glovo", name: "Glovo", src: `${LANDING_RUNTIME_ROOT}/partner-glovo.webp` },
    ],
  },
  howItWorks: {
    tutorial: {
      desktop: `${HOW_IT_WORKS_RUNTIME_ROOT}/mobile-tutorial.mp4`,
      mobile: `${HOW_IT_WORKS_RUNTIME_ROOT}/mobile-tutorial.mp4`,
      posterDesktop: `${HOW_IT_WORKS_RUNTIME_ROOT}/mobile-tutorial-poster.png`,
      posterMobile: `${HOW_IT_WORKS_RUNTIME_ROOT}/mobile-tutorial-poster.png`,
    },
  },
  weather: {
    rain: {
      desktop: `${RUNTIME_ROOT}/videos/desktop/BGV-W01-rain-scrub.mp4`,
      mobile: `${RUNTIME_ROOT}/videos/mobile/BGV-W01-rain-mobile-scrub.mp4`,
      posterDesktop: `${RUNTIME_ROOT}/posters/BGV-W01-rain-scrub.webp`,
      posterMobile: `${RUNTIME_ROOT}/posters/BGV-W01-rain-mobile-scrub.webp`,
    },
    clear: {
      desktop: `${RUNTIME_ROOT}/videos/desktop/BGV-W02-clear-scrub.mp4`,
      mobile: `${RUNTIME_ROOT}/videos/mobile/BGV-W02-clear-mobile-scrub.mp4`,
      posterDesktop: `${RUNTIME_ROOT}/posters/BGV-W02-clear-scrub.webp`,
      posterMobile: `${RUNTIME_ROOT}/posters/BGV-W02-clear-mobile-scrub.webp`,
    },
    snow: {
      desktop: `${RUNTIME_ROOT}/videos/desktop/BGV-W03-snow-scrub.mp4`,
      mobile: `${RUNTIME_ROOT}/videos/mobile/BGV-W03-snow-mobile-scrub.mp4`,
      posterDesktop: `${RUNTIME_ROOT}/posters/BGV-W03-snow-scrub.webp`,
      posterMobile: `${RUNTIME_ROOT}/posters/BGV-W03-snow-mobile-scrub.webp`,
    },
  } satisfies Record<"rain" | "clear" | "snow", ResponsiveVideoAsset>,
  sequences: {
    lowerLocker: {
      desktop: `${RUNTIME_ROOT}/videos/desktop/SV-01-lower-locker-alpha.webm`,
      mobile: `${RUNTIME_ROOT}/videos/mobile/SV-01-lower-locker-mobile-alpha.webm`,
      posterDesktop: `${RUNTIME_ROOT}/posters/SV-01-lower-locker-alpha.webp`,
      posterMobile: `${RUNTIME_ROOT}/posters/SV-01-lower-locker-mobile-alpha.webp`,
      fallbackDesktop: `${RUNTIME_ROOT}/posters/SV-01-lower-locker-alpha.webp`,
      fallbackMobile: `${RUNTIME_ROOT}/posters/SV-01-lower-locker-mobile-alpha.webp`,
    },
    pickup: {
      desktop: `${RUNTIME_ROOT}/videos/desktop/SV-02-pickup-load-retract-alpha.webm`,
      mobile: `${RUNTIME_ROOT}/videos/mobile/SV-02-pickup-load-retract-mobile-alpha.webm`,
      posterDesktop: `${RUNTIME_ROOT}/posters/SV-02-pickup-load-retract-alpha.webp`,
      posterMobile: `${RUNTIME_ROOT}/posters/SV-02-pickup-load-retract-mobile-alpha.webp`,
      fallbackDesktop: `${RUNTIME_ROOT}/posters/SV-02-pickup-load-retract-alpha.webp`,
      fallbackMobile: `${RUNTIME_ROOT}/posters/SV-02-pickup-load-retract-mobile-alpha.webp`,
    },
    delivery: {
      desktop: `${RUNTIME_ROOT}/videos/desktop/SV-03-delivery-complete-alpha.webm`,
      mobile: `${RUNTIME_ROOT}/videos/mobile/SV-03-delivery-complete-mobile-alpha.webm`,
      posterDesktop: `${RUNTIME_ROOT}/posters/SV-03-delivery-complete-alpha.webp`,
      posterMobile: `${RUNTIME_ROOT}/posters/SV-03-delivery-complete-mobile-alpha.webp`,
      fallbackDesktop: `${RUNTIME_ROOT}/posters/SV-03-delivery-complete-alpha.webp`,
      fallbackMobile: `${RUNTIME_ROOT}/posters/SV-03-delivery-complete-mobile-alpha.webp`,
    },
  } satisfies Record<"lowerLocker" | "pickup" | "delivery", AlphaVideoAsset>,
  interactive: {
    lockerOpen: `${RUNTIME_ROOT}/videos/interactive/IV-01-locker-open-alpha.webm`,
    poster: `${RUNTIME_ROOT}/posters/IV-01-locker-open-alpha.webp`,
    fallback: `${RUNTIME_ROOT}/posters/IV-01-locker-open-alpha.webp`,
  },
  product: {
    rigFront: `${RUNTIME_ROOT}/images/IMG-P01-rig-front.webp`,
    rigThreeQuarter: `${RUNTIME_ROOT}/images/IMG-P02-rig-three-quarter.webp`,
    drone: `${RUNTIME_ROOT}/images/IMG-P03-drone-three-quarter.webp`,
    lockerClosed: `${RUNTIME_ROOT}/images/IMG-P04-locker-closed.webp`,
    lockerOpen: `${RUNTIME_ROOT}/images/IMG-P05-locker-open.webp`,
  },
  payload: {
    food: `${RUNTIME_ROOT}/images/IMG-C01-food.webp`,
    pharmacy: `${RUNTIME_ROOT}/images/IMG-C02-pharmacy.webp`,
    electronics: `${RUNTIME_ROOT}/images/IMG-C03-electronics.webp`,
  },
} as const;

export type StorytellingAssets = typeof storytellingAssets;
export type StoryWeather = keyof typeof storytellingAssets.weather;
export type LandingWeather = keyof typeof storytellingAssets.landingWeather;
