// Builds the reduced, watermarked broker-card preview shown on /about.
// The watermark is baked into the pixels (not a CSS overlay), and the output is
// deliberately low-resolution. The original card never enters the repository.
//
// Usage:
//   1. Export the card PDF to a PNG outside the repo (e.g. macOS Preview → Export → PNG, ~1400 px wide).
//   2. node scripts/make-credential-preview.mjs <card.png> [left,top,width,height]
//
// Output: public/credentials/rera-card-preview.webp
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [input, cropArg] = process.argv.slice(2);
if (!input) {
  console.error("Usage: node scripts/make-credential-preview.mjs <card.png> [left,top,width,height]");
  process.exit(1);
}

const OUTPUT_WIDTH = 720;
const outDir = path.join(process.cwd(), "public", "credentials");
const outFile = path.join(outDir, "rera-card-preview.webp");

let image = sharp(input);
if (cropArg) {
  const [left, top, width, height] = cropArg.split(",").map(Number);
  image = image.extract({ left, top, width, height });
}
const resized = await image.resize({ width: OUTPUT_WIDTH }).toBuffer();
const { width, height } = await sharp(resized).metadata();

const mark = "caspian-properties.com · verification only";
const rows = [];
for (let y = -height; y < height * 2; y += 64) {
  for (let x = -width; x < width * 2; x += 360) {
    rows.push(`<text x="${x}" y="${y}">${mark}</text>`);
  }
}
const band = 30;
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g transform="rotate(-22 ${width / 2} ${height / 2})"
     font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="600"
     fill="#FFFFFF" fill-opacity="0.30" stroke="#1F1F1F" stroke-opacity="0.18" stroke-width="0.6">
    ${rows.join("\n    ")}
  </g>
  <rect x="0" y="${height - band}" width="${width}" height="${band}" fill="#1F1F1F" fill-opacity="0.78"/>
  <text x="${width / 2}" y="${height - band / 2 + 5}" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#E9AF8B">
    Preview for verification on caspian-properties.com only — verify officially with the Dubai Land Department
  </text>
</svg>`;

mkdirSync(outDir, { recursive: true });
await sharp(resized)
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .webp({ quality: 68 })
  .withMetadata({ exif: {} })
  .toFile(outFile);

const meta = await sharp(outFile).metadata();
console.log(`Wrote ${path.relative(process.cwd(), outFile)} (${meta.width}×${meta.height})`);
