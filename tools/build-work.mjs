#!/usr/bin/env node
/*
  build-work.mjs — writes the "My Work" and "Studio Work" tiles on index.html
  from the folders in assets/my-work/.

  One folder per company. Drop any jpg / jpeg / png / webp / avif into a folder and
  run:

      node tools/build-work.mjs

  Images appear in filename order (prefix with 01-, 02- to control it).
  Everything between the <!-- work:start --> / <!-- work:end --> and
  <!-- studio:start --> / <!-- studio:end --> markers in index.html is
  regenerated; nothing outside them is touched. Folders with "do not use" in
  the name are ignored. No dependencies.
*/
import { readFileSync, writeFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORK_DIR = join(ROOT, 'assets', 'my-work');
const INDEX = join(ROOT, 'index.html');

/* Folder name (case-insensitive) -> project. Add a line here when a new
   company folder appears; unknown folders still render, titled by folder
   name, with no logo and no case study link. Projects that share a
   `cluster` and sit next to each other in the order are laid out in one
   tight group (the four retail brands), each keeping its own caption. */
const PROJECTS = {
  'aston martin':    { order: 1, name: 'Aston Martin',          href: 'work/aston-martin.html',      logo: 'AstonMartin',      ls: 1.45, sector: 'Luxury automotive',              scope: 'Infotainment, website, configurator, connected car app' },
  'bentley':         { order: 2, name: 'Bentley Motors',        href: 'work/bentley-motors.html',    logo: 'Bentley',          ls: 1.45, sector: 'Luxury automotive',              scope: 'Infotainment, connected car, customer and internal apps' },
  'debenhams group': { order: 3, name: 'Debenhams Group',       href: 'work/debenhams.html',         logo: 'Debenhams',        ls: 1.0,  sector: 'Multi-brand retail group',       scope: 'Design system, e-commerce, CRO', cluster: 'retail' },
  'plt':             { order: 4, name: 'PrettyLittleThing',     href: 'work/prettylittlething.html', logo: 'PrettyLittleThing',ls: 1.2,  sector: 'Celebrity and influencer fashion',scope: 'Design system, e-commerce', cluster: 'retail' },
  'boohoo':          { order: 5, name: 'boohoo',                href: 'work/boohoo.html',            logo: 'boohoo',           ls: 1.0,  sector: 'Online fast fashion',            scope: 'Design system, e-commerce', cluster: 'retail' },
  'boohooman':       { order: 6, name: 'boohooMAN',             href: 'work/boohooman.html',         logo: 'BOOHOOMAN',        ls: 0.8,  sector: 'Disruptive menswear',            scope: 'Design system, e-commerce', cluster: 'retail' },
  'coop bank':       { order: 7, name: 'The Co-operative Bank', href: 'work/co-operative-bank.html', logo: 'TheCoOpBank-long', ls: 0.9,  sector: 'Retail banking',                 scope: 'Mobile banking app' },
  'bet365':          { order: 8, name: 'bet365',                href: 'work/bet365.html',            logo: 'bet365',           ls: 1.0,  sector: 'Online gaming',                  scope: 'Web, iOS and Android' },
  'barclays':        { order: 9, name: 'Barclays',              href: 'work/barclays.html',          logo: 'Barclays',         ls: 1.05, sector: 'Retail banking',                 scope: 'Mobile banking, B-Tap' },
  'the loose lead':  { order: 1, name: 'The Loose Lead',        href: 'work/the-loose-lead-co.html', logo: null,               ls: 1.0,  sector: 'Dog walking and pet care',       scope: 'Website, booking, photography', studio: true },
};

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
/* folders skipped entirely: hidden, underscore-prefixed, or anything with
   "do not use" in the name (e.g. "Z - DO NOT USE") */
const skipFolder = d => d.startsWith('.') || d.startsWith('_') || /do not use/i.test(d);

/* Per-image zoom, matched on part of the filename: the image is scaled up
   inside its tile (edges crop) without the file itself being touched. */
const ZOOM = {
  // e.g. 'part of a filename': 1.3   (only when Jake asks; images otherwise show whole, at their own aspect)
  'Mockuuups Smartphone': 1.75,       // The Loose Lead: push in on the handset so its UI reads
};
const zoomFor = f => { for (const k in ZOOM) if (f.includes(k)) return ZOOM[k]; return 0; };

/* Re-crops an image to a different shape: `ratio` reshapes the tile and the
   image covers it, `pos` is the object-position that decides what survives.
   Use where a shot's subject is off centre or swimming in dead space, which
   a plain ZOOM cannot fix because it only ever scales about the middle. */
const CROP = {
  // The Loose Lead: the laptop sits in the top third of a very tall frame,
  // with the whole lower half empty table and floor. Crop to landscape and
  // hold the machine in the middle of it.
  'TLL Desktop': { ratio: '4 / 3', pos: '50% 22%' },
};
const cropFor = f => { for (const k in CROP) if (f.includes(k)) return CROP[k]; return null; };

/* Featured images break out of the pairing and sit alone on their own row
   at the given width (8 = centred two thirds, 12 = full width). Matched on
   part of the filename. */
const FEATURE = {
  'Mockups.png': 8,            // PLT mockup grid
  'Frame 1000004097': 12,      // Aston Martin five-screen strip
};
const featureFor = f => { for (const k in FEATURE) if (f.includes(k)) return FEATURE[k]; return 0; };

/* ---- image dimensions, read from the file header (no libraries) ---- */
function dimensions(file) {
  const fd = openSync(file, 'r');
  const buf = Buffer.alloc(64 * 1024);
  const n = readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  const b = buf.subarray(0, n);
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  // WebP
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  }
  // AVIF / HEIF: the ispe box carries width and height
  if (b.toString('ascii', 4, 8) === 'ftyp') {
    const i = b.indexOf('ispe');
    if (i > 0) return { w: b.readUInt32BE(i + 8), h: b.readUInt32BE(i + 12) };
  }
  // JPEG: walk the markers to the first SOF
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return { w: 4, h: 3 };
}

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const urlPath = p => p.split('/').map(encodeURIComponent).join('/');
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function readGroups() {
  return readdirSync(WORK_DIR)
    .filter(d => !skipFolder(d) && statSync(join(WORK_DIR, d)).isDirectory())
    .map(folder => {
      const key = folder.trim().toLowerCase();
      const p = PROJECTS[key] || { order: 99, name: folder, href: null, logo: null, ls: 1, sector: '', scope: '' };
      const images = readdirSync(join(WORK_DIR, folder))
        .filter(f => !f.startsWith('.') && IMAGE_EXT.has(extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
        .map(f => {
          const { w, h } = dimensions(join(WORK_DIR, folder, f));
          const crop = cropFor(f);
          /* a cropped image is laid out by the shape it ends up, not the
             shape the file happens to be */
          const ratio = crop ? eval(crop.ratio.replace(/\s/g, '')) : w / h;
          return { file: f, src: `assets/my-work/${urlPath(folder)}/${urlPath(f)}`, landscape: ratio > 1.15, zoom: zoomFor(f), feature: featureFor(f), crop };
        });
      return { folder, key, ...p, images };
    })
    .filter(g => g.images.length)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/* ---- layout: pair images into rows, landscape shots take the wider slot ---- */
function layout(images) {
  const out = [];
  let i = 0, rowIndex = 0;
  while (i < images.length) {
    const a = images[i];
    // a featured image takes its own row; the pairing resumes after it
    if (a.feature) { out.push({ img: a, span: a.feature, drop: false, end: false, centre: a.feature < 12 }); i += 1; rowIndex++; continue; }
    const b = images[i + 1] && !images[i + 1].feature ? images[i + 1] : null;
    i += b ? 2 : 1; rowIndex++;
    if (!b) { out.push({ img: a, span: a.landscape ? 8 : 6, drop: false, end: rowIndex % 2 === 0 }); continue; }
    let sa, sb;
    if (a.landscape && b.landscape) [sa, sb] = rowIndex % 2 ? [7, 5] : [5, 7];
    else if (a.landscape && !b.landscape) [sa, sb] = [7, 5];
    else if (!a.landscape && b.landscape) [sa, sb] = [5, 7];
    else [sa, sb] = [5, 5];                       // two portraits: centred pair
    const centred = sa === 5 && sb === 5;
    out.push({ img: a, span: sa, drop: false, end: false, start: centred ? 2 : 0 });
    out.push({ img: b, span: sb, drop: false, end: false, start: centred ? 7 : 0 });
  }
  return out;
}

/* inline custom properties for the per-image zoom and crop; the lightbox
   reads the same ones off the tile so the enlarged shot matches the thumb */
function imgStyle(img) {
  const bits = [];
  if (img.zoom) bits.push(`--zoom:${img.zoom}`);
  if (img.crop) bits.push(`--crop-ratio:${img.crop.ratio}`, `--crop-pos:${img.crop.pos}`);
  return bits.length ? ` style="${bits.join('; ')}"` : '';
}

function tile(g, t, idx, total, endAlone) {
  // ids follow the case study filename so the hero logo strip's #work-… links land here
  const base = g.href ? g.href.replace(/^.*\//, '').replace(/\.html$/, '') : slug(g.name);
  const id = idx === 0 ? `work-${base}` : `work-${base}-${idx + 1}`;
  const cls = ['col-item', `span-${t.span}`, t.start ? `c${t.start}` : '', t.centre ? 'centre' : '', t.drop ? 'drop' : '', (t.end || endAlone) ? 'end' : ''].filter(Boolean).join(' ');
  const speed = t.span <= 5 ? '1.0' : '0.55';
  const alt = `${g.name} work, image ${idx + 1} of ${total}`;
  const gate = g.href ? ` data-gated` : '';
  const href = g.href || '#';
  return `          <a class="${cls}" href="${href}" id="${id}"${gate} data-speed="${speed}">
            <div class="col-media">
              <div class="col-img${t.img.crop ? ' is-crop' : ''}"${imgStyle(t.img)}>
                <img src="${t.img.src}" alt="${esc(alt)}" loading="lazy">
              </div>
            </div>
            <div class="col-cap">${caption(g)}
            </div>
          </a>
`;
}

function caption(g) {
  const logo = g.logo
    ? `\n              <span class="col-logo" aria-hidden="true" style="--ls:${g.ls}; -webkit-mask-image:url('assets/logos/${g.logo}.svg'); mask-image:url('assets/logos/${g.logo}.svg')"></span>`
    : '';
  const meta = [g.sector, g.scope].filter(Boolean).join(' · ');
  return `${logo}
              <span class="col-name">${esc(g.name)}</span>
              <span class="col-meta">${esc(meta)}</span>`;
}

function titleCard(g) {
  const gate = g.href ? ' data-gated' : '';
  return `          <a class="col-title" href="${g.href || '#'}"${gate}>${caption(g)}
          </a>
`;
}

/* one .col-group per cluster: all its members' images laid out together,
   each project's title card (phones) placed just before its own tiles */
function group(members, groupIndex) {
  const all = members.flatMap(m => m.images.map(img => ({ ...img, owner: m })));
  const tiles = layout(all);
  const alone = all.length === 1 && groupIndex % 2 === 1;
  let out = '', owner = null, idx = 0;
  tiles.forEach(t => {
    if (t.img.owner !== owner) { owner = t.img.owner; idx = 0; out += titleCard(owner); }
    out += tile(owner, t, idx++, owner.images.length, alone);
  });
  return `        <div class="col-group">
${out}        </div>
`;
}

function clusters(groups) {
  const out = [];
  for (const g of groups) {
    const last = out[out.length - 1];
    if (g.cluster && last && last[0].cluster === g.cluster) last.push(g); else out.push([g]);
  }
  return out;
}

function replaceBetween(html, startMark, endMark, body) {
  const a = html.indexOf(startMark), b = html.indexOf(endMark);
  if (a < 0 || b < 0) throw new Error(`markers ${startMark} / ${endMark} not found in index.html`);
  return html.slice(0, a + startMark.length) + '\n' + body + '        ' + html.slice(b);
}

const groups = readGroups();
const work = groups.filter(g => !g.studio);
const studio = groups.filter(g => g.studio);
let html = readFileSync(INDEX, 'utf8');
html = replaceBetween(html, '<!-- work:start -->', '<!-- work:end -->', clusters(work).map((c, i) => group(c, i)).join(''));
html = replaceBetween(html, '<!-- studio:start -->', '<!-- studio:end -->', clusters(studio).map((c, i) => group(c, i)).join(''));
writeFileSync(INDEX, html);

for (const g of groups) console.log(`${g.studio ? 'studio' : 'work  '}  ${g.name.padEnd(22)} ${g.images.length} image${g.images.length === 1 ? '' : 's'}${PROJECTS[g.key] ? '' : '   (folder not in PROJECTS, no logo or link)'}`);
