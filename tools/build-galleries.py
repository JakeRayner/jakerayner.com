#!/usr/bin/env python3
"""
build-galleries.py: writes the Gallery at the end of each case study.

The gallery holds every picture and video used anywhere on the site for
that project, even ones already shown higher up the page (asked for,
October 2026): the project's Home tiles, every picture on its case study
page, its hero film and any embedded YouTube videos. Repeats collapse to
one thumbnail.

Thumbnails are small files of their own (480px wide WebP) in
assets/images/thumbs/, so a gallery of forty pictures stays light. Each
links to the full file; main.js opens it in a lightbox, and with no JS
the link still opens the picture or video directly. A picture stays in
a gallery once it is there, even if it later leaves the page; delete its
<li> by hand to remove it.

Everything between <!-- gallery:start --> and <!-- gallery:end --> in
each page is regenerated. Needs ffmpeg (for the thumbnails and the film
stills). Run from the repo root:

    python3 tools/build-galleries.py
"""
import html, os, re, subprocess, sys, urllib.request
from urllib.parse import unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THUMBS = os.path.join(ROOT, 'assets', 'images', 'thumbs')
PAGES = ['aston-martin', 'bentley-motors', 'debenhams', 'co-operative-bank', 'bet365', 'barclays']
IMG_EXT = ('.jpg', '.jpeg', '.png', '.webp')
# pictures kept out of a page's gallery even though Home uses them (asked for)
EXCLUDE = {
    'aston-martin': {'app-phone-and-watch.webp'},
}

def slug(path):
    base = re.sub(r'\.[a-z0-9]+$', '', path.split('?')[0], flags=re.I)
    base = re.sub(r'^(\.\./)?assets/images/', '', base)
    return re.sub(r'[^a-z0-9]+', '-', base.lower()).strip('-')

def thumb_for(src_file, name):
    out = os.path.join(THUMBS, name + '.webp')
    if not os.path.exists(out):
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src_file,
                        '-vf', 'scale=480:-2:flags=lanczos', '-frames:v', '1',
                        '-c:v', 'libwebp', '-quality', '80', out], check=True)
    return '../assets/images/thumbs/' + name + '.webp'

def still(source, name, at=3):
    """a frame from a film (file or URL), saved as a jpg to thumbnail"""
    tmp = os.path.join(THUMBS, name + '.src.jpg')
    if not os.path.exists(os.path.join(THUMBS, name + '.webp')):
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(at), '-i', source,
                        '-frames:v', '1', tmp], check=True)
    return tmp

def yt_still(vid, name):
    tmp = os.path.join(THUMBS, name + '.src.jpg')
    if not os.path.exists(os.path.join(THUMBS, name + '.webp')):
        urllib.request.urlretrieve(f'https://i.ytimg.com/vi/{vid}/maxresdefault.jpg', tmp)
    return tmp

def attr(tag, name):
    m = re.search(r'\b' + name + r'="([^"]*)"', tag)
    return html.unescape(m.group(1)) if m else ''

def collect(page):
    path = os.path.join(ROOT, 'work', page + '.html')
    s = open(path, encoding='utf-8').read()
    main = s[s.index('<main'):s.index('</main>')]
    old = re.search(r'<!-- gallery:start -->.*?<!-- gallery:end -->', main, re.S)
    kept = old.group(0) if old else ''
    main = main.replace(kept, '') if kept else main
    main = main[:main.index('class="case-next"')] if 'class="case-next"' in main else main
    items, seen = [], set()
    def add(key, item):
        if os.path.basename(item.get('src', '')) in EXCLUDE.get(page, set()):
            return
        if key not in seen:
            seen.add(key); items.append(item)
    # the page, in reading order: films, YouTube videos and pictures
    for m in re.finditer(r'<div class="hv[^"]*"[^>]*>|<button class="video-btn"[^>]*>|<img [^>]*>', main):
        t = m.group(0)
        if t.startswith('<div'):
            src, yt = attr(t, 'data-src'), attr(t, 'data-yt')
            if yt:
                add('yt:' + yt, {'type': 'youtube', 'id': yt, 'alt': 'Video'})
            elif src:
                add(src, {'type': 'video', 'src': src, 'alt': 'Film'})
        elif t.startswith('<button'):
            yt = attr(t, 'data-yt')
            add('yt:' + yt, {'type': 'youtube', 'id': yt, 'alt': attr(t, 'data-title') or 'Video'})
        else:
            src = attr(t, 'src')
            if not src.lower().split('?')[0].endswith(IMG_EXT) or src.startswith('http'):
                continue
            add(os.path.normpath(src), {'type': 'image', 'src': src, 'alt': attr(t, 'alt')})
    # then anything from this project's Home tiles not already on the page
    home = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    for m in re.finditer(r'<a class="col-item[^"]*" href="work/' + page + r'\.html"[^>]*>.*?</a>', home, re.S):
        t = re.search(r'<img [^>]*>', m.group(0)).group(0)
        src = '../' + attr(t, 'src')
        add(os.path.normpath(src), {'type': 'image', 'src': src, 'alt': attr(t, 'alt')})
    # and anything the gallery already holds, so pictures that only ever
    # lived in a gallery are not dropped on the next run
    for m in re.finditer(r'<a class="thumb" href="([^"]+)" data-kind="image"><img [^>]*alt="([^"]*)"', kept):
        add(os.path.normpath(m.group(1)), {'type': 'image', 'src': m.group(1), 'alt': html.unescape(m.group(2))})
    return path, s, items

def build(page):
    path, s, items = collect(page)
    lis = []
    n_film = 0
    for it in items:
        if it['type'] == 'image':
            f = os.path.normpath(os.path.join(ROOT, 'work', unquote(it['src'])))
            th = thumb_for(f, slug(it['src']))
            lis.append(f'<li><a class="thumb" href="{it["src"]}" data-kind="image"><img src="{th}" width="480" height="360" alt="{html.escape(it["alt"], quote=True)}" loading="lazy" decoding="async"></a></li>')
        elif it['type'] == 'video':
            name = 'film-' + page + ('' if n_film == 0 else f'-{n_film + 1}'); n_film += 1
            src_file = it['src'] if it['src'].startswith('http') else os.path.normpath(os.path.join(ROOT, 'work', it['src']))
            th = thumb_for(still(src_file, name, at=14 if src_file.startswith('http') else 3), name)
            lis.append(f'<li><a class="thumb is-video" href="{html.escape(it["src"], quote=True)}" data-kind="video"><img src="{th}" width="480" height="270" alt="Film: the hero video from this page" loading="lazy" decoding="async"><span class="play" aria-hidden="true"></span></a></li>')
        else:
            name = 'yt-' + it['id']
            th = thumb_for(yt_still(it['id'], name), name)
            lis.append(f'<li><a class="thumb is-video" href="https://www.youtube.com/watch?v={it["id"]}" data-kind="youtube" data-yt="{it["id"]}"><img src="{th}" width="480" height="270" alt="Video: {html.escape(it["alt"], quote=True)}" loading="lazy" decoding="async"><span class="play" aria-hidden="true"></span></a></li>')
    for f in os.listdir(THUMBS):
        if f.endswith('.src.jpg'):
            os.remove(os.path.join(THUMBS, f))
    block = ('<!-- gallery:start -->\n  <section class="case-section gallery" id="gallery">\n    <div class="wrap">\n'
             '      <h2 class="case-sub">Gallery</h2>\n      <ul class="thumbs">\n        '
             + '\n        '.join(lis) + '\n      </ul>\n    </div>\n  </section>\n  <!-- gallery:end -->')
    if '<!-- gallery:start -->' in s:
        s = re.sub(r'<!-- gallery:start -->.*?<!-- gallery:end -->', lambda m: block, s, flags=re.S)
    else:
        # first run: replace the old gallery section, or add one before Next project
        old = re.search(r'\n  <section class="case-section">\s*<div class="wrap">\s*<h2 class="case-sub"[^>]*>Gallery</h2>.*?</section>\n', s, re.S)
        if old:
            s = s[:old.start()] + '\n  ' + block + '\n' + s[old.end():]
        else:
            i = s.index('  <a class="case-next"')
            s = s[:i] + block + '\n\n' + s[i:]
    open(path, 'w', encoding='utf-8').write(s)
    kinds = [it['type'] for it in items]
    print(f'{page:20} {kinds.count("image"):3} pictures  {len(kinds) - kinds.count("image")} videos')

os.makedirs(THUMBS, exist_ok=True)
for p in (sys.argv[1:] or PAGES):
    build(p)
