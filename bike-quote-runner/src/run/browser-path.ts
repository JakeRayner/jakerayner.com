import fs from "node:fs";
import path from "node:path";

/**
 * Where Chromium lives, when it isn't where Playwright expects.
 *
 * Set BQR_BROWSER to a Chrome/Chromium binary to use that one, handy on
 * machines with a system Chrome, or a browser cache that doesn't match the
 * pinned Playwright version. Returns undefined to let Playwright choose.
 */
export function chromiumExecutable(): string | undefined {
  const explicit = process.env.BQR_BROWSER;
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error(`BQR_BROWSER points at ${explicit}, which doesn't exist.`);
    return explicit;
  }

  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!cache || !fs.existsSync(cache)) return undefined;

  const builds = fs
    .readdirSync(cache)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));

  for (const build of builds) {
    for (const rel of ["chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-win/chrome.exe"]) {
      const candidate = path.join(cache, build, rel);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}
