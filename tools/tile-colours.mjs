#!/usr/bin/env node
/*
  tile-colours.mjs — eyedrops one background colour per work image and
  writes them to assets/my-work/colours.json, which build-work.mjs reads.

      node tools/tile-colours.mjs

  Each colour is the image's most prominent saturated colour (opaque pixels
  only, so a transparent PNG is judged by what is drawn, not by the hole),
  pulled down to a deep tone so white UI and pale photos stay legible on it.
  It is the tile's background: behind a transparent image it is what you
  see, behind an opaque one it is the loading colour before the file lands.

  Needs a browser to decode AVIF and WebP, so it uses Playwright's Chromium.
  Run it after adding images; the JSON is committed, the build never needs
  a browser.
*/
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORK_DIR = join(ROOT, 'assets', 'my-work');
const OUT = join(WORK_DIR, 'colours.json');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

let chromium;
try { ({ chromium } = await import('playwright')); }
catch (e) {
  try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
  catch (e2) { console.error('needs playwright: npm i -D playwright && npx playwright install chromium'); process.exit(1); }
}

const files = [];
for (const d of readdirSync(WORK_DIR)) {
  const p = join(WORK_DIR, d);
  if (d.startsWith('.') || /do not use/i.test(d) || !statSync(p).isDirectory()) continue;
  for (const f of readdirSync(p)) if (IMAGE_EXT.has(extname(f).toLowerCase())) files.push({ d, f });
}

const browser = await chromium.launch();
const page = await browser.newPage();
const colours = {};
for (const { d, f } of files) {
  const ext = extname(f).slice(1).toLowerCase();
  const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg' }[ext] || 'image/' + ext;
  const data = readFileSync(join(WORK_DIR, d, f)).toString('base64');
  colours[`${d}/${f}`] = await page.evaluate(async ([src]) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas');
    const s = Math.min(1, 320 / Math.max(img.width, img.height));
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, c.width, c.height);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    /* bin opaque pixels at 5 bits a channel; a bin's score is its count
       weighted by saturation, so a brand colour beats a sea of white or
       grey, but not so heavily that a few stray pixels win */
    const bins = new Map();
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 240) continue;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max ? (max - min) / max : 0;
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const e = bins.get(key) || { n: 0, r: 0, g: 0, b: 0, s: 0 };
      e.n++; e.r += r; e.g += g; e.b += b; e.s += sat; bins.set(key, e);
    }
    /* a real colour wins over black, white and grey as long as there is
       a fair amount of it (half a percent of the opaque pixels): the blue
       card in a Barclays shot beats the phone bezels around it. Only when
       nothing saturated reaches that floor does the grey get its turn. */
    let total = 0; for (const e of bins.values()) total += e.n;
    let best = null, bestScore = -1;
    for (const e of bins.values()) {
      const sat = e.s / e.n;
      if (sat < 0.3 || e.n < total * 0.005) continue;
      const score = e.n * sat;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (!best) for (const e of bins.values()) {
      const score = e.n * (0.15 + e.s / e.n);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (!best) return '#141416';
    let r = best.r / best.n / 255, g = best.g / best.n / 255, b = best.b / best.n / 255;
    /* to HSL, hold the hue, settle the tone deep: enough colour to read as
       the image's own, dark enough that white screens sit on it cleanly */
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l0 = (max + min) / 2;
    let h = 0, sat = 0;
    if (max !== min) {
      const dd = max - min;
      sat = l0 > 0.5 ? dd / (2 - max - min) : dd / (max + min);
      h = max === r ? ((g - b) / dd + (g < b ? 6 : 0)) : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
      h /= 6;
    }
    sat = Math.min(0.62, sat * 0.9);
    const l = sat < 0.08 ? 0.16 : 0.24;
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    const hue = t => { t = (t + 1) % 1; return t < 1/6 ? p + (q - p) * 6 * t : t < 1/2 ? q : t < 2/3 ? p + (q - p) * (2/3 - t) * 6 : p; };
    const hex = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return '#' + hex(hue(h + 1/3)) + hex(hue(h)) + hex(hue(h - 1/3));
  }, [`data:${mime};base64,${data}`]);
  console.log(colours[`${d}/${f}`], `${d} / ${f}`);
}
await browser.close();
writeFileSync(OUT, JSON.stringify(colours, null, 2) + '\n');
console.log(`\nwrote ${Object.keys(colours).length} colours to assets/my-work/colours.json`);
