#!/usr/bin/env node
/*
  build-work.mjs: writes two things.

  1. Home's work section (index.html, between <!-- work:start --> and
     <!-- work:end -->) from HOME below: one block per project, a header
     (logo, name, years, tags, case study link) over a collage of its
     pictures. Featured projects lay out in mixed pairs; earlier work runs
     smaller, three across at one shape. Pictures come from each case
     study's own folder under assets/images/, picked and captioned in HOME.
  2. The "Studio Work" tiles on freelance.html (the Studio page) from the
     folders in assets/my-work/ (only The Loose Lead is left there).

  One folder per company. Drop any jpg / jpeg / png / webp / avif into a folder and
  run:

      node tools/build-work.mjs

  Images appear in filename order (prefix with 01-, 02- to control it).
  Every <img> carries its pixel width and height, read from the file, so the
  tile reserves its space before the (lazy) file arrives. Without that the
  page grows as images load while you scroll, and anything measured against
  the page beforehand, the pinned studio pitch above all, lands in the wrong
  place on a phone.
  Everything between those markers is regenerated; nothing outside them is
  touched. Folders with "do not use" in
  the name are ignored. No dependencies.
*/
import { readFileSync, writeFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORK_DIR = join(ROOT, 'assets', 'my-work');
const STUDIO_PAGE = join(ROOT, 'freelance.html');
const INDEX = join(ROOT, 'index.html');

/* Home: projects in page order, laid out to match the Figma frame
   "1728w light" (JAKE-26, node 289:9296), October 2026.
   images are [path under assets/images/, hover caption, layout]; the
   caption is also the alt text after the project name. layout gives each
   picture its width on the 12 column grid (span), whether it sits against
   the right edge (end), and an optional crop ratio, so rows come out
   exactly as drawn. cta is the button label; hideName keeps the name for
   screen readers but shows only the logo. earlier: true lays a project out
   small, three across at 4:3. */
const HOME = [
  { name: 'Aston Martin', href: 'work/aston-martin.html', logo: 'AstonMartin', ls: 1.45, when: '2021 to July 2023', cta: 'View details',
    tags: ['Infotainment & HMI', 'Switchgear', 'Connected Car App', 'Design System', 'Configurator'],
    images: [
      ['case/am/db12-interior.jpg', 'DB12 · Interior HMI, digital cluster and switchgear', { span: 7 }],
      ['case/am/dbx707-instrument-cluster.jpg', 'DBX707 · Digital instrument cluster', { span: 5 }],
      ['case/am/dbx707-infotainment.jpg', 'DBX707 · Infotainment touchscreen', { span: 5 }],
      ['case/am/dbx707-drive-modes.jpg', 'DBX707 · Drive modes on the touchscreen', { span: 7 }],
      ['case/am/vantage-centre-console.jpg', 'Vantage · Centre console and infotainment', { span: 12, crop: '1624 / 811' }],
      ['case/am/app-db12-volante.jpg', 'Connected car app · DB12 Volante', { span: 7, crop: '937 / 804' }],
      ['case/am/app-phone-and-watch.webp', 'Connected car app · Phone and Apple Watch', { span: 5 }],
      ['case/am/app-store-screens.webp', 'Connected car app · App Store screens', { span: 12 }],
      ['case/am/configurator-interior.webp', 'Configurator · Interior environment', { span: 11, end: true }],
      ['case/am/configurator-exterior.webp', 'Configurator · Exterior', { span: 10 }],
    ] },
  { name: 'Bentley Motors', href: 'work/bentley-motors.html', logo: 'Bentley', ls: 1.45, when: '2018 to 2021', cta: 'View details',
    tags: ['UX Playbook / Design System', 'Connected Car App', 'Owner Apps', 'Enterprise Apps'],
    images: [
      ['case/bentley/my-bentley-app-on-seat.jpg', 'My Bentley app · Vehicle status', { span: 12 }],
      ['case/bentley/continental-gt-interior.jpg', 'Continental GT · Cabin, cluster and infotainment', { span: 12 }],
      ['case/bentley/my-bentley-app-with-key.jpg', 'My Bentley app · Connected car', { span: 12, crop: '1624 / 806' }],
      ['case/bentley/owners-app-discover.webp', 'Owners app · Discover', { span: 5, crop: '662.67 / 365.56' }],
      ['case/bentley/owners-app-news-feed.jpg', 'Owners app · News feed', { span: 7, crop: '937.33 / 365.56' }],
    ] },
  { name: 'Debenhams Group', href: 'work/debenhams.html', logo: 'DebenhamsGroup', ls: 1.45, when: 'August 2023 to present', cta: 'Learn More',
    tags: ['Multi-Brand Design System', 'App', 'Responsive Web'],
    images: [
      ['case/dg/design-system-laptop.jpg', 'Group design system · The design system site on a laptop', { span: 12 }],
      ['case/dg/design-system-component-library.jpg', 'Group design system · The component library', { span: 12 }],
      ['case/dg/boohooman-product-page-mobile.jpg', 'boohooMAN · Product page', { span: 7 }],
      ['case/dg/boohoo-listing-mobile.jpg', 'boohoo · Mobile shopping', { span: 5, crop: '662.67 / 703' }],
      ['case/dg/plt-app-screens.jpg', 'PrettyLittleThing · App screens', { span: 12 }],
      ['case/dg/plt-product-page-mobile.jpg', 'PrettyLittleThing · Product page', { span: 12, crop: '1624 / 768' }],
    ] },
  { earlier: true, hideName: true, name: 'The Co-operative Bank', href: 'work/co-operative-bank.html', logo: 'TheCoOpBank-long', ls: 0.9, when: '2017 to 2018', cta: 'Learn More',
    tags: [],
    images: [
      ['case/coop/app-accounts.jpg', 'Mobile banking app · Accounts'],
      ['case/coop/website-mobile.jpg', 'Website · Mobile'],
      ['case/coop/app-fraud-hub.png', 'Mobile banking app · Fraud and security'],
    ] },
  { earlier: true, hideName: true, name: 'bet365', href: 'work/bet365.html', logo: 'bet365', ls: 1.0, when: '2016 to 2017', cta: 'Learn More',
    tags: [],
    images: [
      ['case/bet365/campaign-bus-shelter.jpg', 'Brand campaign · Bus shelter'],
      ['case/bet365/in-play-cricket.jpg', 'App · In-play'],
      ['case/bet365/campaign-building-wrap.jpg', 'Brand campaign · Out of home'],
    ] },
  { earlier: true, hideName: true, name: 'Barclays', href: 'work/barclays.html', logo: 'Barclays', ls: 1.05, when: '2014 to 2016', cta: 'Learn More',
    tags: [],
    images: [
      ['case/barclays/mobile-banking-app.jpg', 'Barclays Mobile Banking app'],
      ['case/barclays/windows-phone-app.jpg', 'Mobile Banking for Windows Phone'],
      ['case/barclays/barclaycard-app.webp', 'Barclaycard app'],
    ] },
];

/* Folder name (case-insensitive) -> project. Add a line here when a new
   company folder appears; unknown folders still render, titled by folder
   name, with no logo and no case study link. Folders that share a project
   name are merged into that one project, in `sub` order: the four retail
   brand folders are all Debenhams Group, one project and one case study
   (asked for, September 2026).

   sector and scope are the project's full line, which is what the title
   card above a project shows on phones, so it has to cover all of its
   work. On a desktop each photo's hover caption says what that photo
   shows instead (CAPTIONS below). Wording follows Jake's CV. */
/* the Debenhams Group lockup has GROUP set small under the wordmark, so it
   runs taller (ls 1.45) to keep "Debenhams" the size the old mark was */
const DEB = { order: 3, name: 'Debenhams Group', href: 'work/debenhams.html', logo: 'DebenhamsGroup', ls: 1.45, sector: '21-brand retail group', scope: 'Multi-brand design system, e-commerce, CRO, AI features, accessibility' };
const PROJECTS = {
  'aston martin':    { order: 1, name: 'Aston Martin',          href: 'work/aston-martin.html',      logo: 'AstonMartin',      ls: 1.45, sector: 'Luxury automotive', scope: 'Infotainment and HMI, switchgear, connected car app, website, configurator' },
  'bentley':         { order: 2, name: 'Bentley Motors',        href: 'work/bentley-motors.html',    logo: 'Bentley',          ls: 1.45, sector: 'Luxury automotive', scope: 'Owner apps, design systems, infotainment and HMI concepts, enterprise apps' },
  'debenhams group': { ...DEB, sub: 1 },
  'plt':             { ...DEB, sub: 2 },
  'boohoo':          { ...DEB, sub: 3 },
  'boohooman':       { ...DEB, sub: 4 },
  'coop bank':       { order: 7, name: 'The Co-operative Bank', href: 'work/co-operative-bank.html', logo: 'TheCoOpBank-long', ls: 0.9,  sector: 'Retail banking', scope: 'Mobile banking app and website' },
  'bet365':          { order: 8, name: 'bet365',                href: 'work/bet365.html',            logo: 'bet365',           ls: 1.0,  sector: 'Online gaming', scope: 'Web, iOS and Android, brand identity' },
  'barclays':        { order: 9, name: 'Barclays',              href: 'work/barclays.html',          logo: 'Barclays',         ls: 1.05, sector: 'Retail banking', scope: 'Mobile Banking, Barclaycard and Pingit apps, Windows Phone, design language' },
  'the loose lead':  { order: 1, name: 'The Loose Lead',        href: 'work/the-loose-lead-co.html', logo: null,               ls: 1.0,  sector: 'Dog walking and pet care', scope: 'Website, booking, photography', studio: true },
};

/* Per-photo hover caption (desktop), matched on part of the filename: what
   that one photo shows. A photo not listed falls back to the project line. */
const CAPTIONS = {
  // Aston Martin
  '01-image 9':                         'Interior HMI · Infotainment, digital cluster and switchgear',
  '02-Aston-Martin-DBX707_14':          'DBX707 · Digital instrument cluster',
  '03-2025-Aston-Martin-DBX707':        'DBX707 · Central infotainment touchscreen',
  '04-Aston-Martin-DBX707_9':           'DBX707 · Infotainment touchscreen',
  '05-aston-martin-2':                  'Centre console controls and switchgear',
  '06-aston-martin-vantage':            'Vantage · Infotainment and centre console controls',
  '07-Connected-Car':                   'Connected car app · iOS and Android',
  'Frame 1000004098':                   'Connected car app · Phone and wearable',
  'Frame 1000004097':                   'Connected car app · App Store screens',
  '10-a430aa276834fc24a0f637c126f081f9':'Configurator · Exterior',
  '11-ebb7cf2659670a0d4549e7e8b95f4e15':'Configurator · Interior personalisation',
  // Bentley
  '01-image 6':                         'Infotainment and connected car',
  '02-Boodles':                         'Infotainment and digital instrument cluster',
  '03-image 3':                         'Infotainment · Navigation',
  '04-bentley-1':                       'My Bentley app · Vehicle status',
  '05-bentley-news-feed':               'Owner app · News feed',
  '06-bentley-discover':                'Owner app · Discover and recommendations',
  '07-bentley-2':                       'My Bentley app · Connected car',
  // Debenhams Group
  'debenhams-group-1':                  'Group design system · 21 brands, one system',
  'Mockups.png':                        'PrettyLittleThing · App and e-commerce screens',
  'PLT.jpeg':                           'PrettyLittleThing · Product page',
  'boohoo-1':                           'boohoo · Mobile shopping',
  'boohooman-mobile':                   'boohooMAN · Product page',
  // The Co-operative Bank
  '01-co-operative-bank-1':             'Mobile banking app',
  '02-Fraud':                           'Mobile banking app · Fraud and security',
  '03-media_13a709':                    'Website',
  // bet365
  '01-bet365-2':                        'Mobile sportsbook · Web',
  '02-bet365-3':                        'App · In-play',
  '03-bet365-5':                        'Brand identity · Campaign',
  '04-bet365-1':                        'Brand identity · Out of home',
  '05-bet365-4':                        'Brand identity · Out of home',
  // Barclays
  '01-barclays_app':                    'Barclays Mobile Banking app',
  '02-4TXuiYYMWfzB9SFpKQZSF':           'Mobile Banking for Windows Phone',
  '03-BAR-APP-002':                     'Barclays Mobile Banking app',
  '04-as3-barclaycard':                 'Barclaycard app',
  '05-app 18_05':                       'Barclaycard app',
  // The Loose Lead
  'Mockuuups Smartphone':               'Website · Mobile',
  'TLL Desktop':                        'Website · Desktop',
};
const captionFor = f => { for (const k in CAPTIONS) if (f.includes(k)) return CAPTIONS[k]; return null; };

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
  // Bentley: the top third of this one is blurred sky and windscreen above
  // the dash. Anchoring to the bottom keeps the clock, the vents and the
  // nav screen and takes the sky off the top.
  'infotainment-navigation': { ratio: '15 / 14', pos: '50% 100%' },
};
const cropFor = f => { for (const k in CROP) if (f.includes(k)) return CROP[k]; return null; };


/* Featured images break out of the pairing and sit alone on their own row
   at the given width (8 = centred two thirds, 12 = full width). Matched on
   part of the filename. */
const FEATURE = {
  'plt-app-screens': 8,        // PLT mockup grid
  'app-store-screens': 12,     // Aston Martin five-screen strip
  'brand-centre': 12,          // the design system's 21-brand wall
};
const featureFor = f => { for (const k in FEATURE) if (f.includes(k)) return FEATURE[k]; return 0; };

/* Shaped images: shots that are not a plain rectangle (the Aston Martin App
   Store sets are rounded cards with transparent gaps between them). The
   hover zoom would push their rounded corners into the tile's square edge
   and clip them, so it is off, and the hover caption's blurred band is
   masked by the image itself so it tints the cards and not the gaps.
   Matched on part of the filename. */
const SHAPED = ['app-phone-and-watch', 'app-store-screens'];
const shapedFor = f => SHAPED.some(k => f.includes(k));

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
          return { file: f, src: `assets/my-work/${urlPath(folder)}/${urlPath(f)}`, w, h, landscape: ratio > 1.15, zoom: zoomFor(f), feature: featureFor(f), crop, shaped: shapedFor(f) };
        });
      return { folder, key, ...p, images };
    })
    .filter(g => g.images.length)
    .sort((a, b) => a.order - b.order || (a.sub || 0) - (b.sub || 0) || a.name.localeCompare(b.name))
    /* folders sharing a project name become one project */
    .reduce((out, g) => {
      const last = out[out.length - 1];
      if (last && last.name === g.name) last.images = last.images.concat(g.images); else out.push(g);
      return out;
    }, []);
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

/* the hover band for a shaped shot, masked by the image. The mask is
   written inline, not passed through a custom property, because a relative
   url() inside a custom property resolves against the stylesheet (css/) in
   some browsers and the page in others; inline it always resolves against
   the page. */
function shade(src) {
  const mask = `url('${src}')`;
  return `\n              <span class="col-shade" aria-hidden="true" style="-webkit-mask-image:${mask}; mask-image:${mask}"></span>`;
}

function tile(g, t, idx, total, endAlone) {
  // ids follow the case study filename so the hero logo strip's #work-… links land here;
  // on Home the project header carries the bare id, so every tile is numbered
  const base = g.href ? g.href.replace(/^.*\//, '').replace(/\.html$/, '') : slug(g.name);
  const id = idx === 0 && !g.headed ? `work-${base}` : `work-${base}-${idx + 1}`;
  const cls = ['col-item', g.headed ? 'is-headed' : '', `span-${t.span}`, t.start ? `c${t.start}` : '', t.centre ? 'centre' : '', t.drop ? 'drop' : '', (t.end || endAlone) ? 'end' : ''].filter(Boolean).join(' ');
  const speed = t.span <= 5 ? '1.0' : '0.55';
  const cap = t.img.cap || captionFor(t.img.file);
  const alt = cap ? `${g.name}: ${cap}` : `${g.name} work, image ${idx + 1} of ${total}`;
  const gate = g.href ? ` data-gated` : '';
  const href = g.href || '#';
  return `          <a class="${cls}" href="${href}" id="${id}"${gate} data-speed="${speed}">
            <div class="col-media${t.img.shaped ? ' is-shaped' : ''}">
              <div class="col-img${t.img.crop ? ' is-crop' : ''}"${imgStyle(t.img)}>
                <img src="${t.img.src}" width="${t.img.w}" height="${t.img.h}" alt="${esc(alt)}" loading="lazy" decoding="async">
              </div>${t.img.shaped ? shade(t.img.src) : ''}
            </div>
            <div class="col-cap">${caption(g, cap)}
            </div>
          </a>
`;
}

function caption(g, line) {
  /* Home tiles sit under a project header, so their hover caption is the
     picture's own line alone: no logo, and the name stays only for the
     full-screen gallery (hidden on the tile by .is-headed) */
  const logo = g.logo && !g.headed
    ? `\n              <span class="col-logo" aria-hidden="true" style="--ls:${g.ls}; -webkit-mask-image:url('assets/logos/${g.logo}.svg'); mask-image:url('assets/logos/${g.logo}.svg')"></span>`
    : '';
  const meta = line || [g.sector, g.scope].filter(Boolean).join(' · ');
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

function replaceBetween(html, startMark, endMark, body, file) {
  const a = html.indexOf(startMark), b = html.indexOf(endMark);
  if (a < 0 || b < 0) throw new Error(`markers ${startMark} / ${endMark} not found in ${file}`);
  return html.slice(0, a + startMark.length) + '\n' + body + '        ' + html.slice(b);
}

/* ---- Home ---- */
function homeImage(p, [file, cap, lay = {}]) {
  const { w, h } = dimensions(join(ROOT, 'assets', 'images', file));
  const crop = p.earlier ? { ratio: '4 / 3', pos: '50% 50%' }
    : lay.crop ? { ratio: lay.crop, pos: '50% 50%' } : null;
  const [rw, rh] = crop ? crop.ratio.split('/').map(Number) : [w, h];
  return { file, cap, src: `assets/images/${urlPath(file)}`, w, h, landscape: rw / rh > 1.15,
    zoom: zoomFor(file), feature: 0, crop, shaped: shapedFor(file), span: lay.span, end: lay.end };
}

function projectHead(p) {
  const base = p.href.replace(/^.*\//, '').replace(/\.html$/, '');
  const mask = `url('assets/logos/${p.logo}.svg')`;
  const tags = p.tags.length ? `\n              <ul class="proj-tags">${p.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  return `          <div class="proj-head" id="work-${base}">
            <a class="proj-id" href="${p.href}" data-gated>
              <span class="proj-logo" aria-hidden="true" style="--ls:${p.ls}; -webkit-mask-image:${mask}; mask-image:${mask}"></span>
              <h4 class="proj-name${p.hideName ? ' sr-only' : ''}">${esc(p.name)}</h4>
              <span class="proj-when">${esc(p.when)}</span>
            </a>
            <div class="proj-meta">${tags}
              <a class="proj-go" href="${p.href}" data-gated>${esc(p.cta)} <i aria-hidden="true">→</i></a>
            </div>
          </div>
`;
}

function homeSection() {
  const projects = HOME.map(p => ({ ...p, headed: true, images: p.images.map(i => homeImage(p, i)) }));
  const featured = projects.filter(p => !p.earlier);
  const earlier = projects.filter(p => p.earlier);
  let out = '';
  featured.forEach(p => {
    let tiles = '';
    const rows = p.images.every(img => img.span) ? p.images.map(img => ({ img, span: img.span, end: img.end })) : layout(p.images);
    rows.forEach((t, i) => { tiles += tile(p, t, i, p.images.length, false); });
    out += `        <div class="col-group">\n${projectHead(p)}${tiles}        </div>\n`;
  });
  if (earlier.length) {
    let inner = '';
    earlier.forEach(p => {
      inner += projectHead(p);
      p.images.forEach((img, i) => { inner += tile(p, { img, span: 4 }, i, p.images.length, false); });
    });
    out += `        <div class="col-group is-earlier">\n${inner}        </div>\n`;
  }
  return out;
}

let indexHtml = readFileSync(INDEX, 'utf8');
indexHtml = replaceBetween(indexHtml, '<!-- work:start -->', '<!-- work:end -->', homeSection(), 'index.html');
writeFileSync(INDEX, indexHtml);
for (const p of HOME) console.log(`home    ${p.name.padEnd(22)} ${p.images.length} images`);

/* ---- Studio ---- */
const groups = readGroups();
const studio = groups.filter(g => g.studio);
let studioHtml = readFileSync(STUDIO_PAGE, 'utf8');
studioHtml = replaceBetween(studioHtml, '<!-- studio:start -->', '<!-- studio:end -->', clusters(studio).map((c, i) => group(c, i)).join(''), 'freelance.html');
writeFileSync(STUDIO_PAGE, studioHtml);

for (const g of studio) console.log(`studio  ${g.name.padEnd(22)} ${g.images.length} image${g.images.length === 1 ? '' : 's'}${PROJECTS[g.key] ? '' : '   (folder not in PROJECTS, no logo or link)'}`);
