/**
 * Interactive playground for hexknot.ts — tweak the mark's parameters with
 * live controls and grab the resulting SVG. Run with: pnpm run dev
 */

import { COLOR_PALETTES, PALETTE_GROUPS } from "../color-palettes.ts";
import { PADDING_PRESETS } from "../default.ts";
import {
  bandGapFromHoleSize,
  DEFAULTS,
  type Gradient,
  GRADIENTS,
  hexKnotSvg,
  type HexKnotParams,
  holeSizeFromBandGap,
} from "../hexknot.ts";

// ------------------------------------------------------------------- state

// The playground drives every visual parameter; `idPrefix` stays at its default.
type State = Omit<Required<HexKnotParams>, "idPrefix" | "onWarn">;

const { idPrefix: _idPrefix, ...stateDefaults } = DEFAULTS;
// The playground previews the bare mark: padding starts at the "none" preset
// (0) and is picked via the preset select above the preview.
stateDefaults.padding = PADDING_PRESETS.none;

// The numeric parameters, each with the control range it gets in the sidebar.
// `NumericKey` is derived from State, so TypeScript keeps this registry
// exhaustive: a new numeric param won't compile until it gets a slider here.
type NumericKey = { [K in keyof State]: State[K] extends number ? K : never }[keyof State];
interface SliderSpec {
  min: number;
  max: number;
  /** Sliders whose parameter only matters for one gradient mode get disabled otherwise. */
  onlyFor?: Gradient;
}
const SLIDERS: Record<NumericKey, SliderSpec> = {
  size: { min: 64, max: 1024 },
  lineWidth: { min: 1, max: 160 },
  gap: { min: 0, max: 80 },
  holeSize: { min: 2, max: 512 },
  bandGap: { min: 0, max: 128 },
  cornerRadius: { min: 0, max: 64 },
  padding: { min: 0, max: 256 },
  rotation: { min: 0, max: 360 },
  gradientAngle: { min: 0, max: 360, onlyFor: "linear" },
  animationDuration: { min: 2, max: 60 },
  breathingGap: { min: 0, max: 128 },
  breathingHold: { min: 1, max: 10 },
  breathingMorph: { min: 1, max: 10 },
  breathingSpin: { min: 1, max: 15 },
  precision: { min: 0, max: 6 },
};
const NUMERIC_KEYS = Object.keys(SLIDERS) as NumericKey[];

const urlState = paramsFromUrl();
const state: State = { ...stateDefaults, colors: [...stateDefaults.colors], ...urlState };
// `bandGap` and `holeSize` describe the same degree of freedom; reconcile
// whichever one the URL left out. Links written by syncUrl only carry
// holeSize, but a hand-written (or old) bandGap-only URL still works.
if (urlState.bandGap !== undefined && urlState.holeSize === undefined) {
  state.holeSize = holeSizeFromBandGap(state);
} else {
  state.bandGap = bandGapFromHoleSize(state);
}

// ------------------------------------------------------------- url <-> state

/** Restore state from the query string, so parameter combinations are shareable links. */
function paramsFromUrl(): Partial<State> {
  const query = new URLSearchParams(location.search);
  const partial: Partial<State> = {};
  for (const key of NUMERIC_KEYS) {
    // `raw` must be non-empty: Number("") is 0, not NaN.
    const raw = query.get(key);
    if (raw && !Number.isNaN(Number(raw))) partial[key] = Number(raw);
  }
  const gradient = query.get("gradient");
  if (gradient && GRADIENTS.includes(gradient as Gradient)) partial.gradient = gradient as Gradient;
  // Like the numeric params, a colors list that is effectively empty
  // (?colors=,,) is ignored.
  const colors = query
    .get("colors")
    ?.split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (colors?.length) partial.colors = colors;
  if (query.has("background")) partial.background = query.get("background") || null;
  if (query.has("animated")) partial.animated = query.get("animated") !== "false";
  if (query.has("breathing")) partial.breathing = query.get("breathing") !== "false";
  return partial;
}

function syncUrl(): void {
  const query = new URLSearchParams();
  for (const key of NUMERIC_KEYS) {
    // bandGap is derived from size/lineWidth/holeSize — writing those three
    // reconstructs it on load, so the URL stays free of redundant state.
    if (key === "bandGap") continue;
    if (state[key] !== stateDefaults[key]) query.set(key, String(state[key]));
  }
  if (state.gradient !== stateDefaults.gradient) query.set("gradient", state.gradient);
  if (state.colors.join(",") !== stateDefaults.colors.join(","))
    query.set("colors", state.colors.join(","));
  if (state.background !== stateDefaults.background)
    query.set("background", state.background ?? "");
  if (state.animated !== stateDefaults.animated) query.set("animated", String(state.animated));
  if (state.breathing !== stateDefaults.breathing) query.set("breathing", String(state.breathing));
  const search = query.toString();
  history.replaceState(null, "", search ? `?${search}` : location.pathname);
}

// ---------------------------------------------------------------- controls

const $ = <T extends HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
};

const controls = $("#controls");

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

const sliderRows = new Map<NumericKey, HTMLElement>();

function setSliderValue(key: NumericKey, value: number): void {
  state[key] = value;
  for (const input of sliderRows.get(key)!.querySelectorAll("input")) input.value = String(value);
}

/**
 * `bandGap` and `holeSize` are two views of one degree of freedom: editing
 * either recomputes the other, and size/lineWidth edits keep the hole and let
 * `bandGap` follow.
 */
function syncLinkedParams(changed: NumericKey): void {
  if (changed === "bandGap") {
    setSliderValue("holeSize", holeSizeFromBandGap(state));
  } else if (changed === "holeSize" || changed === "size" || changed === "lineWidth") {
    setSliderValue("bandGap", bandGapFromHoleSize(state));
  }
}

for (const key of NUMERIC_KEYS) {
  const spec = SLIDERS[key];
  const range = el("input", {
    type: "range",
    min: String(spec.min),
    max: String(spec.max),
    step: "1",
    value: String(state[key]),
  });
  const number = el("input", {
    type: "number",
    min: String(spec.min),
    max: String(spec.max),
    step: "1",
    value: String(state[key]),
  });
  const apply = (raw: string): void => {
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    state[key] = value;
    range.value = raw;
    number.value = raw;
    syncLinkedParams(key);
    render();
  };
  range.addEventListener("input", () => apply(range.value));
  number.addEventListener("input", () => apply(number.value));
  const row = el("label", { class: "control" }, el("span", {}, key), range, number);
  sliderRows.set(key, row);
  controls.append(row);
}

// Gradient mode.
const gradientSelect = el("select", {});
gradientSelect.append(
  ...GRADIENTS.map((g) => el("option", g === state.gradient ? { selected: "" } : {}, g)),
);
gradientSelect.addEventListener("input", () => {
  state.gradient = gradientSelect.value as Gradient;
  render();
});
controls.append(el("label", { class: "control" }, el("span", {}, "gradient"), gradientSelect));

// Animation: colors continuously drift around the ring, for a fluid look.
const animatedToggle = el("input", { type: "checkbox" });
animatedToggle.checked = state.animated;
animatedToggle.addEventListener("input", () => {
  state.animated = animatedToggle.checked;
  render();
});
controls.append(el("label", { class: "control" }, el("span", {}, "animated"), animatedToggle));

// Breathing: an infinite loop between closed & static and open & spinning.
const breathingToggle = el("input", { type: "checkbox" });
breathingToggle.checked = state.breathing;
breathingToggle.addEventListener("input", () => {
  state.breathing = breathingToggle.checked;
  render();
});
controls.append(el("label", { class: "control" }, el("span", {}, "breathing"), breathingToggle));

// Color palette: one picker per entry; one entry means the flat mark.
const colorList = el("div", { class: "color-list" });
const addColorButton = el("button", { type: "button", class: "small" }, "+ Add color");
addColorButton.addEventListener("click", () => {
  state.colors.push(state.colors.at(-1) ?? "#333333");
  rebuildColorList();
  render();
});

function rebuildColorList(): void {
  colorList.replaceChildren(
    ...state.colors.map((color, i) => {
      const picker = el("input", { type: "color", value: color });
      picker.addEventListener("input", () => {
        state.colors[i] = picker.value;
        render();
      });
      const remove = el("button", { type: "button", class: "small", title: "Remove color" }, "×");
      remove.disabled = state.colors.length <= 1;
      remove.addEventListener("click", () => {
        state.colors.splice(i, 1);
        rebuildColorList();
        render();
      });
      return el("div", { class: "color-entry" }, picker, remove);
    }),
    addColorButton,
  );
}
rebuildColorList();
controls.append(
  el("div", { class: "control control-colors" }, el("span", {}, "colors"), colorList),
);

// Background: transparent by default, optional solid color.
const backgroundToggle = el("input", { type: "checkbox" });
const backgroundPicker = el("input", { type: "color", value: "#ffffff" });

/** Point the toggle & picker at the current state.background. */
function syncBackgroundControls(): void {
  backgroundToggle.checked = state.background !== null;
  if (state.background) backgroundPicker.value = state.background;
}
syncBackgroundControls();

backgroundToggle.addEventListener("input", () => {
  state.background = backgroundToggle.checked ? backgroundPicker.value : null;
  render();
});
backgroundPicker.addEventListener("input", () => {
  backgroundToggle.checked = true;
  state.background = backgroundPicker.value;
  render();
});
controls.append(
  el("div", { class: "control" }, el("span", {}, "background"), backgroundToggle, backgroundPicker),
);

// Preset palettes: clicking one replaces the colors, and the background when
// the palette is designed for its own (dark) backdrop.
const paletteGroups = PALETTE_GROUPS.map((group) =>
  el(
    "div",
    { class: "palette-group" },
    el("h2", {}, group),
    ...COLOR_PALETTES.filter((palette) => palette.group === group).map((palette) => {
      const swatches = el(
        "span",
        {
          class: "palette-swatches",
          style: palette.background ? `background: ${palette.background}` : "",
        },
        ...palette.colors.map((color) => el("span", { style: `background: ${color}` })),
      );
      const button = el("button", { type: "button", class: "palette" }, swatches, palette.name);
      button.addEventListener("click", () => {
        state.colors = [...palette.colors];
        state.background = palette.background ?? null;
        syncBackgroundControls();
        rebuildColorList();
        render();
      });
      return button;
    }),
  ),
);
controls.append(el("div", { class: "palettes" }, ...paletteGroups));

// ----------------------------------------------------------------- actions

// Padding preset: a quick pick for `padding`, applied to the live preview
// (and thus everything copied/downloaded). The sidebar slider remains the
// fine-grained control; a value matching no preset shows as "custom".
const paddingSelect = $<HTMLSelectElement>("#padding-preset");
paddingSelect.append(
  ...Object.entries(PADDING_PRESETS).map(([name, value]) =>
    el("option", { value: String(value) }, name),
  ),
  el("option", { value: "custom", disabled: "", hidden: "" }, "custom"),
);
paddingSelect.addEventListener("input", () => {
  setSliderValue("padding", Number(paddingSelect.value));
  render();
});

/** Point the preset select at the current state.padding. */
function syncPaddingSelect(): void {
  const value = String(state.padding);
  paddingSelect.value = Object.values(PADDING_PRESETS).some((p) => String(p) === value)
    ? value
    : "custom";
}

$("#reset").addEventListener("click", () => {
  Object.assign(state, stateDefaults, { colors: [...stateDefaults.colors] });
  for (const key of NUMERIC_KEYS) setSliderValue(key, state[key]);
  gradientSelect.value = state.gradient;
  animatedToggle.checked = state.animated;
  breathingToggle.checked = state.breathing;
  syncBackgroundControls();
  rebuildColorList();
  render();
});

$("#copy").addEventListener("click", async (event) => {
  await navigator.clipboard.writeText(currentSvg);
  const button = event.currentTarget as HTMLButtonElement;
  button.textContent = "Copied!";
  setTimeout(() => (button.textContent = "Copy SVG"), 1200);
});

$("#download").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([currentSvg], { type: "image/svg+xml" }));
  const link = el("a", { href: url, download: "hexknot.svg" });
  link.click();
  URL.revokeObjectURL(url);
});

// PNG export rasterizes at the width given by the "PNG size" input (height
// follows the aspect ratio), independent of the mark's own `size`, so the
// exported icon stays crisp however the preview is configured.
const PNG_EXPORT_SIZE = 1024;

const pngSizeInput = $<HTMLInputElement>("#png-size");
pngSizeInput.value = String(PNG_EXPORT_SIZE);

$("#download-png").addEventListener("click", async () => {
  const match = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(currentSvg);
  if (!match) return;
  const [, , , viewBoxWidth, viewBoxHeight] = match.map(Number);
  const pngSize = Math.round(Number(pngSizeInput.value)) || PNG_EXPORT_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = pngSize;
  canvas.height = Math.round((pngSize * viewBoxHeight) / viewBoxWidth);

  const svgUrl = URL.createObjectURL(new Blob([currentSvg], { type: "image/svg+xml" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to rasterize SVG"));
      img.src = svgUrl;
    });
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }

  const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!pngBlob) return;
  const pngUrl = URL.createObjectURL(pngBlob);
  const link = el("a", { href: pngUrl, download: "hexknot.png" });
  link.click();
  URL.revokeObjectURL(pngUrl);
});

// -------------------------------------------------------- animated favicon
//
// A data-URI SVG favicon doesn't reliably replay its embedded SMIL <animate>
// elements as a browser tab icon, so when animated we redraw the favicon
// ourselves: resample the palette at the current point in the color cycle
// (same period as the preview's `animationDuration`) and render one static
// frame, on an interval fast enough to read as motion at favicon size.

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function hexTo6(hex: string): string {
  const digits = HEX_COLOR.exec(hex.trim())![1];
  return digits.length === 3 ? [...digits].map((c) => c + c).join("") : digits;
}

function hexBlend(a: string, b: string, t: number): string {
  const pa = hexTo6(a)
    .match(/../g)!
    .map((h) => parseInt(h, 16));
  const pb = hexTo6(b)
    .match(/../g)!
    .map((h) => parseInt(h, 16));
  return (
    "#" +
    pa
      .map((v, i) =>
        Math.round(v + (pb[i] - v) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** Resample `colors` (a closed loop) so index 0 sits `phase` (0..1) of the way around. */
function rotatePalette(colors: string[], phase: number): string[] {
  const n = colors.length;
  const shift = (((phase % 1) + 1) % 1) * n;
  const lo = Math.floor(shift);
  const t = shift - lo;
  return colors.map((_, i) => hexBlend(colors[(i + lo) % n], colors[(i + lo + 1) % n], t));
}

let faviconTimer: ReturnType<typeof setInterval> | null = null;
let faviconStart = 0;

function faviconTick(): void {
  const phase = (Date.now() - faviconStart) / (state.animationDuration * 1000);
  const frame = hexKnotSvg({
    ...state,
    colors: rotatePalette(state.colors, phase),
    animated: false,
    breathing: false,
    onWarn: () => {},
  });
  favicon.href = `data:image/svg+xml,${encodeURIComponent(frame)}`;
}

/** Only "flow"/"steps" with a hex palette of 2+ colors can be resampled — same eligibility as `animated` itself. */
function syncFaviconAnimation(): void {
  const eligible =
    state.animated &&
    state.gradient !== "linear" &&
    state.colors.length > 1 &&
    state.colors.every((c) => HEX_COLOR.test(c.trim()));
  if (eligible && !faviconTimer) {
    faviconStart = Date.now();
    faviconTimer = setInterval(faviconTick, 100);
  } else if (!eligible && faviconTimer) {
    clearInterval(faviconTimer);
    faviconTimer = null;
  }
}

// ------------------------------------------------------------------ render

const preview = $("#preview");
const source = $("#source");
const byteCount = $("#byte-count");
const warningsBox = $("#warnings");
const favicon = $<HTMLLinkElement>('link[rel="icon"]');

let currentSvg = "";

function render(): void {
  const warnings: string[] = [];
  try {
    currentSvg = hexKnotSvg({ ...state, onWarn: (message) => warnings.push(message) });
    preview.innerHTML = currentSvg;
    source.textContent = currentSvg;
    byteCount.textContent = `(${currentSvg.length} bytes)`;
    favicon.href = `data:image/svg+xml,${encodeURIComponent(currentSvg)}`;
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  warningsBox.hidden = warnings.length === 0;
  warningsBox.replaceChildren(...warnings.map((w) => el("p", {}, w)));

  const isBreathingKey = (key: NumericKey): boolean =>
    key === "breathingGap" ||
    key === "breathingHold" ||
    key === "breathingMorph" ||
    key === "breathingSpin";
  for (const key of NUMERIC_KEYS) {
    const { onlyFor } = SLIDERS[key];
    const inactive =
      (onlyFor && state.gradient !== onlyFor) ||
      (key === "animationDuration" && !state.animated) ||
      (isBreathingKey(key) && !state.breathing);
    sliderRows.get(key)!.classList.toggle("inactive", inactive);
  }

  syncPaddingSelect();
  syncFaviconAnimation();
  syncUrl();
}

render();
