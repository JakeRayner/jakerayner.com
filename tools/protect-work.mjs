/* Password-gates the career case study pages in a deploy copy.

   Usage: node tools/protect-work.mjs <dir-of-case-pages> <password>

   Each page's full HTML is encrypted with AES-GCM (key derived from the
   password with PBKDF2, 310k iterations) and replaced by a small gate page
   that decrypts in the browser and document.writes the original back,
   scripts and all, so the unlocked page behaves exactly like the source.
   The password is cached in sessionStorage so one unlock opens every case
   study for the visit. Because the ciphertext is all that ships, the public
   repo never contains readable case study content.

   Run only against a deploy copy, never against the source pages.

   In this repo (the live site) the case pages in work/ are plain HTML
   while the gate is switched off (CASE_GATE in js/main.js). To turn it
   back on: set CASE_GATE to true, keep a copy of the plain pages (git has
   them too), then run  node tools/protect-work.mjs work <password>  from
   the repo root, and  node tools/protect-work.mjs --verifier
   assets/gate-check.json <password>  if the password changes. The gate
   page below matches the one that shipped in September 2026. */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const enc = new TextEncoder();
const args = process.argv.slice(2);
/* --verifier <out.json> <password>: write the small check file the home
   page veil validates against (an encrypted known token, same KDF as the
   pages), so the password prompt works in local dev where pages are not
   encrypted, and before any navigation in production. */
if (args[0] === '--verifier') {
  const [, out, pass] = args;
  if (!out || !pass) { console.error('usage: node tools/protect-work.mjs --verifier <out.json> <password>'); process.exit(1); }
  const payload = await encrypt('jr-gate-ok', pass);
  writeFileSync(out, JSON.stringify(payload) + '\n');
  console.log('verifier written: ' + out);
  process.exit(0);
}
const [dir, password] = args;
if (!dir || !password) {
  console.error('usage: node tools/protect-work.mjs <dir> <password>');
  process.exit(1);
}

/* Every case study ships behind the password (asked for explicitly,
   August 2026, overriding COPY_v2's open/protected split). Add a filename
   here to let a page ship open. */
const OPEN = new Set([]);

async function encrypt(html, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(html));
  const b64 = (buf) => Buffer.from(buf).toString('base64');
  return { salt: b64(salt), iv: b64(iv), data: b64(data) };
}

function gatePage(title, payload) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- tints the browser's own chrome to match the page, so a phone does not
     paint a mismatched band behind its toolbar; kept in sync by applyTheme -->
<meta name="theme-color" content="#0b0b0c">
<title>${title}</title>
<meta name="robots" content="noindex" />
<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
<link rel="preconnect" href="https://cdn.fontshare.com" crossorigin>
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
<script>
/* same pre-paint theme snippet as the site, so the gate matches the saved vibe */
(function(){try{var t=JSON.parse(localStorage.getItem('jr-theme'));if(!t||t.mode==='colour')return;var r=document.documentElement.style;r.setProperty('--bg',t.bg);r.setProperty('--ink',t.ink);r.setProperty('--accent',t.accent);r.setProperty('--accent-2',t.accent2||t.accent);r.setProperty('--accent-ink',t.accentInk);}catch(e){}})();
</script>
<style>
:root{--bg:#0b0b0c;--ink:#f6f6f7;--accent:#f6f6f7;--accent-2:var(--accent);--accent-ink:#0b0b0c;}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--ink);font-family:'Satoshi',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
.gate{max-width:420px;width:100%;}
.gate-mark{font-size:17px;font-weight:500;color:var(--ink);text-decoration:none;display:inline-block;margin-bottom:42px;}
.gate h1{font-size:26px;font-weight:500;letter-spacing:-.02em;margin-bottom:12px;}
.gate p{font-size:14.5px;line-height:1.6;color:color-mix(in srgb,var(--ink) 62%,transparent);margin-bottom:26px;}
.gate form{display:flex;gap:8px;}
.gate input{flex:1;background:color-mix(in srgb,var(--ink) 6%,transparent);border:none;color:var(--ink);font:inherit;font-size:15px;padding:13px 14px;outline:none;}
.gate input:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.gate button{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--accent-ink);border:none;font:inherit;font-size:14.5px;font-weight:500;padding:13px 22px;cursor:pointer;}
.gate .err{color:var(--ink);margin-top:14px;font-size:13.5px;}
[hidden]{display:none;}
</style>
</head>
<body>
<main class="gate">
  <a class="gate-mark" href="../index.html">Jake Rayner.</a>
  <h1>Protected</h1>
  <p>This case study covers work I can't publish openly. Get in touch and I'll
  share the password.</p>
  <form id="f">
    <input id="p" type="password" placeholder="Password" autocomplete="current-password" autofocus aria-label="Password" />
    <button type="submit">Unlock</button>
  </form>
  <p class="err" id="e" hidden>That password isn't right, try again.</p>
  <p style="margin-top:18px;margin-bottom:0;"><a href="mailto:jake.rayner.96@gmail.com" style="color:var(--ink)">Request access →</a></p>
</main>
<script type="application/json" id="payload">${JSON.stringify(payload)}</script>
<script>
(function(){
  var payload = JSON.parse(document.getElementById('payload').textContent);
  var un = function(b){var s=atob(b),a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;};
  async function tryUnlock(pass){
    try{
      var baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
      var key = await crypto.subtle.deriveKey(
        { name:'PBKDF2', salt:un(payload.salt), iterations:310000, hash:'SHA-256' },
        baseKey, { name:'AES-GCM', length:256 }, false, ['decrypt']);
      var plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv:un(payload.iv) }, key, un(payload.data));
      var html = new TextDecoder().decode(plain);
      try{ sessionStorage.setItem('jr-case-pass', pass); }catch(err){}
      document.open(); document.write(html); document.close();
      return true;
    }catch(err){ return false; }
  }
  var saved = null;
  try{ saved = sessionStorage.getItem('jr-case-pass'); }catch(err){}
  if (saved) tryUnlock(saved);
  document.getElementById('f').addEventListener('submit', async function(ev){
    ev.preventDefault();
    var ok = await tryUnlock(document.getElementById('p').value);
    if (!ok) document.getElementById('e').hidden = false;
  });
})();
</script>
</body>
</html>
`;
}

const files = readdirSync(dir).filter(f => f.endsWith('.html') && !OPEN.has(f));
for (const f of files) {
  const path = join(dir, f);
  const html = readFileSync(path, 'utf8');
  if (html.includes('id="payload"')) { console.log(`skip (already gated): ${f}`); continue; }
  const title = (html.match(/<title>(.*?)<\/title>/s) || [null, basename(f)])[1];
  const payload = await encrypt(html, password);
  writeFileSync(path, gatePage(title, payload));
  console.log(`gated: ${f}`);
}
console.log(`done, ${files.length} pages gated`);
