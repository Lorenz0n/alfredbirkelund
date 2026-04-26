// Render public/favicon.svg to public/favicon.png (512×512).
// Used for uploading to services that require a raster icon (Buttondown,
// Twitter cards, app stores, etc.). The SVG remains the canonical source.
// Run after editing the SVG: `npm run build:favicon`.

import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const svgPath = path.resolve('public/favicon.svg');
const pngPath = path.resolve('public/favicon.png');

const svg = fs.readFileSync(svgPath);
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 512 },
  font: { loadSystemFonts: true },
});
fs.writeFileSync(pngPath, resvg.render().asPng());

console.log(`Wrote ${pngPath}`);
