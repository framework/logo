/**
 * hexknot.ts — parametric generator for the interlocking-hexagon mark.
 *
 * How the shape works
 * -------------------
 * The logo is a single 8-cornered "band" stamped six times, each copy rotated
 * 60° about the center. Every edge of that band lies on a line whose direction
 * is one of the three edge directions of a regular hexagon, so the band is
 * fully described by 8 (normal angle, signed distance from center) pairs and
 * its corners fall out as line/line intersections. Four distances drive the
 * geometry:
 *
 *   a = size / 2       outer apothem (center -> flat outer side)
 *   t = lineWidth      band thickness
 *   v = holeSize / 2   apothem of the central opening
 *   g = gap            white gap where a band tucks under its neighbor
 *
 * Where a band runs alongside its neighbor, the space between them is
 * a - 2t - v. `bandGap` sets that space directly — it describes the same
 * degree of freedom as `holeSize` (holeSize = size - 4·lineWidth - 2·bandGap),
 * so passing it derives the hole and takes precedence over `holeSize`.
 *
 * Color
 * -----
 * `colors` takes any number of colors; `gradient` picks how they are applied:
 *   "steps"   every band is ONE solid color. The palette's main colors are
 *             spread evenly around the ring and each band between two mains
 *             carries their solid blend — a stepped gradient. With 3 mains
 *             on 6 bands: main, blend, main, blend, main, blend.
 *   "flow"    (default) smooth sweep around the ring (per-band linear
 *             gradients), oriented so matching colors sit nearby where bands meet.
 *   "flow (old)"  the original flow, whose per-band blend ran the other way —
 *             colors clashed where one band tucks under the next.
 *   "linear"  one straight gradient across the whole mark; direction set by
 *             gradientAngle (0 = left→right, 90 = top→bottom, 45 = diagonal).
 * One color gives the flat mark. "steps" and the flows blend colors
 * themselves, so they need hex colors (#rgb / #rrggbb).
 *
 * Animation
 * ---------
 * `animated` turns on a continuous color drift: the same palette position
 * that already varies per-band (see "flow"/"steps" above) is swept through a
 * full cycle over `animationDuration` seconds, via native SVG <animate>
 * elements (no JS at runtime). Because the palette is sampled as a closed
 * loop, sweeping any starting position through one full cycle always ends
 * back where it started, so the loop repeats seamlessly forever — colors
 * appear to flow around the ring like fluid. Only applies to "flow"/"flow
 * (old)"/"steps" (the gradients that blend colors) with a hex palette of 2+
 * colors; ignored (with a warning) for "linear" or a single color.
 *
 * `breathing` is a second, independent animation: an infinite loop between a
 * closed & static state (`gap`, held for `breathingHold` seconds) and an
 * open & spinning state (`gap` widened to `breathingGap`, the whole mark
 * turning one full revolution over `breathingSpin` seconds) — sequenced so
 * `gap` and rotation never move at the same time: `gap` morphs open over
 * `breathingMorph` seconds, THEN the mark spins, THEN `gap` morphs closed
 * over `breathingMorph` seconds again. Every geometry-bearing attribute
 * (each band's outline, and a flow gradient's axis) tweens between its
 * closed- and open-gap value via native SVG <animate>, so the interpolation
 * is exact — not just the color flow's paint. Works with any gradient mode
 * or palette (unlike `animated`, it doesn't need hex colors).
 *
 * Corners
 * -------
 * `cornerRadius` rounds every band corner — the SVG-path equivalent of CSS
 * border-radius (paths have no rx/ry attribute, so each corner is trimmed and
 * bridged with a circular arc). The radius is automatically capped per corner
 * so roundings never overlap on short edges. 0 (default) keeps sharp corners.
 *
 * Import:  import { hexKnotSvg } from "./hexknot";
 * CLI:     cli.ts renders the mark to a file (npx tsx cli.ts logo.svg --param=value ...).
 */

// ------------------------------------------------------------------ options

export const GRADIENTS = ["steps", "flow", "flow (old)", "linear"] as const;
export type Gradient = (typeof GRADIENTS)[number];

export interface HexKnotParams {
  /** Overall width of the hexagon, flat side to flat side. (Total height = size / cos 30° ≈ 1.155 × size.) */
  size?: number;
  /** Thickness of the bands. */
  lineWidth?: number;
  /** White gap where one band passes under another. */
  gap?: number;
  /** Width of the central opening, flat side to flat side. */
  holeSize?: number;
  /**
   * Space between neighboring bands where they run side by side. Same degree
   * of freedom as `holeSize` (holeSize = size - 4·lineWidth - 2·bandGap);
   * takes precedence over it.
   */
  bandGap?: number;
  /** Corner rounding radius (the SVG-path equivalent of CSS border-radius). 0 keeps sharp corners. */
  cornerRadius?: number;
  /** Margin between the artwork and the edge of the viewBox. */
  padding?: number;
  /**
   * Rotation of the whole mark in degrees, clockwise. The bands carry their
   * colors along, so a multi-color mark only repeats every full 360°.
   */
  rotation?: number;
  /** Color palette; 2+ entries color the bands, a single entry gives the flat mark. */
  colors?: string[];
  /** How the palette is applied: "flow" (sweep; "flow (old)" is the legacy inverted sweep), "steps" (solid bands), "linear" (straight gradient). */
  gradient?: Gradient;
  /** Direction of the "linear" gradient in degrees: 0 = left→right, 90 = top→bottom. */
  gradientAngle?: number;
  /**
   * Animate the palette so its colors continuously drift around the ring —
   * an organic, fluid-looking motion. Only takes effect with "flow"/"flow
   * (old)"/"steps" and a hex palette of 2+ colors.
   */
  animated?: boolean;
  /** Duration of one full color-drift cycle, in seconds. */
  animationDuration?: number;
  /**
   * Animate an infinite loop between two states: closed & static (`gap`) and
   * open & spinning (`gap` widened to `breathingGap`, the whole mark turning
   * one full revolution) — `gap` and rotation never move at once, so `gap`
   * morphs open, THEN the mark spins a full turn (`breathingSpin` seconds),
   * THEN `gap` morphs closed (`breathingMorph` seconds, each way), THEN the
   * closed state rests for `breathingHold` seconds before repeating.
   */
  breathing?: boolean;
  /** `gap` value in the "open" state; must stay below `bandGap` or the open bands collide. */
  breathingGap?: number;
  /** Seconds held in the closed state per cycle (the open state has no hold — it's spent spinning). */
  breathingHold?: number;
  /** Seconds to morph `gap` between states, each way. */
  breathingMorph?: number;
  /** Seconds for the one full rotation in the open state. */
  breathingSpin?: number;
  /** Background color; keep null for transparent. */
  background?: string | null;
  /** Prefix for element ids, so several generated SVGs can be inlined on one page. */
  idPrefix?: string;
  /** Decimal places used for coordinates in the output. */
  precision?: number;
  /** Receives each warning about parameter combinations that break the design. Default: console.warn. */
  onWarn?: (message: string) => void;
}

// The default parameters live in default.ts — they are the branding in use.
import { DEFAULTS } from "./default.ts";
export { DEFAULTS };

type Resolved = Required<HexKnotParams>;

/**
 * `bandGap` and `holeSize` are two views of one degree of freedom
 * (holeSize = size - 4·lineWidth - 2·bandGap); each helper derives one
 * view from the other.
 */
export function holeSizeFromBandGap(p: {
  size: number;
  lineWidth: number;
  bandGap: number;
}): number {
  return p.size - 4 * p.lineWidth - 2 * p.bandGap;
}
export function bandGapFromHoleSize(p: {
  size: number;
  lineWidth: number;
  holeSize: number;
}): number {
  return (p.size - 4 * p.lineWidth - p.holeSize) / 2;
}

const warnToConsole = (message: string): void => console.warn(`[hexknot] warning: ${message}`);

/**
 * Fill in defaults and reconcile params that describe the same thing twice:
 * `bandGap` <-> `holeSize` are two views of one degree of freedom — an
 * explicit `bandGap` derives the hole and wins over `holeSize`; otherwise
 * `holeSize` (given or default) drives and `bandGap` is derived.
 * An empty `colors` array means unset, so the default palette applies —
 * the resolved `colors` is never empty, so it IS the palette.
 */
function resolve(params: HexKnotParams): Resolved {
  const p: Resolved = { onWarn: warnToConsole, ...DEFAULTS, ...params };
  if (params.bandGap !== undefined) p.holeSize = holeSizeFromBandGap(p);
  else p.bandGap = bandGapFromHoleSize(p);
  if (p.colors.length === 0) p.colors = DEFAULTS.colors;
  return p;
}

// ----------------------------------------------------------------- geometry

type Vec = readonly [number, number];

const BAND_COUNT = 6;
const ANGLES = Array.from({ length: BAND_COUNT }, (_, k) => (360 / BAND_COUNT) * k);

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Unit vector at `deg` degrees. SVG coordinates: y grows downward. */
const unit = (deg: number): Vec => [Math.cos(rad(deg)), Math.sin(rad(deg))];

const rot = ([x, y]: Vec, deg: number): Vec => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c * x - s * y, s * x + c * y];
};

const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** An infinite line { p : n·p = o } — unit normal `n`, signed distance `o` from the origin. */
interface Line {
  readonly n: Vec;
  readonly o: number;
}

const line = (normalDeg: number, o: number): Line => ({ n: unit(normalDeg), o });

/** Point where two non-parallel lines cross. */
function intersect(a: Line, b: Line): Vec {
  const det = a.n[0] * b.n[1] - a.n[1] * b.n[0];
  if (Math.abs(det) < 1e-9) throw new Error("Degenerate geometry: consecutive edges are parallel.");
  return [(a.o * b.n[1] - b.o * a.n[1]) / det, (a.n[0] * b.o - b.n[0] * a.o) / det];
}

// ------------------------------------------------------ the band, as lines

/**
 * Edge lines of one band, in drawing order. Regular-hexagon edge normals sit
 * at multiples of 60°; this band hugs the upper-left (240°) and left (180°)
 * sides of the hexagon, then dives across the middle parallel to the
 * lower-left (120°) side. The five other bands are rotated copies.
 */
function bandEdges(p: Resolved): Line[] {
  const a = p.size / 2;
  const t = p.lineWidth;
  const v = p.holeSize / 2;
  const g = p.gap;
  return [
    line(240, a), //          outer face, upper-left side of the hexagon
    line(180, a), //          outer face, left side of the hexagon
    line(120, v + t), //      diagonal stroke, face away from the hole
    line(60, v - g), //       angled cut at the diagonal's tip
    line(120, v), //          diagonal stroke, face that forms the hole
    line(180, a - t), //      left side, inner face
    line(240, a - t), //      upper-left side, inner face
    line(180, v + t + g), //  cut where the band emerges from under its neighbor
  ];
}

/** Corners of the band: consecutive edge lines, intersected pairwise. */
const corners = (edges: Line[]): Vec[] =>
  edges.map((edge, i) => intersect(edges[(i + edges.length - 1) % edges.length], edge));

/**
 * Rounded corner i of a polygon: the two adjacent edges are trimmed back and
 * bridged by a circular arc. The trim distance is r / tan(θ/2) for interior
 * angle θ, capped at half of either edge so neighboring roundings never
 * overlap; when capped, the arc radius shrinks to match.
 */
interface RoundedCorner {
  /** Where the incoming edge stops (arc start). */
  readonly from: Vec;
  /** Where the outgoing edge resumes (arc end). */
  readonly to: Vec;
  /** Effective arc radius after capping; 0 means keep the corner sharp. */
  readonly r: number;
  /** SVG sweep flag: 1 = clockwise on screen (y grows downward). */
  readonly sweep: 0 | 1;
}

function roundCorner(poly: Vec[], i: number, radius: number): RoundedCorner {
  const pt = poly[i];
  const prev = poly[(i + poly.length - 1) % poly.length];
  const next = poly[(i + 1) % poly.length];
  const sharp: RoundedCorner = { from: pt, to: pt, r: 0, sweep: 1 };

  const d1: Vec = [prev[0] - pt[0], prev[1] - pt[1]];
  const d2: Vec = [next[0] - pt[0], next[1] - pt[1]];
  const l1 = Math.hypot(...d1);
  const l2 = Math.hypot(...d2);
  if (l1 < 1e-9 || l2 < 1e-9) return sharp;
  const u1: Vec = [d1[0] / l1, d1[1] / l1];
  const u2: Vec = [d2[0] / l2, d2[1] / l2];

  const dot = Math.min(1, Math.max(-1, u1[0] * u2[0] + u1[1] * u2[1]));
  const theta = Math.acos(dot); // interior angle at the corner
  if (theta > Math.PI - 1e-6) return sharp; // collinear edges: nothing to round

  const trim = Math.min(radius / Math.tan(theta / 2), l1 / 2, l2 / 2);
  const r = trim * Math.tan(theta / 2);
  if (r < 1e-9) return sharp;

  return {
    from: [pt[0] + u1[0] * trim, pt[1] + u1[1] * trim],
    to: [pt[0] + u2[0] * trim, pt[1] + u2[1] * trim],
    r,
    // Travel direction turns with sign of (-u1) × u2; the arc sweeps the same way.
    sweep: -(u1[0] * u2[1] - u1[1] * u2[0]) > 0 ? 1 : 0,
  };
}

/** Warnings for parameter combinations that break the design, reported through `p.onWarn`. */
function validate(p: Resolved): void {
  const warn = p.onWarn;
  if (p.size <= 0 || p.lineWidth <= 0 || p.holeSize <= 0 || p.gap < 0)
    warn("size, lineWidth and holeSize must be positive; gap must be >= 0");
  if (p.cornerRadius < 0) warn("cornerRadius must be >= 0 — treating it as 0 (sharp corners)");
  if (p.holeSize / 2 <= p.gap)
    warn(
      "holeSize/2 must exceed gap, or the stroke tips collide in the center (a big bandGap shrinks the hole)",
    );
  if (p.bandGap <= p.gap)
    warn(
      "bandGap must exceed gap, or a band collides with the neighbor it runs alongside — raise bandGap/size or lower lineWidth/holeSize/gap",
    );
  if (!GRADIENTS.includes(p.gradient))
    warn(`unknown gradient "${p.gradient}" — using "steps" (options: ${GRADIENTS.join(", ")})`);
  if (p.animated && p.animationDuration <= 0)
    warn("animationDuration must be > 0 — animation ignored");
  if (p.animated && p.colors.length <= 1) warn("animated has no effect with a single color");
  if (p.animated && p.gradient === "linear")
    warn('animated only applies to "flow"/"steps" — ignoring for "linear"');
  if (p.breathing && (p.breathingHold <= 0 || p.breathingMorph <= 0 || p.breathingSpin <= 0))
    warn("breathingHold, breathingMorph and breathingSpin must be > 0 — breathing ignored");
  if (p.breathing && p.breathingGap <= p.gap)
    warn("breathingGap should exceed gap, or the open state doesn't open anything");
  if (p.breathing && p.bandGap <= p.breathingGap)
    warn("breathingGap must stay below bandGap, or the open state's bands collide");
}

// -------------------------------------------------------------------- color

type Rgb = readonly [number, number, number];

/** "#rgb" or "#rrggbb" → [r, g, b]; null for anything else. */
function parseHex(color: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((ch) => ch + ch).join("") : m[1];
  const channel = (i: number): number => parseInt(hex.slice(i, i + 2), 16);
  return [channel(0), channel(2), channel(4)];
}

const toHex = (rgb: readonly number[]): string =>
  "#" +
  rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

/** Sample a palette treated as a closed loop, t ∈ [0, 1] (t = 1 wraps to t = 0). */
function paletteAt(palette: readonly Rgb[], t: number): string {
  const x = (((t % 1) + 1) % 1) * palette.length;
  const i = Math.floor(x) % palette.length;
  const f = x - Math.floor(x);
  const a = palette[i];
  const b = palette[(i + 1) % palette.length];
  return toHex(a.map((v, ch) => v + (b[ch] - v) * f));
}

// --------------------------------------------------------------- svg output

/** Coordinate formatter: `precision` decimals, trailing zeros stripped, no "-0". */
const numberFormatter =
  (precision: number) =>
  (n: number): string => {
    const s = n.toFixed(precision);
    // Trailing zeros only exist after a decimal point; at precision 0 there is
    // none, and stripping would corrupt integers ("120" -> "12").
    const trimmed = precision ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
    return trimmed === "-0" ? "0" : trimmed;
  };

export function hexKnotSvg(params: HexKnotParams = {}): string {
  const p = resolve(params);
  validate(p);
  const palette = p.colors;
  const fmt = numberFormatter(p.precision);

  const pathEl = (d: string, fill: string, animate?: string): string =>
    animate
      ? `  <path fill="${fill}" d="${d}">${animate}</path>`
      : `  <path fill="${fill}" d="${d}"/>`;

  const gradientEl = (
    id: string,
    [x1, y1]: Vec,
    [x2, y2]: Vec,
    stops: Array<[number, string]>,
    // One <animate> snippet per stop (same index); a missing/falsy entry leaves that stop static.
    animates?: Array<string | undefined>,
    // Extra <animate> snippets animating the gradient axis itself (x1/y1/x2/y2), e.g. for `breathing`.
    axisAnimates?: string[],
  ): string =>
    [
      `    <linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
        `x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}">`,
      ...(axisAnimates ?? []),
      ...stops.map(([o, c], i) => {
        const animate = animates?.[i];
        return animate
          ? `      <stop offset="${+o.toFixed(3)}" stop-color="${c}">${animate}</stop>`
          : `      <stop offset="${+o.toFixed(3)}" stop-color="${c}"/>`;
      }),
      `    </linearGradient>`,
    ].join("\n");

  /**
   * Sweep `attr` (a color attribute: "stop-color" or "fill") through one full
   * palette cycle starting at loop position `t0`, as a native SMIL <animate>.
   * The keyframes sit exactly at the palette's own blend breakpoints (every
   * 1/palette.length of the loop, `paletteAt`'s own linear-interpolation
   * knots) so the browser's linear interpolation between keyframes retraces
   * `paletteAt` exactly — no visible faceting, and no need to oversample.
   */
  function colorAnimate(rgb: readonly Rgb[], t0: number, duration: number, attr: string): string {
    const n = rgb.length;
    const knots = new Set<number>([0]);
    for (let i = 0; i < n; i++) {
      const x = (((i / n - t0) % 1) + 1) % 1; // phase (0..1) at which t0+phase crosses knot i
      if (x > 1e-9) knots.add(x);
    }
    const xs = [...knots].sort((a, b) => a - b);
    xs.push(1); // closes the loop: same color as x=0, so the cycle repeats seamlessly
    const keyTimes = xs.map((x) => +x.toFixed(4)).join(";");
    const values = xs.map((x) => paletteAt(rgb, t0 + x)).join(";");
    return (
      `<animate attributeName="${attr}" dur="${duration}s" repeatCount="indefinite" ` +
      `calcMode="linear" keyTimes="${keyTimes}" values="${values}"/>`
    );
  }

  /**
   * The shared timeline for `breathing`'s infinite closed↔open loop: held
   * closed for `breathingHold`, morph open over `breathingMorph`, spin for
   * `breathingSpin` (the entire open state — gap stays put throughout), morph
   * closed over `breathingMorph` — then repeat.
   */
  function breathingTiming(): { total: number; t1: number; t2: number; t3: number } {
    const hold = p.breathingHold;
    const morph = p.breathingMorph;
    const spin = p.breathingSpin;
    const total = hold + 2 * morph + spin;
    return {
      total,
      t1: hold / total,
      t2: (hold + morph) / total,
      t3: (hold + morph + spin) / total,
    };
  }

  /** Tween a geometry attribute between its closed- and open-gap value, held at each end. */
  function breathingAnimate(attr: string, closed: string, open: string): string {
    if (!p.breathing) return "";
    const { total, t1, t2, t3 } = breathingTiming();
    const keyTimes = [0, t1, t2, t3, 1].map((v) => +v.toFixed(4)).join(";");
    return (
      `<animate attributeName="${attr}" dur="${total}s" repeatCount="indefinite" ` +
      `calcMode="linear" keyTimes="${keyTimes}" values="${closed};${closed};${open};${open};${closed}"/>`
    );
  }

  /**
   * The whole mark spins one full revolution only during the open state —
   * gap is done morphing by then and stays fixed until the rotation
   * completes, so the two motions never run at once: gap first, then spin,
   * then gap again. 360° is a full turn, so it lands back exactly on the
   * closed orientation with no visible seam.
   */
  function breathingRotateAnimate(): string {
    if (!p.breathing) return "";
    const { total, t1, t2, t3 } = breathingTiming();
    const keyTimes = [0, t1, t2, t3, 1].map((v) => +v.toFixed(4)).join(";");
    return (
      `    <animateTransform attributeName="transform" type="rotate" dur="${total}s" ` +
      `repeatCount="indefinite" calcMode="linear" keyTimes="${keyTimes}" values="0;0;0;360;360"/>`
    );
  }

  // Geometry: the base band and its six rotated copies, rotated in code so the
  // whole file lives in one coordinate space (no transform/paint-server surprises).
  // `rotation` turns the whole mark by folding into each band's angle.
  // The hexagon's circumradius (center -> corner) is also half its total height
  // at rotation 0.
  const circumradius = p.size / (2 * Math.cos(rad(30)));
  const bandAngles = ANGLES.map((angle) => angle + p.rotation);
  const base = corners(bandEdges(p));
  const bands = bandAngles.map((angle) => base.map((pt) => rot(pt, angle)));
  // `breathing`'s "open" geometry: the same band, but at `breathingGap` instead of `gap`.
  const baseOpen = p.breathing ? corners(bandEdges({ ...p, gap: p.breathingGap })) : null;
  const bandsOpen = baseOpen && bandAngles.map((angle) => baseOpen.map((pt) => rot(pt, angle)));
  const dOf = (poly: Vec[]): string =>
    poly
      .map((_, i) => {
        const { from, to, r, sweep } = roundCorner(poly, i, p.cornerRadius);
        const enter = `${i === 0 ? "M" : "L"}${fmt(from[0])} ${fmt(from[1])}`;
        return r > 0
          ? `${enter} A${fmt(r)} ${fmt(r)} 0 0 ${sweep} ${fmt(to[0])} ${fmt(to[1])}`
          : enter;
      })
      .join(" ") + " Z";

  /** One path per band, each with its own solid fill (optionally animated). */
  const solidBands = (
    colorOf: (k: number) => string,
    animateOf?: (k: number) => string,
  ): string[] =>
    bands.map((band, k) => {
      const shapeAnimate = bandsOpen ? breathingAnimate("d", dOf(band), dOf(bandsOpen[k])) : "";
      return pathEl(dOf(band), colorOf(k), (animateOf?.(k) ?? "") + shapeAnimate);
    });

  const defs: string[] = [];
  let body: string[];

  if (palette.length <= 1) {
    // Flat mark: all six bands as subpaths of a single path.
    const closedD = bands.map(dOf).join(" ");
    const animate = bandsOpen && breathingAnimate("d", closedD, bandsOpen.map(dOf).join(" "));
    body = [pathEl(closedD, palette[0], animate || undefined)];
  } else if (p.gradient === "linear") {
    // One straight gradient across the whole mark.
    const id = `${p.idPrefix}-g`;
    // The gradient axis spans the circumradius, covering the mark in every direction.
    const axis = unit(p.gradientAngle);
    defs.push(
      gradientEl(
        id,
        [-circumradius * axis[0], -circumradius * axis[1]],
        [circumradius * axis[0], circumradius * axis[1]],
        palette.map((c, i) => [i / (palette.length - 1), c]),
      ),
    );
    const closedD = bands.map(dOf).join(" ");
    const animate = bandsOpen && breathingAnimate("d", closedD, bandsOpen.map(dOf).join(" "));
    body = [pathEl(closedD, `url(#${id})`, animate || undefined)];
  } else {
    // "flow" and "steps" blend colors themselves, which needs a hex palette.
    const parsed = palette.map(parseHex);
    const rgb = parsed.every((c): c is Rgb => c !== null) ? parsed : null;
    if (!rgb) {
      p.onWarn(
        `gradient "${p.gradient}" blends colors, which needs hex — cycling the palette per band instead`,
      );
      body = solidBands((k) => palette[k % palette.length]);
    } else if (p.gradient === "flow" || p.gradient === "flow (old)") {
      // Smooth sweep: per-band linear gradients along each band's start→tip
      // axis, palette positions advancing 1/6 per band so the colors run once
      // around the ring and wrap. Band k's tip tucks under band k-1 and its
      // start emerges from under band k+1, each near 60% of the covering
      // band's axis — so "flow" blends BACKWARDS, palette((k+1)/6) at the
      // start down to palette(k/6) at the tip, landing each seam's two colors
      // within half a palette step of each other. "flow (old)" is the
      // original forward blend, whose seams clashed ~1.5 steps apart.
      const from = mid(base[7], base[0]); // middle of the start cut
      const to = mid(base[3], base[4]); //   middle of the tip cut
      // Same two points, at `breathingGap` instead of `gap` — the gradient
      // axis's own "open" position, for `breathing`.
      const fromOpen = baseOpen && mid(baseOpen[7], baseOpen[0]);
      const toOpen = baseOpen && mid(baseOpen[3], baseOpen[4]);
      const forward = p.gradient === "flow (old)";
      body = bands.map((band, k) => {
        const id = `${p.idPrefix}-g${k}`;
        const positions = [k / BAND_COUNT, (k + 1) / BAND_COUNT];
        const [t0start, t0tip] = forward ? positions : [...positions].reverse();
        const animates = p.animated
          ? [
              colorAnimate(rgb, t0start, p.animationDuration, "stop-color"),
              colorAnimate(rgb, t0tip, p.animationDuration, "stop-color"),
            ]
          : undefined;
        const axisPoint = rot(from, bandAngles[k]);
        const tipPoint = rot(to, bandAngles[k]);
        const axisAnimates =
          fromOpen && toOpen
            ? (() => {
                const axisPointOpen = rot(fromOpen, bandAngles[k]);
                const tipPointOpen = rot(toOpen, bandAngles[k]);
                return [
                  breathingAnimate("x1", fmt(axisPoint[0]), fmt(axisPointOpen[0])),
                  breathingAnimate("y1", fmt(axisPoint[1]), fmt(axisPointOpen[1])),
                  breathingAnimate("x2", fmt(tipPoint[0]), fmt(tipPointOpen[0])),
                  breathingAnimate("y2", fmt(tipPoint[1]), fmt(tipPointOpen[1])),
                ];
              })()
            : undefined;
        defs.push(
          gradientEl(
            id,
            axisPoint,
            tipPoint,
            [
              [0, paletteAt(rgb, t0start)],
              [1, paletteAt(rgb, t0tip)],
            ],
            animates,
            axisAnimates,
          ),
        );
        const shapeAnimate = bandsOpen
          ? breathingAnimate("d", dOf(band), dOf(bandsOpen[k]))
          : undefined;
        return pathEl(dOf(band), `url(#${id})`, shapeAnimate);
      });
    } else {
      // "steps" (also the fallback for unknown gradients): every band is ONE
      // solid color, sampled from the
      // closed palette loop at the band's position around the ring. Main colors
      // land evenly spaced; each band between two mains gets their solid blend.
      body = solidBands(
        (k) => paletteAt(rgb, k / BAND_COUNT),
        p.animated
          ? (k) => colorAnimate(rgb, k / BAND_COUNT, p.animationDuration, "fill")
          : undefined,
      );
    }
  }

  // Everything is drawn around (0,0), so the viewBox is symmetric about the
  // origin. The canvas is SQUARE, sized by the hexagon's circumcircle:
  // `padding` is the margin between that circle and the canvas edge, which
  // keeps exports icon-shaped, the mark centered with matching margins on
  // opposite sides, and the canvas stable under `rotation` (and under
  // `breathing`, which spins the mark through every angle).
  const half = circumradius + p.padding;
  const [x, y, w, h] = [-half, -half, 2 * half, 2 * half].map(fmt);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">`,
    ...(p.background
      ? [`  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.background}"/>`]
      : []),
    ...(defs.length ? ["  <defs>", ...defs, "  </defs>"] : []),
    ...(p.breathing ? ["  <g>", breathingRotateAnimate(), ...body, "  </g>"] : body),
    `</svg>`,
    ``,
  ].join("\n");
}
