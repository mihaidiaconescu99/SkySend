export const COMPACT_LAYOUT_MEDIA_QUERY = [
  "(max-width: 767px)",
  "(max-width: 1024px) and (orientation: portrait)",
  "(max-width: 1024px) and (max-height: 600px) and (hover: none) and (pointer: coarse)",
].join(", ");

export type ResponsiveViewport = {
  width: number;
  height: number;
  coarsePointer?: boolean;
};

export function isCompactViewport({
  width,
  height,
  coarsePointer = true,
}: ResponsiveViewport) {
  if (width <= 767) return true;
  if (width <= 1024 && height > width) return true;
  return width <= 1024 && height <= 600 && coarsePointer;
}
