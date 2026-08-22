/**
 * default.ts — the default parameters of the hexknot mark, i.e. the branding
 * actually in use. Tweak values in the playground (pnpm run dev), then record
 * the result here.
 */

import { COLOR_PALETTES } from "./color-palettes.ts";
import { bandGapFromHoleSize, type HexKnotParams } from "./hexknot.ts";

const DEFAULT_PALETTE = COLOR_PALETTES.find((p) => p.name === "Everforest");
if (!DEFAULT_PALETTE)
  throw new Error('default palette "Everforest" is missing from color-palettes.ts');

const size = 478;
const lineWidth = 61;
const holeSize = 186;
const padding = 50;

/**
 * Padding presets for exported assets (e.g. the PNG variants in README.md),
 * in the same units as `size`; `medium` is the mark's own default.
 */
export const PADDING_PRESETS = {
  none: 0,
  small: 24,
  medium: padding,
  large: 120,
} as const;
export type PaddingPreset = keyof typeof PADDING_PRESETS;

/** Defaults: the Everforest palette flowing around the ring; `--colors=#333333` restores the flat original. */
export const DEFAULTS: Required<Omit<HexKnotParams, "onWarn">> = {
  size,
  lineWidth,
  gap: 6,
  holeSize,
  bandGap: bandGapFromHoleSize({ size, lineWidth, holeSize }),
  cornerRadius: 10,
  padding,
  rotation: 180,
  background: null,
  precision: 1,
  colors: DEFAULT_PALETTE.colors,
  gradient: "flow",
  gradientAngle: 45,
  animated: false,
  animationDuration: 6,
  breathing: false,
  breathingGap: 20,
  breathingHold: 2,
  breathingMorph: 1,
  breathingSpin: 3,
  idPrefix: "hk",
};
