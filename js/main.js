/* Shared site JS for every page.
   Sections: theme system (day / night / colour + shuffle), custom cursor,
   hero dot field that reacts to the cursor, magnetic hovers, hide-on-scroll
   header, mobile menu overlay, GSAP ScrollTrigger animations. Scrolling
   itself is the browser's own: nothing eases or intercepts the wheel.
   All motion respects prefers-reduced-motion, and every feature degrades
   safely if a CDN script fails to load. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST = typeof window.ScrollTrigger !== 'undefined';

  if (hasGsap && hasST) {
    gsap.registerPlugin(ScrollTrigger);
    /* A phone's address bar sliding in and out fires resize. Left alone,
       ScrollTrigger treats each one as a real resize and refreshes every
       trigger mid-scroll, which recomputes and re-pins the studio pitch
       under your thumb: that is the jump. Ignore those; a rotate still
       refreshes because the width changes. */
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* ---------- 1. Theme system ----------
     Day and night are off-white / off-black mono themes. Colour picks a
     random curated palette, contrast checked. While colour mode is active a
     shuffle button appears next to the toggle to re-roll the palette. */

  var MONO = {
    /* Day lightened from cream (#f1ede4 / #e8e2d4) in the August 2026 Figma
       review: near-white bg, cream held in bg2 only. */
    day:   { mode: 'day',   name: 'Day',   bg: '#fcfbf7', bg2: '#fffaee', ink: '#1b1a16', accent: '#1b1a16', accentInk: '#f1ede4' },
    /* night is deliberately neutral: solid slightly-off black and slightly-off
       white, no cream tint. The warm version read as a third colour theme. */
    night: { mode: 'night', name: 'Night', bg: '#0b0b0c', bg2: '#141416', ink: '#f6f6f7', accent: '#f6f6f7', accentInk: '#0b0b0c' }
  };

  /* Jake's ColorHunt palettes, deliberately restrained: the page stays black
     and white, the palette hue only lives in the accent, with a whisper of it
     in the background and the ink. Backgrounds are near-black, ink is
     near-white.

     Accents are strong reds, oranges, yellow, greens, teal and blues, and
     nothing else. Purple, violet, magenta and pink are out on request, as are
     accents so desaturated they read as grey, and palettes whose accents were
     near-identical once strengthened (they were the same theme to look at).
     Everything left is pushed to a minimum saturation so each one reads as a
     real colour rather than a muted tint, and lifted until it clears 3.5:1 on
     its own background, because the accent carries small type.

     Source of truth: THEMES/palettes.json (keeps each colorhunt.co URL).
     Every value here is derived from it, so regenerate rather than
     hand-editing. See README section 7. */
  /* The live set matches the "Colour themes" sheet in the JAKE 26 Figma
     file, which is where Jake tunes it. August 2026: Slate Clay, Indigo
     Teal, Navy Taupe, Cobalt Amber, Orange Violet, Steel Sand, Ocean Wheat
     and Violet Flame were cut, and five accents were hand-tuned in Figma.
     All of it is recorded in palettes.json (excluded flags,
     accent_override), so regenerate from there, not from the original
     ColorHunt values.

     Colour mode keeps the page strictly black and white on request (the
     per-palette tinted backgrounds and inks read as "too much shading"):
     every palette uses Night's bg, bg2 and ink, and only the accent and its
     ink change, so the hue lands on accent elements and nothing else.

     Every accent is WCAG AA, 4.5:1 on the fixed #0b0b0c (they carry small
     type), and accentInk clears 4.5:1 on the accent. That is why Electric
     Navy and Navy Scarlet run black accentInk: on a near-black background
     no blue or red can clear 4.5:1 against the bg and under white text at
     the same time, the two constraints leave no gap.

     `hue` groups palettes by colour family for the roll below: a shuffle
     never lands on the family it is leaving. */
  /* accent2 is each accent's lighter companion, the far stop of the
     gradient the accent surfaces paint with. Always lighter than the
     accent, so the AA contrast floor (held by the accent itself) is the
     gradient's worst case. */
  var PALETTES = [
    { name: 'Sage Forest',   hue: 'green',  accent: '#22eb4a', accent2: '#7dffa8', accentInk: '#000000' },
    { name: 'Electric Navy', hue: 'blue',   accent: '#456cff', accent2: '#7fa4ff', accentInk: '#000000' },
    { name: 'Navy Scarlet',  hue: 'red',    accent: '#e2353c', accent2: '#ff7a5c', accentInk: '#000000' },
    { name: 'Olive Cream',   hue: 'green',  accent: '#8cd341', accent2: '#d9f26b', accentInk: '#000000' },
    { name: 'Maroon Sea',    hue: 'teal',   accent: '#2ec2b4', accent2: '#7de8d8', accentInk: '#000000' },
    { name: 'Plum Gold',     hue: 'orange', accent: '#ff8000', accent2: '#ffc14d', accentInk: '#000000' },
    { name: 'Ultra Gold',    hue: 'yellow', accent: '#ffcc00', accent2: '#ffe97a', accentInk: '#000000' },
    { name: 'Deep Forest',   hue: 'green',  accent: '#07a53c', accent2: '#4ed97a', accentInk: '#000000' }
  ];

  var STORE_KEY = 'jr-theme';
  var currentTheme = MONO.night;
  var themeListeners = [];

  /* ---------- 1a. Display face ----------
     The display face drives --display and --display-weight, which both the
     header wordmark and the hero name read, so the logo top left always
     matches the hero. Stored with the theme so navigating keeps the face.

     Day and night always use the default face. The face only ever changes
     when the shuffle button is tapped, which is why every entry carries a
     `kind`: a shuffle must land on a different kind than the one showing, so
     you never get a serif following a serif or a script following a script.
     Anything added here needs a kind; a kind with only one member is fine,
     the pool a shuffle draws from is just "every kind but the current one",
     which only breaks if the whole array collapsed to a single kind.

     Every candidate here passed the same real-page gate before being added:
     loaded as --display on the actual hero and wordmark at 1440 and 390,
     checked for overflow and for the h1's height staying locked, not just
     judged by a width ratio in isolation. Rejected on that basis: Rubik Mono
     One and Syne (both set "Hi, I'm Jake" 1.4x+ wider than Literata and
     overflowed), Sekuya (1.7x, same problem). Rejected on sight: Bitcount
     Prop Single (renders as a barely-legible dot grid at body weight), and
     Questrial, Jura and LINE Seed JP, which all read as plain body text next
     to Satoshi, defeating the point of a face swap that is supposed to look
     like a different font. */
  /* `scale` balances optical size against Literata (the default), because
     different typefaces at the same declared font-size render at very
     different apparent sizes: measured by capital-letter height at a fixed
     300px reference size, the spread across the original pool ran from 26%
     below Literata (Courier Prime, since cut) to 15% above (Anton, since
     cut). Left uncorrected, that reads as the hero jumping in size on every
     shuffle even though its box never moves. `scale` is 55% of the way to a
     full cap-height match, not the full correction: matching exactly would
     also scale width by the same amount, and some faces are already close to
     the width ceiling the hero can hold before wrapping, so a full match
     would trade a size jump for an overflow risk. Regenerate by measuring
     `ctx.measureText('J').actualBoundingBoxAscent` at a shared font-size
     against Literata's, not by hand. */
  /* Anton, Pacifico, Luckiest Guy, Bebas Neue and Courier Prime were cut on
     request in August 2026, then Prata, then Kaushan Script (the only
     script face) in September 2026, taking the pool from 16 to 9.

     `kind` is the broad style class the adjacency rule runs on: serif, sans
     or script. It was re-tagged from eight fine-grained kinds (display, geo
     and friends) in August 2026 because two chunky sans-like faces could
     still land back to back under the fine-grained rule, and Jake asked for
     similar styles never to sit next to each other. */
  var FACES = [
    { css: "'Literata', Georgia, 'Times New Roman', serif", weight: 500, kind: 'serif',  scale: 1.000 },
    { css: "'Playfair Display', Georgia, serif",            weight: 700, kind: 'serif',  scale: 1.017 },
    { css: "'Archivo Black', Impact, sans-serif",           weight: 400, kind: 'sans',   scale: 1.034 },
    { css: "'Bungee', Impact, sans-serif",                  weight: 400, kind: 'sans',   scale: 1.008 },
    { css: "'Righteous', 'Trebuchet MS', sans-serif",       weight: 400, kind: 'sans',   scale: 1.024 },
    { css: "'Bowlby One', Impact, sans-serif",              weight: 400, kind: 'sans',   scale: 0.994 },
    { css: "'Cormorant Garamond', Georgia, serif",          weight: 600, kind: 'serif',  scale: 1.092 },
    { css: "'Kanit', sans-serif",                           weight: 700, kind: 'sans',   scale: 1.074 },
    { css: "'Lexend Deca', sans-serif",                     weight: 600, kind: 'sans',   scale: 1.024 }
  ];
  var DEFAULT_FACE = FACES[0];
  /* the hero's brand dot sits after the name, so a face that sets "Jake" wider
     or narrower shunts it sideways. Fade it with the name and the jump happens
     while it is invisible. The wordmark's dot is a child of .mark already. */
  var faceEls = document.querySelectorAll('.mark, #heroName, .hero h1 .dot');
  var faceTl = null;
  var fontsReady = false;

  /* the face currently showing, looked up from the theme rather than tracked
     separately so a face restored from localStorage still knows its kind */
  function currentFace() {
    for (var i = 0; i < FACES.length; i++) {
      if (FACES[i].css === currentTheme.face) return FACES[i];
    }
    return DEFAULT_FACE;
  }

  /* Shuffle bag: a fresh random order of every face, drawn down to nothing
     before it reshuffles, so a shuffle click cycles through the whole set
     once (in a new random order each page load) rather than sampling with
     replacement, which could otherwise repeat a face after just two or three
     clicks. Reshuffled with Fisher-Yates so every order is equally likely. */
  var faceBag = [];

  function refillBag(justShownIdx) {
    faceBag = [];
    for (var i = 0; i < FACES.length; i++) faceBag.push(i);
    for (var i = faceBag.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = faceBag[i]; faceBag[i] = faceBag[j]; faceBag[j] = t;
    }
    /* without this, the last face of one cycle could land first in the next
       cycle, showing the same face twice in a row right at the seam */
    if (justShownIdx != null && faceBag[0] === justShownIdx && faceBag.length > 1) {
      var k = 1 + Math.floor(Math.random() * (faceBag.length - 1));
      var t2 = faceBag[0]; faceBag[0] = faceBag[k]; faceBag[k] = t2;
    }
  }

  function nextFace() {
    var current = currentFace();
    var curIdx = FACES.indexOf(current);
    if (!faceBag.length) refillBag(curIdx);
    /* take the first queued face whose style class differs from the one
       showing (a serif never follows a serif, a sans never follows a sans),
       wherever it sits in the shuffle. If everything left in the bag is the
       class currently showing, reshuffle early instead of ever pairing two
       of the same class: the alternation rule outranks the strict one-pass
       cycle at bag seams. The refilled bag always contains other classes,
       so the second scan cannot miss. */
    var pick = -1;
    for (var i = 0; i < faceBag.length; i++) {
      if (FACES[faceBag[i]].kind !== current.kind) { pick = i; break; }
    }
    if (pick === -1) {
      refillBag(curIdx);
      for (var j = 0; j < faceBag.length; j++) {
        if (FACES[faceBag[j]].kind !== current.kind) { pick = j; break; }
      }
    }
    var idx = faceBag.splice(pick, 1)[0];
    return FACES[idx];
  }

  /* set by the shuffle button just before it rolls, consumed by the next
     setFace: only a shuffle plays the hero typewriter, day and night keep
     the quiet fade */
  var typeNextSwap = false;

  function setFace(face, weight, scale) {
    if (!face) return;
    var apply = function () {
      var root = document.documentElement.style;
      root.setProperty('--display', face);
      root.setProperty('--display-weight', String(weight));
      root.setProperty('--display-scale', String(scale || 1));
    };
    var wantsType = typeNextSwap;
    typeNextSwap = false;
    if (!fontsReady || !hasGsap || reduceMotion || !faceEls.length) { apply(); return; }

    /* Faces download on first use, so hold the swap until the family is in
       the cache. Without this the fade-in lands on the fallback and then
       jumps to the real font a moment later. The hold happens while the text
       is already faded out, and it is capped so a slow network cannot stall
       the swap. Only the latin glyphs we actually show are requested. */
    var family = face.split(',')[0];
    var ready = false;
    try { ready = document.fonts.check(weight + ' 1em ' + family, 'Jake Rayner'); } catch (e) { ready = true; }
    var release = function () {
      ready = true;
      if (faceTl && faceTl.paused()) faceTl.play();
    };
    if (!ready) {
      try { document.fonts.load(weight + ' 1em ' + family, 'Jake Rayner').then(release, release); } catch (e) { release(); }
      setTimeout(release, 900);
    }

    if (faceTl) faceTl.kill();

    /* Shuffle taps on the home hero get the typewriter: backspace the dot
       and the name character by character, swap the face while the word is
       empty, type it back out in the new face, then drop the square full
       stop on at the end. The wordmark keeps its quiet fade alongside. The
       fixed-height trim-centred h1 means the emptying word never moves the
       layout, and the dot is the only thing transformed (it is inline-block
       already; #heroName itself must never get a transform, see README). */
    var heroName = document.getElementById('heroName');
    var heroDot = document.querySelector('.hero h1 .dot');
    if (wantsType && heroName) {
      var markEls = document.querySelectorAll('.mark');
      var full = heroName.getAttribute('data-name') || heroName.textContent;
      heroName.setAttribute('data-name', full);
      heroName.textContent = full;   /* normalise after a killed mid-word run */
      gsap.set(markEls, { opacity: 1 });
      if (heroDot) gsap.set(heroDot, { opacity: 1, y: 0 });
      var tl = gsap.timeline();
      faceTl = tl;
      tl.to(markEls, { opacity: 0, duration: 0.26, ease: 'power2.inOut' }, 0);
      if (heroDot) tl.set(heroDot, { opacity: 0 }, 0.06);
      var n;
      var DEL = 0.055, TYPE = 0.085;
      for (n = full.length - 1; n >= 0; n--) {
        (function (keep) {
          tl.call(function () { heroName.textContent = full.slice(0, keep); }, null,
            0.12 + (full.length - keep) * DEL);
        })(n);
      }
      var deleteEnd = 0.12 + full.length * DEL;
      tl.call(function () { if (!ready) tl.pause(); }, null, deleteEnd);
      tl.call(apply, null, deleteEnd + 0.001);
      for (n = 1; n <= full.length; n++) {
        (function (upto) {
          tl.call(function () { heroName.textContent = full.slice(0, upto); }, null,
            deleteEnd + 0.16 + upto * TYPE);
        })(n);
      }
      var typeEnd = deleteEnd + 0.16 + full.length * TYPE;
      if (heroDot) {
        /* dropped from higher and given longer in the air, so the bounces
           actually read instead of finishing in one dab */
        tl.fromTo(heroDot, { opacity: 1, y: '-0.85em' }, { y: 0, duration: 0.6, ease: 'bounce.out', immediateRender: false }, typeEnd + 0.1);
      }
      tl.to(markEls, { opacity: 1, duration: 0.4, ease: 'power2.out' }, deleteEnd + 0.16);
      return;
    }

    if (heroDot) gsap.set(heroDot, { y: 0 });
    gsap.set(faceEls, { opacity: 1 });
    /* Opacity only, on purpose, and nothing else will do:
       - a transform would need an inline-block on the hero name, and that lets
         each font's metrics push the line box around
       - a filter (this used to blur) is worse: a filter on an inline box with
         line-height:0 gives Chrome a degenerate region to clip the effect to,
         so the blur halo was cut off with a hard flat edge under the glyphs,
         and promoting and dropping the layer popped on every swap
       Opacity has no clip region and no layer churn, so it is bulletproof
       whatever the face does. See README section 11. */
    faceTl = gsap.timeline()
      .to(faceEls, { opacity: 0, duration: 0.26, ease: 'power2.inOut' })
      .call(function () { if (!ready) faceTl.pause(); })
      .add(apply)
      .to(faceEls, { opacity: 1, duration: 0.5, ease: 'power2.out' });
  }

  /* wait for the display faces so the first animated swap lands on a loaded
     font rather than a fallback that then reflows */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { fontsReady = true; });
  } else {
    fontsReady = true;
  }

  /* Keeps <meta name="theme-color"> on the current background, so the
     browser tints its own chrome to match instead of painting a band of
     its own colour behind the toolbar. --bg can be a color-mix (colour
     mode tints it), which the meta will not take, so resolve it to an rgb
     through a throwaway element rather than passing the raw value. */
  function syncThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta || !document.body) return;
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;background:var(--bg)';
    document.body.appendChild(probe);
    var colour = getComputedStyle(probe).backgroundColor;
    probe.parentNode.removeChild(probe);
    if (!colour) return;
    /* a color-mix resolves to color(srgb ...), which the meta will not take,
       so put it through a canvas and read plain channel values back out */
    if (colour.indexOf('rgb') !== 0) {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 1;
        var cx = c.getContext('2d');
        cx.fillStyle = colour; cx.fillRect(0, 0, 1, 1);
        var d = cx.getImageData(0, 0, 1, 1).data;
        colour = 'rgb(' + d[0] + ', ' + d[1] + ', ' + d[2] + ')';
      } catch (e) { return; }
    }
    meta.setAttribute('content', colour);
  }

  var themeColorTimer;
  function applyTheme(t) {
    var root = document.documentElement.style;
    setFace(t.face, t.faceWeight, t.faceScale);
    root.setProperty('--bg', t.bg);
    root.setProperty('--bg2', t.bg2);
    root.setProperty('--ink', t.ink);
    root.setProperty('--accent', t.accent);
    root.setProperty('--accent-2', t.accent2 || t.accent);
    root.setProperty('--accent-ink', t.accentInk);
    root.setProperty('--line', 'color-mix(in srgb, ' + t.ink + ' 14%, transparent)');
    root.setProperty('--ink-dim', 'color-mix(in srgb, ' + t.ink + ' 62%, transparent)');
    syncThemeColor();
    /* the colours fade over .9s (see @property in the CSS), so the browser
       chrome tint is re-read once they have landed */
    clearTimeout(themeColorTimer);
    themeColorTimer = setTimeout(syncThemeColor, 950);
    currentTheme = t;
    for (var i = 0; i < themeListeners.length; i++) themeListeners[i]();
  }

  /* Colour mode is never remembered: the site always opens in black and
     white. A colour theme is stored as night with the same face, so the
     type survives but the palette does not. */
  function storeTheme(t) {
    if (t.mode === 'colour') {
      var n = {}, k;
      for (k in MONO.night) n[k] = MONO.night[k];
      n.face = t.face; n.faceWeight = t.faceWeight; n.faceScale = t.faceScale;
      t = n;
    }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(t)); } catch (e) {}
  }

  var ttDay = document.getElementById('ttDay');
  var ttNight = document.getElementById('ttNight');
  var ttColour = document.getElementById('ttColour');
  var ttRand = document.getElementById('ttRand');
  var toggleWrap = document.querySelector('.theme-toggle');

  function setPressed(mode) {
    if (ttDay) ttDay.setAttribute('aria-pressed', String(mode === 'day'));
    if (ttNight) ttNight.setAttribute('aria-pressed', String(mode === 'night'));
    if (ttColour) ttColour.setAttribute('aria-pressed', String(mode === 'colour'));
    if (toggleWrap) toggleWrap.classList.toggle('colour-on', mode === 'colour');
    /* the shuffle button stays in the DOM so it can slide open, so keep it
       out of the tab order and the accessibility tree while it is closed */
    if (ttRand) {
      ttRand.setAttribute('aria-hidden', String(mode !== 'colour'));
      ttRand.tabIndex = mode === 'colour' ? 0 : -1;
    }
  }

  /* the shared MONO objects are cloned so they never keep a face of their own */
  function setTheme(base, face, mode) {
    var t = {}, k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) t[k] = base[k];
    t.face = face.css;
    t.faceWeight = face.weight;
    t.faceScale = face.scale;
    applyTheme(t); storeTheme(t); setPressed(mode || base.mode);
  }

  /* Colour mode rolls a palette. It only rolls a new face when asked to,
     which is the shuffle button: day, night and entering colour mode all
     leave the face alone, so the type never changes under you unless you
     tapped the icon that changes it. */
  /* the hue of the theme currently showing, looked up by name so a theme
     restored from localStorage (which may predate hue being stored) still
     resolves. Monos return null: any first colour pick is allowed. */
  function currentHue() {
    if (currentTheme.hue) return currentTheme.hue;
    for (var i = 0; i < PALETTES.length; i++) {
      if (PALETTES[i].name === currentTheme.name) return PALETTES[i].hue;
    }
    return null;
  }

  function tint(base, accent, pct) {
    return 'color-mix(in srgb, ' + accent + ' ' + pct + '%, ' + base + ')';
  }

  function rollPalette(newFace) {
    try { localStorage.setItem('jr-colour-tried', '1'); } catch (e) {}
    /* never the same palette twice in a row, and never the same hue family
       twice in a row either: a green following a green reads as "nothing
       changed". Safe to loop on, no family covers the whole set. */
    var fromHue = currentHue();
    var pick = currentTheme;
    while (pick.name === currentTheme.name || (fromHue !== null && pick.hue === fromHue)) {
      pick = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    }
    setTheme(
      { mode: 'colour', name: pick.name, hue: pick.hue,
        /* Colour mode is night's black and white everywhere else, which left
           it reading as plain night mode with a coloured button. The two
           background stops now carry a whisper of the accent, under a tenth
           of it, so the page is still black, just not neutral black. Mixed
           into the stored theme rather than layered on in CSS so the head
           snippet paints it too, with no flash of untinted black on load. */
        bg: tint(MONO.night.bg, pick.accent, 6),
        bg2: tint(MONO.night.bg2, pick.accent, 9),
        ink: MONO.night.ink, accent: pick.accent, accent2: pick.accent2, accentInk: pick.accentInk },
      newFace ? nextFace() : currentFace()
    );
  }

  /* a head snippet on each page re-applies the saved theme before paint,
     here we sync internal state and the toggle. First visit is night mode in
     the default face; colour is a click away. */
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && saved.mode === 'colour') {
      /* a colour theme saved before colour stopped being remembered */
      var face = FACES.filter(function (f) { return f.css === saved.face; })[0] || DEFAULT_FACE;
      setTheme(MONO.night, face);
    } else if (saved && saved.mode && FACES.some(function (f) { return f.css === saved.face; })) {
      currentTheme = saved;
      setPressed(saved.mode);
    } else if (saved && saved.mode) {
      /* saved in a face that has since been cut from the pool (Kaushan
         Script): its font no longer loads, so the name would fall back to
         the system's cursive. Keep the mode, reset the face. */
      setTheme(saved, DEFAULT_FACE, saved.mode);
    } else {
      setTheme(MONO.night, DEFAULT_FACE);
    }
  } catch (e) { setTheme(MONO.night, DEFAULT_FACE); }

  if (ttDay) ttDay.addEventListener('click', function () { setTheme(MONO.day, DEFAULT_FACE); });
  if (ttNight) ttNight.addEventListener('click', function () { setTheme(MONO.night, DEFAULT_FACE); });
  if (ttColour) ttColour.addEventListener('click', function () { rollPalette(false); });
  if (ttRand) ttRand.addEventListener('click', function () { typeNextSwap = true; rollPalette(true); });

  /* the shuffle (re-roll) icon does one clean spin on every tap (see ttSpin
     in the CSS). Removing and re-adding the class with a forced reflow in
     between lets a tap mid-spin restart the animation cleanly instead of
     being ignored. */
  var ttRandSvg = ttRand ? ttRand.querySelector('svg') : null;
  if (ttRandSvg && !reduceMotion) {
    ttRand.addEventListener('click', function () {
      ttRandSvg.classList.remove('tt-flip');
      void ttRandSvg.getBoundingClientRect();
      ttRandSvg.classList.add('tt-flip');
    });
    ttRandSvg.addEventListener('animationend', function () {
      ttRandSvg.classList.remove('tt-flip');
    });
  }

  /* ---------- 1b. Case study password veil ----------
     The four group-brand case pages are encrypted in production (tools/
     protect-work.mjs). Clicking a gated tile on Home always opens a
     full-screen blur veil with a centred password box, in local dev too:
     the password is checked against assets/gate-check.json, a small
     verifier encrypted with the same key derivation as the pages, so the
     prompt works even where the pages themselves are not encrypted. A
     correct password is kept for the session so every protected study
     opens straight through. Direct links to a protected page hit the
     standalone gate that protect-work.mjs builds, this veil is the front
     door. */
  /* set by caseGate below, called by the gallery's View project button and
     by the title cards. Null where the browser has no WebCrypto, in which
     case openCase just follows the link. */
  var requestCase = null;

  /* The case study password. Off for now (September 2026) so the case
     studies can be built and checked without unlocking each time; the gate
     code below is untouched. To turn it back on: set this to true and
     encrypt the pages again with tools/protect-work.mjs (see its header). */
  var CASE_GATE = false;

  function openCase(url) {
    if (!url) return;
    if (requestCase) requestCase(url); else location.href = url;
  }

  (function caseGate() {
    var titles = document.querySelectorAll('.col-title[data-gated]');
    var gated = document.querySelectorAll('[data-gated]');
    if (!CASE_GATE || !gated.length || !window.crypto || !crypto.subtle || !window.fetch) return;

    var veil = null, input = null, err = null, button = null;
    var pendingUrl = null, pendingPayload = null;
    var verifierPromise = null;

    function bytes(b64) {
      var s = atob(b64), a = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
      return a;
    }

    function fetchVerifier() {
      if (!verifierPromise) {
        verifierPromise = fetch('assets/gate-check.json')
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; });
      }
      return verifierPromise;
    }

    function canDecrypt(pass, payload) {
      return crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
        .then(function (baseKey) {
          return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: bytes(payload.salt), iterations: 310000, hash: 'SHA-256' },
            baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        })
        .then(function (key) {
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(payload.iv) }, key, bytes(payload.data));
        })
        .then(function () { return true; }, function () { return false; });
    }

    function closeVeil() {
      if (veil) veil.classList.remove('open');
      pendingUrl = null; pendingPayload = null;
    }

    function buildVeil() {
      veil = document.createElement('div');
      veil.className = 'gate-veil';
      veil.setAttribute('role', 'dialog');
      veil.setAttribute('aria-modal', 'true');
      veil.setAttribute('aria-label', 'Password required');
      veil.innerHTML =
        '<form class="gate-veil-box">' +
          '<h2>Protected</h2>' +
          '<p>This case study covers work I can\'t publish openly. Get in touch and I\'ll share the password.</p>' +
          '<div class="gate-veil-row">' +
            '<input type="password" placeholder="Password" aria-label="Password" autocomplete="current-password">' +
            '<button type="submit">Unlock</button>' +
          '</div>' +
          '<p class="gate-veil-err" hidden>That password isn\'t right, try again.</p>' +
          '<p class="gate-veil-req"><a href="mailto:jake.rayner.96@gmail.com">Request access →</a></p>' +
        '</form>' +
        '<button class="gate-veil-close" type="button" aria-label="Close">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>' +
        '</button>';
      document.body.appendChild(veil);
      input = veil.querySelector('input');
      err = veil.querySelector('.gate-veil-err');
      button = veil.querySelector('button');
      veil.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        if (!pendingPayload) return;
        var pass = input.value;
        button.disabled = true;
        canDecrypt(pass, pendingPayload).then(function (ok) {
          button.disabled = false;
          if (ok) {
            try { sessionStorage.setItem('jr-case-pass', pass); } catch (e2) {}
            location.href = pendingUrl;
          } else {
            err.hidden = false;
            input.select();
          }
        });
      });
      veil.querySelector('.gate-veil-close').addEventListener('click', closeVeil);
      veil.addEventListener('click', function (e) { if (e.target === veil) closeVeil(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeVeil(); });
    }

    function openVeil(url, payload) {
      if (!veil) buildVeil();
      pendingUrl = url; pendingPayload = payload;
      err.hidden = true; input.value = '';
      veil.classList.add('open');
      setTimeout(function () { input.focus(); }, 60);
    }

    requestCase = function (url) {
      fetchVerifier().then(function (verifier) {
        /* no verifier at all: fail open rather than dead-ending the link */
        if (!verifier) { location.href = url; return; }
        var saved = null;
        try { saved = sessionStorage.getItem('jr-case-pass'); } catch (e2) {}
        if (saved) {
          canDecrypt(saved, verifier).then(function (ok) {
            if (ok) { location.href = url; } else { openVeil(url, verifier); }
          });
        } else {
          openVeil(url, verifier);
        }
      });
    };

    /* The title card above a project on phones still goes straight to the
       case study. The photo tiles no longer do: tapping one opens the
       gallery, and the View project button in there is what asks for the
       password. That wiring lives in the gallery below. */
    Array.prototype.forEach.call(titles, function (tile) {
      tile.addEventListener('click', function (e) {
        e.preventDefault();
        requestCase(tile.getAttribute('href') || tile.getAttribute('data-href'));
      });
    });
  })();

  /* ---------- 1b2. Tile loading state ----------
     Each tile shimmers over its background colour until its image lands
     (css: .col-img::before). Images already in cache are complete before
     this runs, so check that first rather than waiting on a load event
     that has already fired. */
  Array.prototype.forEach.call(document.querySelectorAll('.col-img'), function (box) {
    var img = box.querySelector('img');
    if (!img) { box.classList.add('is-loaded'); return; }
    var done = function () { box.classList.add('is-loaded'); };
    if (img.complete && img.naturalWidth) done();
    else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
  });

  /* ---------- 1c. Work gallery ----------
     Tapping a work photo opens it full screen. Swipe or arrow through every
     photo on the page, not just the project tapped: the last shot of one
     project runs on into the first of the next, and the end wraps back to
     the start, so the whole body of work can be flicked through in one go
     (asked for explicitly). The project's logo and its one line of caption
     sit at the bottom next to a View project button, and both follow the
     shot showing. The tiles stay real links, so with no JS a tap still goes
     to the case study. */
  (function workGallery() {
    var tiles = Array.prototype.slice.call(document.querySelectorAll('.col-item'));
    if (!tiles.length) return;

    var lb, track, foot, capEl, logoEl, nameEl, metaEl, goBtn, prevBtn, nextBtn;
    var shots = tiles, index = 0, url = null, lastFocus = null, slidesBuilt = false;
    function tileUrl(tile) { return tile.getAttribute('href') || tile.getAttribute('data-href') || '#'; }

    function build() {
      lb = document.createElement('div');
      lb.className = 'lb';
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.setAttribute('aria-label', 'Project images');
      lb.innerHTML =
        '<button class="lb-x" type="button" aria-label="Close gallery">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>' +
        '</button>' +
        /* the stage holds the track and the arrows, so the arrows centre on
           the photo (which is centred in the stage) and not on the whole
           overlay, footer included */
        '<div class="lb-stage">' +
          '<div class="lb-track" tabindex="-1"></div>' +
          '<button class="lb-nav lb-prev" type="button" aria-label="Previous image">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg>' +
          '</button>' +
          '<button class="lb-nav lb-next" type="button" aria-label="Next image">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="lb-foot">' +
          '<div class="lb-cap">' +
            '<span class="lb-logo" aria-hidden="true"></span>' +
            '<span class="lb-name"></span>' +
            '<span class="lb-meta"></span>' +
          '</div>' +
          '<button class="lb-go" type="button">View project</button>' +
        '</div>';
      document.body.appendChild(lb);
      track = lb.querySelector('.lb-track');
      foot = lb.querySelector('.lb-foot');
      capEl = lb.querySelector('.lb-cap');
      logoEl = lb.querySelector('.lb-logo');
      nameEl = lb.querySelector('.lb-name');
      metaEl = lb.querySelector('.lb-meta');
      goBtn = lb.querySelector('.lb-go');
      prevBtn = lb.querySelector('.lb-prev');
      nextBtn = lb.querySelector('.lb-next');

      lb.querySelector('.lb-x').addEventListener('click', close);
      prevBtn.addEventListener('click', function () { go(index - 1); });
      nextBtn.addEventListener('click', function () { go(index + 1); });
      goBtn.addEventListener('click', function () { openCase(url); });
      /* a tap on the backdrop, but not on a photo or a control, closes */
      lb.addEventListener('click', function (e) {
        if (e.target === lb || e.target === track || e.target.classList.contains('lb-stage') || e.target.classList.contains('lb-slide')) close();
      });
      /* The track is moved by transform and the drag is driven here, rather
         than being a native scroll-snap carousel. Native scrolling looked
         right on a desktop but would not page on a phone (the smooth scroll
         library the site used then swallowed touchmove while the page was
         locked), and owning the drag outright also settles iOS's own habits
         inside a fixed overlay. touch-action:pan-y (css)
         leaves vertical gestures to the browser and hands us the rest.

         A drag anywhere in the overlay pages, footer and arrows included,
         so there is nowhere in it where a swipe does nothing. */
      var dragX = 0, dragY = 0, dragAt = 0, dragging = false, decided = false, horizontal = false;

      function place(px, animate) {
        track.style.transition = animate ? 'transform .42s cubic-bezier(.22,.75,.2,1)' : 'none';
        track.style.transform = 'translate3d(' + px + 'px,0,0)';
      }
      function rest() { return -index * track.clientWidth; }

      lb.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1 || shots.length < 2) { dragging = false; return; }
        dragging = true; decided = false; horizontal = false;
        dragX = e.touches[0].clientX; dragY = e.touches[0].clientY;
        dragAt = rest();
      }, { passive: true });

      lb.addEventListener('touchmove', function (e) {
        if (!dragging || e.touches.length !== 1) return;
        var dx = e.touches[0].clientX - dragX;
        var dy = e.touches[0].clientY - dragY;
        if (!decided) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          decided = true;
          horizontal = Math.abs(dx) > Math.abs(dy);
          if (!horizontal) { dragging = false; return; }
        }
        /* the gesture is ours now: stop the page or a parent taking it */
        if (e.cancelable) e.preventDefault();
        /* resist at the two ends (there is no neighbouring slide to drag
           into there); letting go past a fifth still wraps round */
        if ((index === 0 && dx > 0) || (index === shots.length - 1 && dx < 0)) dx *= 0.32;
        place(dragAt + dx, false);
      }, { passive: false });

      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        if (!horizontal || !e.changedTouches || !e.changedTouches.length) { place(rest(), true); return; }
        var dx = e.changedTouches[0].clientX - dragX;
        /* a fifth of the width takes you to the next one */
        if (Math.abs(dx) > track.clientWidth * 0.2) go(index + (dx < 0 ? 1 : -1));
        else place(rest(), true);
      }
      lb.addEventListener('touchend', endDrag, { passive: true });
      lb.addEventListener('touchcancel', endDrag, { passive: true });

      /* a rotate changes the slide width, so re-seat the current one */
      window.addEventListener('resize', function () {
        if (lb.classList.contains('open')) place(rest(), false);
      });
    }

    /* the caption, logo and View project button for the shot showing. Only
       touched when the project changes, with a short fade so crossing from
       one project into the next reads as a change of project. */
    function caption(tile, fade) {
      var next = tileUrl(tile);
      if (next === url && !fade) return;
      var changed = next !== url;
      url = next;
      var cap = tile.querySelector('.col-cap');
      var logo = cap && cap.querySelector('.col-logo');
      var name = cap && cap.querySelector('.col-name');
      var meta = cap && cap.querySelector('.col-meta');
      logoEl.style.cssText = logo ? logo.getAttribute('style') || '' : '';
      logoEl.hidden = !logo;
      nameEl.textContent = name ? name.textContent : '';
      nameEl.hidden = !!logo;
      metaEl.textContent = meta ? meta.textContent : '';
      goBtn.hidden = !url || url === '#';
      if (changed && fade && capEl.animate && !reduceMotion) {
        capEl.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
          { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }

    /* Every photo on the page is a slide, around 120MB of them, so a slide
       only gets its image when it is showing or next to the one showing. */
    function hydrate(i) {
      var n = shots.length;
      [i - 1, i, i + 1].forEach(function (k) {
        var slide = track.children[(k + n) % n];
        var img = slide && slide.querySelector('img[data-src]');
        if (!img) return;
        var box = img.parentNode;
        img.addEventListener('load', function () { box.classList.add('is-loaded'); }, { once: true });
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
        if (img.complete && img.naturalWidth) box.classList.add('is-loaded');
      });
    }

    function paint() {
      var single = shots.length < 2;
      prevBtn.disabled = single;
      nextBtn.disabled = single;
    }

    function go(to) {
      var n = shots.length;
      if (n < 2) return;
      /* past either end wraps round. The track is one long strip, so a wrap
         jumps rather than sliding the whole way back across it */
      var wrap = to < 0 || to >= n;
      index = (to + n) % n;
      track.style.transition = wrap ? 'none' : 'transform .42s cubic-bezier(.22,.75,.2,1)';
      track.style.transform = 'translate3d(' + (-index * track.clientWidth) + 'px,0,0)';
      if (wrap && track.animate && !reduceMotion) track.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      hydrate(index);
      caption(shots[index], true);
      paint();
    }

    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    }

    function buildSlides() {
      track.innerHTML = '';
      shots.forEach(function (shot) {
        var slide = document.createElement('div');
        slide.className = 'lb-slide';
        var src = shot.querySelector('.col-img');
        if (src) {
          var box = src.cloneNode(true);
          var img = box.querySelector('img');
          if (img) {
            /* the real src waits in data-src until hydrate() */
            var tileImg = src.querySelector('img');
            img.setAttribute('data-src', img.getAttribute('src'));
            img.removeAttribute('src');
            img.removeAttribute('loading');
            img.decoding = 'async';
            box.classList.remove('is-loaded');
            /* the box keeps the shape of the shot so the photo fills it
               exactly, and a zoomed one is clipped by it just as the tile
               clips it. A crop overrides the ratio with its own. The width
               and height attributes carry the file's own shape, so this
               holds before the image has loaded. */
            var w = +tileImg.getAttribute('width'), h = +tileImg.getAttribute('height');
            var natural = w && h ? w / h : shot.offsetWidth / Math.max(1, shot.offsetHeight);
            box.style.setProperty('--nat-ratio', String(natural));
          }
          slide.appendChild(box);
        }
        track.appendChild(slide);
      });
      slidesBuilt = true;
    }

    function open(tile) {
      if (!lb) build();
      if (!slidesBuilt) buildSlides();
      index = Math.max(0, shots.indexOf(tile));
      url = null;
      caption(tile, false);
      hydrate(index);

      lastFocus = document.activeElement;
      lb.classList.toggle('lb-single', shots.length < 2);
      lb.classList.add('open');
      document.documentElement.classList.add('lb-open');
      document.addEventListener('keydown', onKey);
      /* jump, do not glide, to the shot that was tapped */
      requestAnimationFrame(function () {
        track.style.transition = 'none';
        track.style.transform = 'translate3d(' + (-index * track.clientWidth) + 'px,0,0)';
        paint();
        track.focus({ preventScroll: true });
      });
    }

    function close() {
      if (!lb) return;
      lb.classList.remove('open');
      document.documentElement.classList.remove('lb-open');
      document.removeEventListener('keydown', onKey);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    tiles.forEach(function (tile) {
      tile.addEventListener('click', function (e) {
        /* leave modified clicks alone so the link still opens in a new tab */
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
        e.preventDefault();
        open(tile);
      });
    });
  })();

  /* ---------- 2. Custom cursor ---------- */
  var cursor = document.getElementById('cursor');
  if (cursor && finePointer) {
    window.addEventListener('mousemove', function (e) {
      cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px';
      cursor.style.opacity = '1';
    });
    document.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('mouseenter', function () { cursor.classList.add('big'); });
      el.addEventListener('mouseleave', function () { cursor.classList.remove('big'); });
    });

    /* Over the studio banner on Home the cursor turns into the STUDIO
       lockup in an arrow tag, "Visit the Studio". It drops back to the dot
       over the links inside the banner (Let's talk, Visit the Studio), which
       keep their own behaviour. */
    var nodBanner = document.querySelector('[data-studio-link]');
    if (nodBanner) {
      var label = document.createElement('span');
      label.className = 'cur-label';
      label.textContent = 'Visit the Studio';
      cursor.appendChild(label);
      nodBanner.addEventListener('mouseover', function (e) {
        var onLink = e.target.closest && e.target.closest('a');
        cursor.classList.toggle('studio', !onLink);
      });
      nodBanner.addEventListener('mouseleave', function () { cursor.classList.remove('studio'); });
    }
  }

  /* the whole studio banner is a link to the studio page, apart from the
     real links inside it (which go where they say). Works on touch too. */
  var nodLink = document.querySelector('[data-studio-link]');
  if (nodLink) {
    nodLink.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) return;
      location.href = nodLink.getAttribute('data-studio-link');
    });
  }


  /* ---------- 3. Site-wide dot texture ----------
     A subtle scatter of tiny square dots behind every page. On desktop the
     whole field is always alive: a slow star-field flow across the screen,
     a per-dot wobble and twinkle, and the cursor amplifying the motion
     around itself. Touch and reduced-motion get a static texture. */
  (function siteDots() {
    var canvas = document.createElement('canvas');
    canvas.className = 'site-dots';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var animate = finePointer && !reduceMotion;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var dots = [];
    var W = 0, H = 0;
    var mx = -9999, my = -9999;       /* smoothed cursor position */
    var tx = -9999, ty = -9999;       /* raw cursor position */
    var running = false;
    var RADIUS = 130;

    function resolveInk() {
      var m = getComputedStyle(document.body).color.match(/\d+/g);
      if (m && m.length >= 3) ctx.fillStyle = 'rgb(' + m[0] + ',' + m[1] + ',' + m[2] + ')';
    }

    function build() {
      /* the element is 100lvh tall (css), which is taller than
         window.innerHeight while the browser's toolbar is showing; measure
         it rather than the visible viewport, or the field stops short and
         leaves an empty strip behind the toolbar */
      W = canvas.offsetWidth || window.innerWidth;
      H = canvas.offsetHeight || window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resolveInk();
      dots = [];
      var gap = 7;
      for (var gy = gap / 2; gy < H; gy += gap) {
        for (var gx = gap / 2; gx < W; gx += gap) {
          if (Math.random() < 0.45) continue;
          dots.push({
            bx: gx + (Math.random() - 0.5) * gap,
            by: gy + (Math.random() - 0.5) * gap,
            s: 0.6 + Math.random(),                   /* square dot size */
            a: 0.035 + Math.random() * 0.14,          /* base opacity, nudged up so the texture reads against the background */
            ax: 2 + Math.random() * 3.5,              /* drift amplitude */
            ay: 2 + Math.random() * 3.5,
            sx: 0.25 + Math.random() * 0.6,           /* drift speed */
            sy: 0.25 + Math.random() * 0.6,
            px: Math.random() * 6.2832,               /* drift phase */
            py: Math.random() * 6.2832,
            fs: 0.3 + Math.random() * 0.7,            /* flicker speed */
            fp: Math.random() * 6.2832,
            fm: 0.6 + Math.random() * 0.8             /* flow multiplier, cheap parallax depth */
          });
        }
      }
      draw(clock);
    }

    /* A slow pulse centred on the smoothed cursor position, always running
       rather than only while the pointer moves. Without it, once mx/my catch
       up to a stationary pointer the push/boost settle into a fixed shape:
       the field reads as "shoved once" rather than "still there". Modulating
       reach and strength on a couple of independent sine waves reads instead
       as a soft gravitational throb around wherever the cursor is resting. */
    var PULSE_HZ = 0.42, RADIUS_HZ = 0.23;

    /* Ambient flow: the whole field drifts in one direction a few pixels a
       second, wrapping at the edges, so the default state is never static.
       Each dot scales the flow by its own fm, which reads as depth. Nudged
       up once on request ("a bit more obvious"), but still slow on purpose:
       much faster and it competes with the content. */
    var FLOW_X = -4.4, FLOW_Y = -2.2;

    function draw(now) {
      var t = now * 0.001;
      ctx.clearRect(0, 0, W, H);
      mx += (tx - mx) * 0.14;
      my += (ty - my) * 0.14;
      var pulse = 0.55 + 0.45 * Math.sin(t * PULSE_HZ * 6.2832);
      var radius = RADIUS * (0.88 + 0.12 * Math.sin(t * RADIUS_HZ * 6.2832));
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var x = d.bx, y = d.by, boost = 0;
        if (animate) {
          x += Math.sin(t * d.sx + d.px) * d.ax + t * FLOW_X * d.fm;
          y += Math.cos(t * d.sy + d.py) * d.ay + t * FLOW_Y * d.fm;
          x = ((x % W) + W) % W;
          y = ((y % H) + H) % H;
          var dx = x - mx, dy = y - my;
          if (dx > -radius && dx < radius && dy > -radius && dy < radius) {
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius) {
              var f = 1 - dist / radius;
              var push = f * f * (10 + pulse * 10);
              x += (dx / (dist || 1)) * push;
              y += (dy / (dist || 1)) * push;
              boost = f * (0.09 + pulse * 0.11);
            }
          }
          ctx.globalAlpha = Math.min(1, d.a * (0.7 + 0.45 * Math.sin(t * d.fs + d.fp)) + boost);
        } else {
          ctx.globalAlpha = d.a;
        }
        ctx.fillRect(x, y, d.s, d.s);
      }
      ctx.globalAlpha = 1;
    }

    /* Two things keep the field off the scroll's back. It holds still while
       the page is scrolling (the content moving over it is the motion, and
       nobody can see a few pixels of drift mid-scroll), resuming a moment
       after the scroll stops, so the redraw never competes with scroll-linked
       animation. And it draws at most 60 times a second: on a 120Hz screen
       the drift is too slow for the extra frames to show, and they doubled
       the cost. */
    /* The field runs on its own clock, which only moves while the field
       does. Every dot's position is a function of time, so drawing from the
       real clock after a pause would move each dot straight to where it
       would have drifted to meanwhile: the whole background jerked sideways
       the moment a scroll stopped. On its own clock it carries on from
       exactly where it froze. */
    var frame = 0, lastDraw = 0, lastNow = 0, clock = performance.now();
    var scrolling = false, scrollT;
    window.addEventListener('scroll', function () {
      scrolling = true;
      clearTimeout(scrollT);
      scrollT = setTimeout(function () { scrolling = false; }, 140);
    }, { passive: true });

    function loop(now) {
      if (!running) return;
      requestAnimationFrame(loop);
      var dt = lastNow ? Math.min(now - lastNow, 50) : 0;
      lastNow = now;
      if (scrolling) return;
      clock += dt;
      if (now - lastDraw < 12) return;
      lastDraw = now;
      /* re-read the ink colour every ~half second so the dots follow the
         body colour transition when the theme changes instead of vanishing */
      if (++frame % 30 === 0) resolveInk();
      draw(clock);
    }

    resolveInk();
    build();
    themeListeners.push(function () {
      requestAnimationFrame(function () { resolveInk(); if (!running) draw(clock); });
      setTimeout(function () { resolveInk(); if (!running) draw(clock); }, 680);
    });

    if (animate) {
      window.addEventListener('mousemove', function (e) {
        tx = e.clientX;
        ty = e.clientY;
      });
      running = true;
      requestAnimationFrame(loop);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { running = false; }
        else if (!running) { running = true; lastNow = 0; requestAnimationFrame(loop); }
      });
    }

    /* Rebuild only when the canvas has actually changed size. Every dot's
       position comes out of Math.random(), so a rebuild scatters the whole
       field somewhere new: on a phone the browser's bar retracts on the
       first scroll, which fires resize, and the field visibly jumped. The
       canvas is 100lvh, so the bar moving does not change its size and
       there is nothing to redo. */
    var resizeT;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        if (canvas.offsetWidth === W && canvas.offsetHeight === H) return;
        build();
      }, 200);
    });
  })();

  /* ---------- 4. Magnetic hovers ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.magnetic').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var relX = e.clientX - r.left - r.width / 2;
        var relY = e.clientY - r.top - r.height / 2;
        el.style.transform = 'translate(' + relX * 0.18 + 'px, ' + relY * 0.28 + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = 'translate(0,0)'; });
    });
  }

  /* ---------- 5. Header hides scrolling down, returns scrolling up ---------- */
  var navEl = document.querySelector('header.nav');
  if (navEl) {
    var lastY = window.scrollY;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (y < 80) { navEl.classList.remove('nav-hidden'); }
      else if (y > lastY + 4) { navEl.classList.add('nav-hidden'); }
      else if (y < lastY - 4) { navEl.classList.remove('nav-hidden'); }
      lastY = y;
    }, { passive: true });
  }

  /* ---------- 6. Full screen menu overlay (mobile nav) ---------- */
  var menuBtn = document.getElementById('menuBtn');
  var overlay = document.getElementById('menu');
  var closeBtn = document.getElementById('menuClose');
  var menuOpen = false;
  var menuTl = null;

  if (overlay && menuBtn) {
    if (hasGsap && !reduceMotion) {
      gsap.set(overlay, { clipPath: 'inset(0% 0% 100% 0%)', opacity: 1 });
      menuTl = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } })
        .to(overlay, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.65 }, 0)
        .fromTo(overlay.querySelectorAll('.ov-txt'), { yPercent: 120 }, { yPercent: 0, duration: 0.7, stagger: 0.06 }, 0.18)
        .fromTo(overlay.querySelectorAll('.ov-num'), { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: 0.06 }, 0.3)
        .fromTo(overlay.querySelector('.ov-foot'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45 }, 0.45);
      menuTl.eventCallback('onReverseComplete', function () {
        overlay.classList.remove('is-open');
      });
    }

    var openMenu = function () {
      menuOpen = true;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      menuBtn.setAttribute('aria-expanded', 'true');
      document.documentElement.classList.add('menu-open');
      if (menuTl) menuTl.timeScale(1).play();
      if (closeBtn) closeBtn.focus();
    };

    var closeMenu = function () {
      menuOpen = false;
      overlay.setAttribute('aria-hidden', 'true');
      menuBtn.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('menu-open');
      if (menuTl) { menuTl.timeScale(1.5).reverse(); }
      else { overlay.classList.remove('is-open'); }
      menuBtn.focus();
    };

    menuBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    overlay.querySelectorAll('.ov-item').forEach(function (a) {
      a.addEventListener('click', function () { if (menuOpen) closeMenu(); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) closeMenu();
      if (e.key === 'Tab' && menuOpen) {
        var f = overlay.querySelectorAll('a, button');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- 7. Native scrolling ----------
     No smooth scroll library. Lenis was tried at several strengths and
     every one put a lag between the trackpad and the page, which read as
     scroll-jacking and, at the stronger settings, motion sickness. The
     wheel and trackpad now move the page directly; things still animate as
     they come into view, but the scroll itself is never eased.

     Same-page anchor links (the header Work link on Home) glide to their
     target rather than jump, using the browser's own smooth scrolling. The
     skip link is left alone: preventDefault would stop it moving focus to
     the target, which is its whole job. */
  document.querySelectorAll('a[href*="#"]:not(.skip-link)').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var url = new URL(a.getAttribute('href'), location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      var target = document.querySelector(url.hash);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ---------- 8. Scroll animations ---------- */
  if (hasGsap && hasST && !reduceMotion) {

    /* fade and rise blocks */
    gsap.utils.toArray('[data-anim="rise"]').forEach(function (el) {
      gsap.fromTo(el, { y: 44, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%' }
      });
    });

    /* masked text rises */
    gsap.utils.toArray('.mask').forEach(function (m) {
      var inner = m.querySelector('.mask-in');
      if (!inner) return;
      gsap.fromTo(inner, { yPercent: 120 }, {
        yPercent: 0, duration: 1, ease: 'power4.out',
        scrollTrigger: { trigger: m, start: 'top 90%' }
      });
    });

    /* work collage: each tile clips up into view, then drifts on scroll at
       its own speed (data-speed, small tiles faster than wide ones) so the
       rows slide past each other */
    gsap.utils.toArray('.col-item').forEach(function (item) {
      var media = item.querySelector('.col-media');
      var speed = parseFloat(item.getAttribute('data-speed')) || 1;

      /* the entrance reveal and the drift are desktop only: in the single
         column on phones an unrevealed tile reads as a big empty gap, and
         the drift would open and close the gaps between images as you scroll */
      if (window.matchMedia('(min-width: 761px)').matches) {
        gsap.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power4.out',
          scrollTrigger: { trigger: item, start: 'top 88%' }
        });
        gsap.fromTo(item, { y: 70 * speed }, {
          y: -70 * speed, ease: 'none',
          scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      }
    });

    /* paragraphs that light up word by word. The section pins in the middle
       of the screen, the scroll fills the words in, then the page releases
       and carries on. Asked for explicitly ("scroll jack"), which is why
       this one pins while the rest of the page just scrolls. Teleprompter
       style, also explicit: each word snaps on in sequence (the near-zero
       duration against a whole-unit stagger), no fade. */
    gsap.utils.toArray('[data-anim="words"]').forEach(function (p) {
      /* works on a single paragraph, or a container of paragraphs: each
         paragraph's words are split in place, then one pin covers the lot
         and the highlight runs through them in order. The splitter walks
         child nodes rather than flattening textContent, so inline markup
         (the italic quote in the studio pitch) survives the wrapping. */
      function splitWords(el) {
        var nodes = Array.prototype.slice.call(el.childNodes);
        nodes.forEach(function (node) {
          if (node.nodeType === 3) {
            var frag = document.createDocumentFragment();
            node.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
              var sp = document.createElement('span');
              sp.className = 'w';
              sp.textContent = part;
              frag.appendChild(sp);
            });
            el.replaceChild(frag, node);
          } else if (node.nodeType === 1) {
            splitWords(node);
          }
        });
      }
      var parts = p.querySelectorAll('p').length ? p.querySelectorAll('p') : [p];
      parts.forEach(splitWords);
      var section = p.closest('section') || p;

      /* The section pins and the scroll fills the words in. What has to fit
         on screen is the paragraph block, not the whole section: the section
         also carries its own padding and the two links under it, which can
         sit off screen for the length of the pin at no cost. When the block
         fits it is centred; when it does not (a small phone, or big text) its
         top is anchored to the top of the screen instead, so the reading
         starts in the right place either way.

         start is a function so ScrollTrigger re-runs it on every refresh,
         which covers a rotate, a font swap and a desktop resize without a
         resize listener of our own. clientHeight is what the page actually
         gets on a phone, a good deal less than the screen. */
      gsap.fromTo(p.querySelectorAll('.w'), { opacity: 0.16 }, {
        opacity: 1, duration: 0.01, stagger: 1, ease: 'none',
        scrollTrigger: {
          trigger: p,
          start: function () {
            return p.offsetHeight <= document.documentElement.clientHeight * 0.95
              ? 'center center'
              : 'top top';
          },
          end: '+=150%',
          pin: section,
          scrub: true,
          /* With native scrolling the browser moves the page before the
             script hears about it, so without this the section scrolls a
             frame past its mark before being pinned and snaps back, which
             reads as a glitch. (It was touch only while Lenis drove the
             desktop scroll; with Lenis gone the wheel needs it too.) */
          anticipatePin: 1
        }
      });
    });

    /* home hero eases up and fades as it scrolls away */
    var heroInner = document.querySelector('.hero .hero-inner');
    if (heroInner) {
      gsap.to(heroInner, {
        yPercent: -10, opacity: 0.3, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
    }

    /* recalculate trigger positions once web fonts have loaded */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }

  /* ---------- 9. Case diagrams ----------
     The parts of a diagram rise in one after another the first time it
     scrolls into view: the steps of a .flow, or anything marked .d-part
     inside a .diagram. The hidden starting state is only set here, so
     without the script, without IntersectionObserver or with reduced
     motion everything is simply there. */
  var diagrams = document.querySelectorAll('.flow, .diagram');
  if (diagrams.length && !reduceMotion && 'IntersectionObserver' in window) {
    var diagramIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        diagramIO.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    Array.prototype.forEach.call(diagrams, function (f) {
      Array.prototype.forEach.call(f.querySelectorAll('.flow-step, .d-part'), function (s, i) { s.style.setProperty('--i', i); });
      f.classList.add('is-anim');
      diagramIO.observe(f);
    });
  }

  /* ---------- 10. Videos ----------
     A .video holds a poster button carrying a YouTube id. Pressing it
     swaps in the player (privacy-enhanced domain), muted with its controls
     showing, so nothing loads or plays until someone asks for it. */
  Array.prototype.forEach.call(document.querySelectorAll('.video-btn[data-yt]'), function (btn) {
    btn.addEventListener('click', function () {
      var f = document.createElement('iframe');
      /* data-start: seconds into the film to begin from */
      var start = parseInt(btn.getAttribute('data-start'), 10);
      f.src = 'https://www.youtube-nocookie.com/embed/' + btn.getAttribute('data-yt') + '?autoplay=1&mute=1&controls=1&rel=0&playsinline=1' + (start > 0 ? '&start=' + start : '');
      f.title = btn.getAttribute('data-title') || 'Video';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      btn.parentNode.replaceChild(f, btn);
      f.focus();
    });
  });

  /* ---------- 11. Case study hero videos ----------
     .hv holds a looping film with the player's own controls: a <video>
     (file in data-src, data-src-small for phones) or a YouTube id in
     data-yt. While on screen it plays, muted, and it stops off screen;
     under reduced motion or data saver it waits for its own play button. */
  var heroes = document.querySelectorAll('.hv');
  if (heroes.length) {
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var autoplay = !reduceMotion && !saveData;
    var small = window.matchMedia('(max-width:760px)').matches;
    var ytQueue = [];
    var loadYT = function (cb) {
      if (window.YT && window.YT.Player) { cb(); return; }
      ytQueue.push(cb);
      if (document.getElementById('yt-api')) return;
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (prev) prev();
        ytQueue.splice(0).forEach(function (f) { f(); });
      };
      var tag = document.createElement('script');
      tag.id = 'yt-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    };

    Array.prototype.forEach.call(heroes, function (hv) {
      var video = hv.querySelector('video');
      var yt = hv.getAttribute('data-yt');
      var player = null, ready = false, onScreen = false;

      if (video) {
        /* the file is set straight away (preload none: nothing downloads
           until it plays) so the browser's own play button always works */
        video.src = hv.getAttribute(small && hv.getAttribute('data-src-small') ? 'data-src-small' : 'data-src');
        var smallPoster = hv.getAttribute('data-poster-small');
        if (small && smallPoster) video.poster = smallPoster;
        video.muted = true;
      } else {
        /* without autoplay the player shows at once, with its own play button */
        if (!autoplay) hv.classList.add('is-playing');
      }

      function start() {
        if (video) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); return; }
        if (player) { if (ready && autoplay) player.playVideo(); return; }
        loadYT(function () {
          var slot = document.createElement('div');
          hv.appendChild(slot);
          player = new YT.Player(slot, {
            host: 'https://www.youtube-nocookie.com',
            videoId: yt,
            playerVars: { autoplay: autoplay ? 1 : 0, mute: 1, controls: 1, loop: 1, playlist: yt, playsinline: 1, rel: 0, iv_load_policy: 3 },
            events: {
              onReady: function (e) {
                ready = true;
                e.target.mute();
                if (autoplay && onScreen) e.target.playVideo();
              },
              onStateChange: function (e) {
                if (e.data === 1) hv.classList.add('is-playing');
              }
            }
          });
        });
      }
      function stop() {
        if (video) video.pause();
        else if (player && ready) player.pauseVideo();
      }

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            onScreen = e.isIntersecting;
            if (onScreen && (autoplay || !video)) start();
            else if (!onScreen) stop();
          });
        }, { threshold: 0.05 }).observe(hv);
      } else if (autoplay) {
        onScreen = true;
        start();
      }
    });
  }
})();
