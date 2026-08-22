/**
 * png.ts — rasterize the mark's SVG to a PNG buffer (Node-only; the
 * playground does the same in-browser via <canvas>).
 */

import { Resvg } from "@resvg/resvg-js";

/** Default width in pixels of exported PNGs; height follows the aspect ratio. */
export const PNG_SIZE = 1024;

export function renderPng(svg: string, width: number = PNG_SIZE): Buffer {
  return new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
}
