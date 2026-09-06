/**
 * Diagnose a page that didn't fill properly.
 *
 *   npm run probe -- https://www.example.com/quote        (a live journey)
 *   npm run probe                                          (the test fixture)
 *
 * Prints every form control it can see, the question text it read off the page,
 * which of your answers it matched, and what it would type. When a real site
 * leaves a box empty, this tells you whether the label wasn't found or no
 * pattern in knowledge.ts covers it, the fix is a one-line pattern either way.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { paths } from "../src/util/paths.js";
import { c, log } from "../src/util/log.js";
import { loadProfile, loadScenarioConfig } from "../src/config/load.js";
import { planScenarios } from "../src/scenarios/expand.js";
import { buildAnswers } from "../src/autofill/answers.js";
import { injectionScript } from "../src/autofill/inject.js";
import { QUESTIONS, ADDITIONAL_RIDER_MARKERS } from "../src/autofill/knowledge.js";
import { chromiumExecutable } from "../src/run/browser-path.js";
import { db, type Bike } from "../src/store/db.js";

interface Row { id: string; kind: string; label: string; person: number; key: string | null; would: string }

const FIXTURE: Bike = {
  id: "probe", addedAt: "", source: "manual",
  make: "Yamaha", model: "MT-07", year: 2019, engineCc: 689, value: 5200,
  registration: "LN19XYZ", modifications: [], gaps: [],
};

async function main() {
  const target = process.argv[2];
  const profile = loadProfile();
  const scenario = planScenarios(profile, loadScenarioConfig()).scenarios[0]!;
  const bike = db.bikes()[0] ?? FIXTURE;
  const answers = buildAnswers(profile, bike, scenario);

  const browser = await chromium.launch({
    headless: !target,
    executablePath: chromiumExecutable(),
    args: process.env.BQR_NO_SANDBOX ? ["--no-sandbox"] : [],
  });
  const context = await browser.newContext({ locale: "en-GB" });
  await context.exposeBinding("__bqrSend", () => {});
  await context.addInitScript({
    content: injectionScript({ questions: QUESTIONS, answers, markers: ADDITIONAL_RIDER_MARKERS, overwrite: false, auto: false }),
  });

  const page = await context.newPage();
  const url = target ?? pathToFileURL(path.join(paths.root, "test", "fixtures", "quote-form.html")).href;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  if (target) {
    log.hint("Navigate to the step you want to inspect, then press Enter here.");
    await new Promise<void>((resolve) => process.stdin.once("data", () => resolve()));
  } else {
    await page.waitForTimeout(400);
  }

  const rows: Row[] = await page.evaluate(() => {
    const d = (window as unknown as { __bqrDebug: Record<string, Function> }).__bqrDebug;
    return d.collectTargets().map((t: { kind: string; el: HTMLInputElement; group?: HTMLInputElement[] }) => {
      const lbl = t.kind === "radio" ? d.groupLabel(t.group || [t.el]) : d.labelFor(t.el);
      const person = d.personIndexFor(t.el);
      const q = d.bestQuestion(lbl.candidates, lbl.selfHints, lbl.ambient, person);
      const answer = q ? d.lookup(q.key, q.scope, person) : null;
      return {
        id: t.el.id || t.el.name || `<${t.el.tagName.toLowerCase()}>`,
        kind: t.kind,
        label: (lbl.primary || "").slice(0, 52),
        person,
        key: q ? q.key : null,
        would: answer ? answer.value : "",
      };
    });
  });

  log.info("");
  let matched = 0;
  for (const r of rows) {
    const mark = r.key ? c.green("✓") : c.yellow("?");
    const who = r.person > 0 ? c.dim(` @${answers.peopleNames[r.person]}`) : "";
    if (r.key) matched++;
    log.info(
      `  ${mark} ${r.id.slice(0, 20).padEnd(21)}${c.dim(r.kind.padEnd(9))}${r.label.padEnd(54)}` +
      (r.key ? c.cyan(r.key) + " = " + r.would + who : c.yellow("no matching question"))
    );
  }
  log.info("");
  log.info(`  ${matched} of ${rows.length} controls matched an answer.`);
  if (matched < rows.length) {
    log.hint("For each '?' above, add a pattern to src/autofill/knowledge.ts matching that label text.");
  }

  await browser.close();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
