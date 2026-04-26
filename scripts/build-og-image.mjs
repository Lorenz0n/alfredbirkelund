// Render public/og-image.svg to public/og-image.png (1200×630).
// Run after editing the SVG: `npm run build:og`.

import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const svgPath = path.resolve('public/og-image.svg');
const pngPath = path.resolve('public/og-image.png');

const svg = fs.readFileSync(svgPath);
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { loadSystemFonts: true },
});
fs.writeFileSync(pngPath, resvg.render().asPng());

console.log(`Wrote ${pngPath}`);
