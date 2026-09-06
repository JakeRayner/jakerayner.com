import fs from "node:fs";
import YAML from "yaml";
import { paths } from "../util/paths.js";
import { UserError } from "../util/log.js";
import { ProfileSchema, ScenarioConfigSchema, SCENARIO_AXES } from "./schema.js";
import type { Profile, ScenarioConfig, Rider, Address } from "./schema.js";

function readYaml(file: string, what: string): unknown {
  if (!fs.existsSync(file)) {
    throw new UserError(`No ${what} at ${file}. Run \`bqr init\` first, then fill it in.`);
  }
  try {
    return YAML.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new UserError(`${what} is not valid YAML: ${(e as Error).message}`);
  }
}

/** `file` overrides the default location, so tests can use a fixture rather than your real details. */
export function loadProfile(file: string = paths.profile): Profile {
  const parsed = ProfileSchema.safeParse(readYaml(file, "profile"));
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new UserError(`${file} has problems:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

export function loadScenarioConfig(file: string = paths.scenarios): ScenarioConfig {
  const parsed = ScenarioConfigSchema.safeParse(readYaml(file, "scenarios file"));
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new UserError(`${file} has problems:\n${lines.join("\n")}`);
  }
  const unknown = Object.keys(parsed.data.axes).filter(
    (a) => !(SCENARIO_AXES as readonly string[]).includes(a)
  );
  if (unknown.length) {
    throw new UserError(
      `Unknown scenario axes: ${unknown.join(", ")}.\nValid axes: ${SCENARIO_AXES.join(", ")}`
    );
  }
  return parsed.data;
}

export function proposer(p: Profile): Rider {
  const r = p.riders.find((x) => x.role === "proposer");
  if (!r) throw new UserError("No rider with role: proposer in profile.yaml");
  return r;
}

export function riderById(p: Profile, id: string): Rider {
  const r = p.riders.find((x) => x.id === id);
  if (!r) throw new UserError(`No rider with id "${id}" in profile.yaml`);
  return r;
}

export function addressById(p: Profile, id: string): Address {
  const a = p.addresses.find((x) => x.id === id);
  if (!a) throw new UserError(`No address with id "${id}" in profile.yaml`);
  return a;
}

export function anthropicKey(p?: Profile): string | undefined {
  return process.env.ANTHROPIC_API_KEY || p?.apiKeys.anthropic || undefined;
}

export function dvlaKey(p?: Profile): string | undefined {
  return process.env.DVLA_API_KEY || p?.apiKeys.dvla || undefined;
}
