/**
 * Generates favicon and dark icon PNGs from public/brand/favicon-source.png.
 * Run: npm run favicon:generate
 * Requires: sharp (devDependency)
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "public", "brand", "favicon-source.png");
const appDir = join(root, "src", "app");
const brandDir = join(root, "public", "brand");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("Install sharp: npm install --save-dev sharp");
  process.exit(1);
}

if (!existsSync(sourcePath)) {
  console.error("Missing source image:", sourcePath);
  console.error("Add your square logo as public/brand/favicon-source.png");
  process.exit(1);
}

const outputs = [
  { path: join(appDir, "icon.png"), width: 32, height: 32 },
  { path: join(appDir, "apple-icon.png"), width: 180, height: 180 },
  { path: join(brandDir, "logo-icon-dark.png"), width: 512, height: 512 },
];

for (const { path, width, height } of outputs) {
  await sharp(sourcePath).resize(width, height, { fit: "cover" }).png().toFile(path);
  console.log("Wrote", path.replace(root + "\\", "").replace(root + "/", ""));
}

await sharp(sourcePath).resize(32, 32, { fit: "cover" }).toFile(join(appDir, "favicon.ico"));
console.log("Wrote", "src/app/favicon.ico");

console.log("Done.");
