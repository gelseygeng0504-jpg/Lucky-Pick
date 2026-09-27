import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from '../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const paintings = ['lavender-field', 'sunny-harbor', 'coral-garden', 'alpine-lake'];
// Two screenshots include thin black capture borders that are not part of the paintings.
const screenshotBorders = {
  'sunny-harbor': { left: 9, right: 0 },
  'alpine-lake': { left: 0, right: 5 },
};

for (const name of paintings) {
  const original = path.join(projectRoot, 'assets/theme-references', `${name}.png`);
  const repaired = path.join(projectRoot, 'assets/theme-inpainted', `${name}.png`);
  const destination = path.join(projectRoot, 'public/theme-backgrounds', `${name}.webp`);
  const { width, height } = await sharp(original).metadata();
  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><linearGradient id="blend" x1="0" y1="0" x2="0" y2="1">
        <stop offset="10%" stop-color="black"/>
        <stop offset="19%" stop-color="white"/>
        <stop offset="82%" stop-color="white"/>
        <stop offset="91%" stop-color="black"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#blend)"/>
    </svg>
  `);
  const alpha = await sharp(svg).extractChannel('red').png().toBuffer();
  const repairedRgb = await sharp(repaired).resize(width, height, { fit: 'fill' }).removeAlpha().png().toBuffer();
  const repairLayer = await sharp(repairedRgb).joinChannel(alpha).png().toBuffer();

  const composite = await sharp(original)
    .composite([{ input: repairLayer, blend: 'over' }])
    .png()
    .toBuffer();
  const border = screenshotBorders[name] ?? { left: 0, right: 0 };
  await sharp(composite)
    .extract({ left: border.left, top: 0, width: width - border.left - border.right, height })
    .webp({ lossless: true })
    .toFile(destination);
  process.stdout.write(`${name}: ${width}x${height} -> ${destination}\n`);
}
