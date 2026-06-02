/**
 * Generates PNG copies of brand SVGs for OG tags and legacy references.
 * Run: node scripts/generate-brand-pngs.mjs
 * Requires: npm install --save-dev sharp
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = join(root, "public", "brand");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("Install sharp: npm install --save-dev sharp");
  process.exit(1);
}

const pairs = [
  ["logo-horizontal-light.svg", "logo-horizontal-light.png", 640, 144],
  ["logo-horizontal-dark.svg", "logo-horizontal-dark.png", 640, 144],
  ["logo-vertical-dark.svg", "logo-vertical-dark.png", 440, 320],
  ["logo-vertical-dark-pfp.svg", "logo-vertical-dark-pfp.png", 360, 360],
  ["logo-icon-light.svg", "logo-icon-light.png", 512, 512],
  ["logo-icon-dark.svg", "logo-icon-dark.png", 512, 512],
];

if (!existsSync(brandDir)) mkdirSync(brandDir, { recursive: true });

for (const [svgName, pngName, w, h] of pairs) {
  const svgPath = join(brandDir, svgName);
  const pngPath = join(brandDir, pngName);
  const svg = readFileSync(svgPath);
  await sharp(svg).resize(w, h).png().toFile(pngPath);
  console.log("Wrote", pngName);
}

console.log("Done. Replace SVG placeholders with final brand artwork when ready.");
