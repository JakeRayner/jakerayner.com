/**
 * Drives the autofill engine over a realistic multi-section quote form and
 * asserts what actually landed in each box. This is the test that matters:
 * if label matching regresses, every quote journey silently gets worse.
 *
 *   npm run test
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { paths } from "../src/util/paths.js";
import { loadProfile, loadScenarioConfig } from "../src/config/load.js";
import { planScenarios } from "../src/scenarios/expand.js";
import { buildAnswers } from "../src/autofill/answers.js";
import { injectionScript } from "../src/autofill/inject.js";
import { QUESTIONS, ADDITIONAL_RIDER_MARKERS } from "../src/autofill/knowledge.js";
import type { Bike } from "../src/store/db.js";
import { c } from "../src/util/log.js";
import { chromiumExecutable } from "../src/run/browser-path.js";

const BIKE: Bike = {
  id: "test", addedAt: "", source: "manual",
  make: "Yamaha", model: "MT-07", year: 2019, engineCc: 689, value: 5200,
  registration: "LN19XYZ", modifications: [], gaps: [],
};

const EXPECTED: Record<string, string> = {
  regplate: "LN19XYZ",
  mk: "Yamaha",
  md: "MT-07",
  cc: "689",
  yr: "2019",
  val: "5200",
  pc: "SN1 1AA",
  hn: "4",
  ovn: "G",                                  // parents' address = locked garage
  cov: "Comprehensive",
  mil: "3,000",
  vex: "£250",
  usage: "Social, domestic and pleasure",
  t1: "Mr",
  fn1: "Jake",
  ln1: "Rayner",
  dob1: "12/04/1996",
  occ1: "Software Engineer",
  emp1: "Employed",
  lic1: "Full motorcycle licence",
  licd1: "20/06/2018",
  ncb1: "2",
  em1: "you@example.com",
  ph1: "07700900000",
  fn2: "Dad",                                // additional-rider section
  ln2: "Rayner",
  dob2: "01/01/1965",
  occ2: "Engineer",
};

const EXPECTED_RADIO: Record<string, string> = { modified: "N", conv1: "c1n" };

async function main() {
  // Fixture config, not yours: the assertions below hard-code the example
  // answers, so pointing at config/profile.yaml would fail the moment you
  // filled it in with your real details.
  const fixtures = path.join(paths.root, "test", "fixtures");
  const profile = loadProfile(path.join(fixtures, "profile.yaml"));
  const cfg = loadScenarioConfig(path.join(fixtures, "scenarios.yaml"));
  // "+dad · parents · 21d": exercises named riders, the second address, and dates.
  const scenario = planScenarios(profile, cfg).scenarios.find((s) => s.label === "+dad · parents · 21d");
  if (!scenario) throw new Error("expected scenario '+dad · parents · 21d' from the example config");
  const answers = buildAnswers(profile, BIKE, scenario);

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumExecutable(),
    args: process.env.BQR_NO_SANDBOX ? ["--no-sandbox"] : [],
  });
  const context = await browser.newContext({ locale: "en-GB" });
  await context.exposeBinding("__bqrSend", () => {});
  await context.addInitScript({
    content: injectionScript({ questions: QUESTIONS, answers, markers: ADDITIONAL_RIDER_MARKERS, overwrite: false, auto: true }),
  });

  const page = await context.newPage();
  const fixture = pathToFileURL(path.join(paths.root, "test", "fixtures", "quote-form.html")).href;
  await page.goto(fixture);
  await page.waitForTimeout(900);

  const actual = await page.evaluate((ids: string[]) => {
    const out: Record<string, string> = {};
    for (const id of ids) {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (!el) { out[id] = "<<missing element>>"; continue; }
      out[id] = el instanceof HTMLSelectElement
        ? (el.selectedOptions[0]?.value || el.selectedOptions[0]?.textContent || "")
        : el.value;
    }
    return out;
  }, Object.keys(EXPECTED));

  const radios = await page.evaluate((names: string[]) => {
    const out: Record<string, string> = {};
    for (const name of names) {
      const checked = document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement | null;
      // Radios with no value attribute report "on"; the id is what identifies them.
      out[name] = checked ? (checked.getAttribute("value") ?? checked.id) : "";
    }
    return out;
  }, Object.keys(EXPECTED_RADIO));

  const startDate = await page.inputValue("#start");

  let pass = 0;
  const failures: string[] = [];
  for (const [id, want] of Object.entries(EXPECTED)) {
    const got = actual[id] ?? "";
    if (got === want) { pass++; console.log(`  ${c.green("✓")} ${id.padEnd(10)} ${got}`); }
    else failures.push(`${id}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
  for (const [name, want] of Object.entries(EXPECTED_RADIO)) {
    const got = radios[name] ?? "";
    if (got === want) { pass++; console.log(`  ${c.green("✓")} ${name.padEnd(10)} ${got}`); }
    else failures.push(`radio ${name}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) { pass++; console.log(`  ${c.green("✓")} start      ${startDate}`); }
  else failures.push(`start: expected an ISO date in the native date input, got ${JSON.stringify(startDate)}`);

  await browser.close();

  const total = pass + failures.length;
  console.log("");
  if (failures.length) {
    for (const f of failures) console.log(`  ${c.red("✗")} ${f}`);
    console.log(`\n  ${c.red(`${failures.length} of ${total} fields wrong`)}`);
    process.exit(1);
  }
  console.log(`  ${c.green(`all ${total} fields filled correctly`)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
