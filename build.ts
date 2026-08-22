/**
 * build.ts — render the committed brand assets: hexknot.svg, plus the PNG
 * variants shown in README.md (default size, one per padding preset).
 * Run with: pnpm run build
 */

import { writeFileSync } from "node:fs";
import { PADDING_PRESETS } from "./default.ts";
import { hexKnotSvg } from "./hexknot.ts";
import { renderPng } from "./png.ts";

const svg = hexKnotSvg();
writeFileSync("hexknot.svg", svg);
console.log(`[hexknot] wrote hexknot.svg (${svg.length} bytes)`);

for (const [preset, padding] of Object.entries(PADDING_PRESETS)) {
  const out = `hexknot-padding-${preset}.png`;
  const png = renderPng(hexKnotSvg({ padding }));
  writeFileSync(out, png);
  console.log(`[hexknot] wrote ${out} (${png.length} bytes)`);
}
