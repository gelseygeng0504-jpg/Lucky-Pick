import { existsSync, readFileSync, renameSync, rmdirSync } from 'node:fs';
import path from 'node:path';

const output = path.resolve('dist/client');
const html = path.join(output, 'index.html');
const prefixedAssets = path.join(output, 'Lucky-Pick', '_next');
const assets = path.join(output, '_next');

if (!existsSync(html) || !existsSync(prefixedAssets) || existsSync(assets)) {
  throw new Error('GitHub Pages build output is missing or already prepared.');
}

if (!readFileSync(html, 'utf8').includes('/Lucky-Pick/_next/')) {
  throw new Error('GitHub Pages asset prefix was not included in the HTML.');
}

// Pages serves this artifact at /Lucky-Pick/, so its root must contain _next/.
renameSync(prefixedAssets, assets);
rmdirSync(path.join(output, 'Lucky-Pick'));
process.stdout.write('GitHub Pages artifact ready: dist/client\n');
