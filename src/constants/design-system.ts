export type DesignToken = {
  name: string;
  token: string;
  value: string;
  usage: string;
};

export const brandColorTokens: DesignToken[] = [
  {
    name: "Brand Ink",
    token: "--brand-ink",
    value: "#f4f8fb",
    usage: "Primary actions, headings, and structural anchors.",
  },
  {
    name: "Brand Steel",
    token: "--brand-steel",
    value: "#8ea3b3",
    usage: "Secondary emphasis and data-support surfaces.",
  },
  {
    name: "Brand Sky",
    token: "--brand-sky",
    value: "#20e7d5",
    usage: "Soft highlights and supporting accents.",
  },
  {
    name: "Brand Mist",
    token: "--brand-mist",
    value: "#1c2a36",
    usage: "Quiet fills, section framing, and premium softness.",
  },
];

export const semanticColorTokens: DesignToken[] = [
  {
    name: "Înapoiground",
    token: "--background",
    value: "#05070a",
    usage: "Principal page canvas and calm application backdrop.",
  },
  {
    name: "Foreground",
    token: "--foreground",
    value: "#f4f8fb",
    usage: "Primary text color and high-contrast UI copy.",
  },
  {
    name: "Muted",
    token: "--muted / --muted-foreground",
    value: "#0e151d / #8ea3b3",
    usage: "Secondary surfaces, helper copy, and quiet states.",
  },
  {
    name: "Border",
    token: "--border",
    value: "#1c2a36",
    usage: "Low-noise separation for cards, fields, and layout rails.",
  },
  {
    name: "Accent",
    token: "--accent / --accent-foreground",
    value: "#123235 / #d7fffb",
    usage: "Subtle emphasis, hover fills, and informative highlighting.",
  },
  {
    name: "Success",
    token: "--success / --success-foreground",
    value: "#48d6a0 / #04100c",
    usage: "Healthy status, confirmed operations, and success badges.",
  },
  {
    name: "Warning",
    token: "--warning / --warning-foreground",
    value: "#e3b65f / #140e03",
    usage: "Operational caution and pending attention states.",
  },
  {
    name: "Destructive",
    token: "--destructive / --destructive-foreground",
    value: "#ff7d7d / #180505",
    usage: "Critical alerts, destructive actions, and error states.",
  },
];

export const spacingTokens: DesignToken[] = [
  { name: "3XS", token: "--space-3xs", value: "0.25rem", usage: "Hairline gaps and micro-alignment." },
  { name: "2XS", token: "--space-2xs", value: "0.5rem", usage: "Tight icon spacing and compact labels." },
  { name: "XS", token: "--space-xs", value: "0.75rem", usage: "Inline control padding and dense stacks." },
  { name: "SM", token: "--space-sm", value: "1rem", usage: "Principal small spacing for grouped UI." },
  { name: "MD", token: "--space-md", value: "1.5rem", usage: "Comfortable content spacing inside cards." },
  { name: "LG", token: "--space-lg", value: "2rem", usage: "Section blocks and wider clusters." },
  { name: "XL", token: "--space-xl", value: "3rem", usage: "Major card rhythm and dashboard spacing." },
  { name: "2XL", token: "--space-2xl", value: "4rem", usage: "Wide layout breathing room." },
  { name: "3XL", token: "--space-3xl", value: "5rem", usage: "Hero and full-section separation." },
];

export const typographyTokens: DesignToken[] = [
  {
    name: "Display",
    token: ".type-display",
    value: "clamp(3.5rem, 8vw, 5.5rem)",
    usage: "Landing hero headlines and key brand statements.",
  },
  {
    name: "H1",
    token: ".type-h1",
    value: "clamp(2.6rem, 5vw, 4rem)",
    usage: "Page headers and dashboard titles.",
  },
  {
    name: "H2",
    token: ".type-h2",
    value: "clamp(2rem, 4vw, 3rem)",
    usage: "Section titles and feature group headings.",
  },
  {
    name: "H3",
    token: ".type-h3",
    value: "clamp(1.5rem, 3vw, 2rem)",
    usage: "Card headings and supporting subsections.",
  },
  {
    name: "Subtitle",
    token: ".type-subtitle",
    value: "1.05rem",
    usage: "Longer introductory copy under headings.",
  },
  {
    name: "Body",
    token: ".type-body",
    value: "1rem",
    usage: "Principal reading text and interface explanations.",
  },
  {
    name: "Caption",
    token: ".type-caption",
    value: "0.78rem",
    usage: "Eyebrows, meta labels, and low-emphasis metadata.",
  },
];

export const componentGuidelines = {
  cards:
    "Folosește solid surfaces, quiet borders, and medium-soft elevation. Reserve panel radius for hero containers.",
  badges:
    "Folosește uppercase compact labels for state and context. Prefer outline or semantic fills over bright pills.",
  buttons:
    "Keep actions rounded and deliberate. Primary for commitment, outline for secondary, ghost for low-emphasis moves.",
  inputs:
    "Folosește stable card-toned fields with generous height, restrained borders, and clear focus rings.",
} as const;
