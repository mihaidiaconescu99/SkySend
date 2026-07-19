import type { ParcelDimensions } from "@/types/drone";
import type {
  ParcelFragileLevel,
  ParcelPackagingType,
  ParcelSizeOption,
} from "@/types/parcel-assistant";
import type { Option } from "@/types/ui";

export const parcelPackagingLabels: Record<ParcelPackagingType, string> = {
  soft_pouch: "Plic moale",
  plastic_bag: "Pungă de plastic",
  boxed: "Cutie",
  insulated: "Izolat",
  fragile_protective: "Protecție pentru fragil",
  heavy_duty: "Ambalaj rezistent",
};

export const parcelPackagingOptions: Option<ParcelPackagingType>[] = [
  { label: parcelPackagingLabels.soft_pouch, value: "soft_pouch" },
  { label: parcelPackagingLabels.plastic_bag, value: "plastic_bag" },
  { label: parcelPackagingLabels.boxed, value: "boxed" },
  { label: parcelPackagingLabels.insulated, value: "insulated" },
  {
    label: parcelPackagingLabels.fragile_protective,
    value: "fragile_protective",
  },
  { label: parcelPackagingLabels.heavy_duty, value: "heavy_duty" },
];

export const parcelSizeLabels: Record<ParcelSizeOption, string> = {
  extra_small: "Foarte mic",
  small: "Mic",
  medium: "Mediu",
  large: "Mare",
};

export const parcelSizeOptions: Option<ParcelSizeOption>[] = [
  { label: parcelSizeLabels.extra_small, value: "extra_small" },
  { label: parcelSizeLabels.small, value: "small" },
  { label: parcelSizeLabels.medium, value: "medium" },
  { label: parcelSizeLabels.large, value: "large" },
];

export const parcelFragileLevelLabels: Record<ParcelFragileLevel, string> = {
  low: "Scăzută",
  moderate: "Moderată",
  high: "Ridicată",
};

export const parcelSizeDimensions: Record<ParcelSizeOption, ParcelDimensions> = {
  extra_small: { lengthCm: 18, widthCm: 12, heightCm: 6 },
  small: { lengthCm: 26, widthCm: 18, heightCm: 10 },
  medium: { lengthCm: 34, widthCm: 24, heightCm: 16 },
  large: { lengthCm: 48, widthCm: 34, heightCm: 24 },
};

export const parcelSizeWeightRanges: Record<ParcelSizeOption, string> = {
  extra_small: "0.2 - 0.8 kg",
  small: "0.8 - 1.8 kg",
  medium: "1.8 - 3.8 kg",
  large: "3.8 - 8.0 kg",
};
