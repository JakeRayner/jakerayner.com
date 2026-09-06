import path from "node:path";
import { chromium, type BrowserContext } from "playwright";
import { paths, ensureDir } from "../util/paths.js";
import { log, c } from "../util/log.js";
import { injectionScript, type AutofillPayload } from "../autofill/inject.js";
import { QUESTIONS, ADDITIONAL_RIDER_MARKERS } from "../autofill/knowledge.js";
import type { AnswerSet } from "../autofill/answers.js";
import type { Site } from "./sites.js";
import { chromiumExecutable } from "./browser-path.js";

export interface PriceCapture {
  price: number;
  context: string;
}

export interface SessionResult {
  prices: PriceCapture[];
  lastUrl: string;
}

/**
 * Open the site with your answers armed, and hand you the keyboard.
 *
 * Deliberately headed and deliberately unattended-proof: nothing here submits a
 * quote, accepts terms, or touches a challenge page. It types what you already
 * told it about yourself into the boxes asking for it, and you drive.
 */
export async function runSession(
  site: Site,
  answers: AnswerSet,
  opts: { overwrite: boolean; auto: boolean }
): Promise<SessionResult> {
  const userDataDir = ensureDir(path.join(paths.browserProfiles, site.id));

  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromiumExecutable(),
      headless: false,
      viewport: null,
      locale: "en-GB",
      timezoneId: "Europe/London",
      args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (/Executable doesn't exist|Looks like Playwright/i.test(msg)) {
      throw new Error("Chromium isn't installed for Playwright yet. Run:\n  npx playwright install chromium");
    }
    if (/Missing X server|cannot open display/i.test(msg)) {
      throw new Error("No display available. `bqr run` needs a real desktop, run it on your own machine, not over a plain SSH session.");
    }
    throw e;
  }

  const prices: PriceCapture[] = [];
  let lastUrl = site.startUrl;

  await context.exposeBinding("__bqrSend", (source, msg: unknown) => {
    const m = msg as { type?: string; items?: PriceCapture[]; url?: string };
    lastUrl = source.page.url();
    if (m.type === "prices" && Array.isArray(m.items)) {
      prices.length = 0;
      prices.push(...m.items);
      const top = [...m.items].sort((a, b) => a.price - b.price).slice(0, 5);
      log.ok(`Grabbed ${m.items.length} prices from the page:`);
      for (const p of top) log.hint(`£${p.price.toFixed(2)}  ${c.dim(p.context.slice(0, 70))}`);
      log.hint("Close the browser when you're done and I'll ask which one to record.");
    }
  });

  const payload: AutofillPayload = {
    questions: QUESTIONS,
    answers,
    markers: ADDITIONAL_RIDER_MARKERS,
    overwrite: opts.overwrite,
    auto: opts.auto,
  };
  await context.addInitScript({ content: injectionScript(payload) });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(site.startUrl, { waitUntil: "domcontentloaded" }).catch(() => {
    log.warn(`Couldn't load ${site.startUrl}, navigate there yourself in the window.`);
  });

  log.info("");
  log.info(c.bold(`  ${site.label}`) + c.dim(`  ${answers.meta.bikeLabel} · ${answers.meta.scenarioLabel}`));
  if (site.notes) log.hint(site.notes);
  log.info("");
  log.hint("Alt+F   fill the visible page again (after each step)");
  log.hint("Alt+P   grab the prices on screen and send them here");
  log.hint("The panel bottom-right lists anything it couldn't fill, with the answer to type.");
  log.hint(c.bold("Close the browser window to finish this run."));
  log.info("");

  await new Promise<void>((resolve) => context.on("close", () => resolve()));
  return { prices, lastUrl };
}
