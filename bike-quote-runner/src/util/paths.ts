import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..", "..");

export const paths = {
  root: ROOT,
  config: path.join(ROOT, "config"),
  profile: path.join(ROOT, "config", "profile.yaml"),
  scenarios: path.join(ROOT, "config", "scenarios.yaml"),
  profileExample: path.join(ROOT, "config", "profile.example.yaml"),
  scenariosExample: path.join(ROOT, "config", "scenarios.example.yaml"),
  data: path.join(ROOT, "data"),
  db: path.join(ROOT, "data", "db.json"),
  screenshots: path.join(ROOT, "data", "screenshots"),
  reports: path.join(ROOT, "data", "reports"),
  browserProfiles: path.join(ROOT, ".browser-profiles"),
};

export function ensureDir(p: string): string {
  fs.mkdirSync(p, { recursive: true });
  return p;
}
