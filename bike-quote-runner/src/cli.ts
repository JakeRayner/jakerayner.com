import fs from "node:fs";
import { Command } from "commander";
import { paths, ensureDir } from "./util/paths.js";
import { log, c, UserError } from "./util/log.js";
import { ask, askNumber, choose, confirm, closePrompts } from "./util/prompt.js";
import { loadProfile, loadScenarioConfig } from "./config/load.js";
import { db, type Bike } from "./store/db.js";
import { resolveBike, classify, missingFields } from "./bikes/resolve.js";
import { normaliseReg } from "./bikes/dvla.js";
import { planScenarios, type Scenario } from "./scenarios/expand.js";
import { buildAnswers } from "./autofill/answers.js";
import { SITES, siteById } from "./run/sites.js";
import { runSession } from "./run/session.js";
import { bikeTable, leverTable, quoteList, summaryLine } from "./report/table.js";
import { summarise } from "./report/analyse.js";
import { writeReport } from "./report/html.js";

const program = new Command();
program
  .name("bqr")
  .description("Work out which bike you can actually get insured on.")
  .version("0.1.0");

// --------------------------------------------------------------------------

program
  .command("init")
  .description("Create config/profile.yaml and config/scenarios.yaml from the templates")
  .option("-f, --force", "overwrite existing config")
  .action((opts: { force?: boolean }) => {
    ensureDir(paths.config);
    ensureDir(paths.data);
    const pairs: [string, string, string][] = [
      [paths.profileExample, paths.profile, "config/profile.yaml"],
      [paths.scenariosExample, paths.scenarios, "config/scenarios.yaml"],
    ];
    for (const [src, dest, label] of pairs) {
      if (fs.existsSync(dest) && !opts.force) {
        log.warn(`${label} already exists, left alone. Use --force to overwrite.`);
        continue;
      }
      fs.copyFileSync(src, dest);
      log.ok(`Wrote ${label}`);
    }
    log.info("");
    log.info("Next:");
    log.hint("1. Fill in config/profile.yaml, your details, your dad's, your addresses.");
    log.hint("2. Adjust config/scenarios.yaml if you want different levers.");
    log.hint("3. bqr bike add <reg | listing url | screenshot.png>");
    log.hint("4. bqr run");
  });

// --------------------------------------------------------------------------

const bike = program.command("bike").description("Manage the bikes you're considering");

bike
  .command("add [input]")
  .description("Add a bike from a registration, a listing URL, or a screenshot")
  .option("-m, --manual", "type the details in yourself")
  .option("--set <pairs...>", "override fields, e.g. --set model='MT-07' value=5200")
  .action(async (input: string | undefined, opts: { manual?: boolean; set?: string[] }) => {
    const profile = loadProfile();
    let draft: Omit<Bike, "id" | "addedAt">;

    if (opts.manual || !input) {
      draft = await manualBike(input);
    } else {
      draft = await resolveBike(input, profile);
    }

    applyOverrides(draft, opts.set ?? []);
    draft.gaps = missingFields(draft);

    if (draft.gaps.length) {
      log.warn(`Couldn't work out: ${draft.gaps.join(", ")}`);
      if (await confirm("Fill those in now?", true)) {
        for (const gap of [...draft.gaps]) await askGap(draft, gap);
        draft.gaps = missingFields(draft);
      }
    }

    if (!draft.make || !draft.model) {
      throw new UserError("A bike needs at least a make and a model before it's worth quoting.");
    }

    const saved = db.addBike(draft);
    log.ok(`Added ${c.bold(`${saved.year ?? ""} ${saved.make} ${saved.model}`.trim())} as ${c.cyan(saved.id)}`);
    describeBike(saved);
    if (saved.gaps.length) log.warn(`Quote forms will ask for: ${saved.gaps.join(", ")}, set them with \`bqr bike edit ${saved.id} --set ...\``);
  });

bike
  .command("list")
  .description("List the bikes you're tracking")
  .action(() => {
    const bikes = db.bikes();
    if (!bikes.length) return log.info(c.dim("  No bikes yet. `bqr bike add <reg|url|screenshot>`"));
    for (const b of bikes) {
      log.info("  " + c.cyan(b.id.padEnd(28)) + `${b.year ?? ""} ${b.make} ${b.model}`.trim());
      describeBike(b, "    ");
    }
  });

bike
  .command("edit <id>")
  .description("Change fields on a bike, e.g. bqr bike edit mt-07 --set value=5200")
  .requiredOption("--set <pairs...>", "field=value pairs")
  .action((id: string, opts: { set: string[] }) => {
    const existing = db.findBike(id);
    if (!existing) throw new UserError(`No bike matching "${id}". Try \`bqr bike list\`.`);
    const patch: Partial<Bike> = {};
    applyOverrides(patch as Omit<Bike, "id" | "addedAt">, opts.set);
    const merged = { ...existing, ...patch };
    merged.gaps = missingFields(merged);
    const saved = db.updateBike(existing.id, { ...patch, gaps: merged.gaps });
    log.ok(`Updated ${saved.id}`);
    describeBike(saved, "  ");
  });

bike
  .command("rm <id>")
  .description("Remove a bike and its quotes")
  .action((id: string) => {
    const existing = db.findBike(id);
    if (!existing) throw new UserError(`No bike matching "${id}".`);
    db.removeBike(existing.id);
    log.ok(`Removed ${existing.id} and its quotes.`);
  });

// --------------------------------------------------------------------------

program
  .command("plan")
  .description("Show the scenarios your config expands to")
  .action(() => {
    const profile = loadProfile();
    const cfg = loadScenarioConfig();
    const { scenarios, dropped, trimmed } = planScenarios(profile, cfg);

    log.info(c.bold(`\n  ${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"} per bike, per site:\n`));
    scenarios.forEach((s: Scenario, i: number) => {
      log.info(`  ${c.cyan(String(i + 1).padStart(2))}  ${s.label}  ${c.dim(s.id)}`);
    });
    if (trimmed.length || dropped.length) log.info("");
    for (const t of trimmed) {
      log.warn(`${t.axis}: kept ${t.kept} of ${t.of} values to fit maxRuns=${cfg.maxRuns}`);
    }
    if (dropped.length) {
      log.warn(`No room left for: ${dropped.join(", ")}, these stay at their profile default.`);
    }
    if (trimmed.length || dropped.length) {
      log.hint("Raise maxRuns, or move what matters up `priority` in config/scenarios.yaml.");
    }
    const bikes = db.bikes().length;
    const sites = cfg.sites.length;
    log.info("");
    if (bikes === 0) {
      log.hint("No bikes yet. `bqr bike add <reg|url|screenshot>` and this becomes a real plan.");
    } else {
      log.hint(`${bikes} bike(s) × ${scenarios.length} scenario(s) × ${sites} site(s) = ${bikes * scenarios.length * sites} journeys if you did every one.`);
      log.hint("You almost certainly shouldn't. Run one scenario across all bikes to rank them,");
      log.hint("then sweep scenarios on the two or three that survive.");
    }
  });

// --------------------------------------------------------------------------

program
  .command("answers")
  .description("Print every answer for one bike + scenario, ready to copy by hand")
  .option("-b, --bike <id>", "bike id")
  .action(async (opts: { bike?: string }) => {
    const profile = loadProfile();
    const cfg = loadScenarioConfig();
    const target = await pickBike(opts.bike);
    const scenario = await pickScenario(planScenarios(profile, cfg).scenarios);
    const a = buildAnswers(profile, target, scenario);

    log.info("\n" + c.bold(`  ${a.meta.bikeLabel}, ${a.meta.scenarioLabel}`));
    a.people.forEach((p, i) => {
      log.info("\n  " + c.cyan(a.peopleNames[i] + (i === 0 ? " (you)" : " (named rider)")));
      for (const [k, v] of Object.entries(p.fields)) if (v.value) log.info(`    ${k.padEnd(24)} ${v.value}`);
      p.claims.forEach((claim, ci) => {
        log.info("    " + c.dim(`claim ${ci + 1}`));
        for (const [k, v] of Object.entries(claim)) if (v.value) log.info(`      ${k.padEnd(22)} ${v.value}`);
      });
      p.convictions.forEach((cv, vi) => {
        log.info("    " + c.dim(`conviction ${vi + 1}`));
        for (const [k, v] of Object.entries(cv)) if (v.value) log.info(`      ${k.padEnd(22)} ${v.value}`);
      });
    });
    log.info("\n  " + c.cyan("Bike & policy"));
    for (const [k, v] of Object.entries(a.shared)) if (v.value) log.info(`    ${k.padEnd(24)} ${v.value}`);
  });

// --------------------------------------------------------------------------

program
  .command("run")
  .description("Open a quote journey with your answers armed")
  .option("-b, --bike <id>", "bike id")
  .option("-s, --site <id>", "site id")
  .option("--scenario <id>", "scenario id from `bqr plan`")
  .option("--overwrite", "also refill boxes that already have something in them")
  .option("--no-auto", "only fill when you press Alt+F")
  .action(async (opts: { bike?: string; site?: string; scenario?: string; overwrite?: boolean; auto?: boolean }) => {
    const profile = loadProfile();
    const cfg = loadScenarioConfig();
    const target = await pickBike(opts.bike);
    const scenarios = planScenarios(profile, cfg).scenarios;
    const scenario = opts.scenario
      ? scenarios.find((s) => s.id === opts.scenario || s.id.startsWith(opts.scenario!)) ??
        (() => { throw new UserError(`No scenario "${opts.scenario}". See \`bqr plan\`.`); })()
      : await pickScenario(scenarios);

    const siteChoices = (cfg.sites.length ? cfg.sites : SITES.map((s) => s.id))
      .map((id) => siteById(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const site = opts.site
      ? siteById(opts.site) ?? (() => { throw new UserError(`Unknown site "${opts.site}". See \`bqr sites\`.`); })()
      : await choose("Which site?", siteChoices.map((s) => ({ label: s.label, hint: s.notes, value: s })));

    const answers = buildAnswers(profile, target, scenario);
    const result = await runSession(site, answers, {
      overwrite: Boolean(opts.overwrite),
      auto: opts.auto !== false,
    });

    log.info("");
    if (!(await confirm("Record a quote from that run?", true))) return;
    await recordQuote(target, scenario, site.id, result.prices);
  });

program
  .command("sites")
  .description("List the quote sites this knows about")
  .action(() => {
    for (const s of SITES) {
      log.info("  " + c.cyan(s.id.padEnd(18)) + s.label);
      if (s.notes) log.hint("  " + " ".repeat(18) + s.notes);
    }
  });

// --------------------------------------------------------------------------

const quote = program.command("quote").description("Record and inspect premiums");

quote
  .command("add")
  .description("Record a premium you got")
  .option("-b, --bike <id>", "bike id")
  .option("-s, --site <id>", "site id")
  .action(async (opts: { bike?: string; site?: string }) => {
    const profile = loadProfile();
    const cfg = loadScenarioConfig();
    const target = await pickBike(opts.bike);
    const scenario = await pickScenario(planScenarios(profile, cfg).scenarios);
    const site = opts.site ?? (await choose("Which site?", SITES.map((s) => ({ label: s.label, value: s.id }))));
    await recordQuote(target, scenario, site, []);
  });

quote
  .command("list")
  .description("Every premium recorded, cheapest first")
  .action(() => log.info(quoteList(db.quotes(), db.bikes())));

quote
  .command("rm <id>")
  .description("Delete a recorded quote")
  .action((id: string) => {
    if (db.removeQuote(id)) log.ok(`Removed quote ${id}`);
    else throw new UserError(`No quote matching "${id}".`);
  });

// --------------------------------------------------------------------------

program
  .command("compare")
  .description("Rank the bikes and show which levers move the price")
  .action(() => {
    const bikes = db.bikes();
    const quotes = db.quotes();
    log.info("");
    log.info(bikeTable(bikes, quotes));
    const s = summaryLine(summarise(bikes, quotes));
    if (s) log.info("\n" + s);
    log.info("\n" + c.bold("  What actually moves the price"));
    log.info(leverTable(quotes));
  });

program
  .command("report")
  .description("Write an HTML comparison you can open in a browser")
  .action(() => {
    const file = writeReport(db.bikes(), db.quotes());
    log.ok(`Wrote ${file}`);
    log.hint(`open ${file}`);
  });

// --------------------------------------------------------------------------
// helpers

function describeBike(b: Bike, indent = "  "): void {
  const bits = [
    b.engineCc ? `${b.engineCc}cc` : null,
    b.registration,
    b.value ? `value £${b.value}` : b.askingPrice ? `asking £${b.askingPrice}` : null,
    b.mileage ? `${b.mileage.toLocaleString("en-GB")} mi` : null,
    b.modifications.length ? `mods: ${b.modifications.join(", ")}` : null,
    b.notes,
  ].filter(Boolean);
  if (bits.length) log.info(c.dim(indent + bits.join(" · ")));
}

function applyOverrides(draft: Omit<Bike, "id" | "addedAt"> | Partial<Bike>, pairs: string[]): void {
  const numeric = new Set(["year", "engineCc", "value", "askingPrice", "mileage"]);
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq === -1) throw new UserError(`--set expects field=value, got "${pair}"`);
    const key = pair.slice(0, eq).trim();
    const raw = pair.slice(eq + 1).trim();
    const target = draft as Record<string, unknown>;
    if (numeric.has(key)) {
      const n = Number(raw.replace(/[£,\s]/g, ""));
      if (!Number.isFinite(n)) throw new UserError(`${key} must be a number, got "${raw}"`);
      target[key] = n;
    } else if (key === "modifications") {
      target[key] = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    } else if (key === "imported") {
      target[key] = /^(y|yes|true|1)$/i.test(raw);
    } else if (key === "registration") {
      target[key] = normaliseReg(raw);
    } else if (["make", "model", "notes", "sourceRef"].includes(key)) {
      target[key] = raw;
    } else {
      throw new UserError(`Can't set "${key}". Known fields: make, model, year, engineCc, value, askingPrice, mileage, registration, modifications, imported, notes`);
    }
  }
}

async function askGap(draft: Omit<Bike, "id" | "addedAt">, gap: string): Promise<void> {
  const t = draft as Record<string, unknown>;
  if (gap === "make") t.make = await ask("Make (e.g. Yamaha)");
  else if (gap === "model") t.model = await ask("Model as an insurer lists it (e.g. MT-07)");
  else if (gap === "year") t.year = await askNumber("Year of manufacture");
  else if (gap === "engineCc") t.engineCc = await askNumber("Engine size in cc");
  else if (gap === "value") t.value = await askNumber("Value in £ (what you'd insure it for)");
}

async function manualBike(hint?: string): Promise<Omit<Bike, "id" | "addedAt">> {
  const draft: Omit<Bike, "id" | "addedAt"> = { source: "manual", make: "", model: "", modifications: [], gaps: [] };
  if (hint && classify(hint) === "reg") draft.registration = normaliseReg(hint);
  draft.make = await ask("Make (e.g. Yamaha)");
  draft.model = await ask("Model as an insurer lists it (e.g. MT-07)");
  draft.year = await askNumber("Year of manufacture");
  draft.engineCc = await askNumber("Engine size in cc");
  draft.value = await askNumber("Value in £");
  if (!draft.registration) {
    const reg = await ask("Registration (blank if you don't have it)");
    if (reg) draft.registration = normaliseReg(reg);
  }
  const mods = await ask("Modifications, comma separated (blank if standard)");
  draft.modifications = mods ? mods.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return draft;
}

async function pickBike(id?: string): Promise<Bike> {
  const bikes = db.bikes();
  if (!bikes.length) throw new UserError("No bikes yet. Add one: `bqr bike add <reg|url|screenshot>`");
  if (id) {
    const found = db.findBike(id);
    if (!found) throw new UserError(`No bike matching "${id}". Try \`bqr bike list\`.`);
    return found;
  }
  return choose("Which bike?", bikes.map((b) => ({
    label: `${b.year ?? ""} ${b.make} ${b.model}`.trim(),
    hint: b.engineCc ? `${b.engineCc}cc` : undefined,
    value: b,
  })));
}

async function pickScenario(scenarios: Scenario[]): Promise<Scenario> {
  return choose("Which scenario?", scenarios.map((s: Scenario) => ({ label: s.label, hint: s.id, value: s })));
}

async function recordQuote(target: Bike, scenario: Scenario, site: string, captured: { price: number; context: string }[]): Promise<void> {
  const declined = await confirm("Were you declined / did nothing come back?", false);
  if (declined) {
    const note = await ask("Why, if it said (blank is fine)");
    db.addQuote({
      bikeId: target.id,
      scenarioId: scenario.id,
      scenarioLabel: scenario.label,
      scenario: { ...scenario },
      site,
      annualPremium: 0,
      declined: true,
      notes: note || undefined,
    });
    log.ok("Recorded as declined, that's a result too.");
    return;
  }

  let annual: number | undefined;
  if (captured.length) {
    const sorted = [...captured].sort((a, b) => a.price - b.price).slice(0, 8);
    const pick = await choose("Which price?", [
      ...sorted.map((p) => ({ label: `£${p.price.toFixed(2)}`, hint: p.context.slice(0, 60), value: p.price as number | null })),
      { label: "Type it myself", value: null },
    ]);
    annual = pick ?? undefined;
  }
  if (annual === undefined) annual = await askNumber("Annual premium in £");
  if (annual === undefined) throw new UserError("No premium given, nothing recorded.");

  const insurer = await ask("Insurer / broker name");
  const monthly = await askNumber("Monthly payment in £ (blank to skip)");
  const excess = await askNumber("Total excess in £ (blank to skip)");
  const notes = await ask("Anything worth remembering (blank to skip)");

  const saved = db.addQuote({
    bikeId: target.id,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    scenario: { ...scenario },
    site,
    insurer: insurer || undefined,
    annualPremium: annual,
    monthlyPremium: monthly,
    totalExcess: excess,
    notes: notes || undefined,
  });
  log.ok(`Recorded £${saved.annualPremium} for ${target.make} ${target.model} (${scenario.label}).`);
  log.hint("`bqr compare` to see where it lands.");
}

// --------------------------------------------------------------------------

program
  .parseAsync(process.argv)
  .then(() => closePrompts())
  .catch((e: unknown) => {
    closePrompts();
    if (e instanceof UserError) {
      log.err(e.message);
      process.exit(1);
    }
    log.err((e as Error).stack ?? String(e));
    process.exit(1);
  });
