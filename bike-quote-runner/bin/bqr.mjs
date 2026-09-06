#!/usr/bin/env node
// Thin wrapper so `npx bqr ...` works without remembering the tsx invocation.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const r = spawnSync(
  process.execPath,
  [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), path.join(root, "src", "cli.ts"), ...process.argv.slice(2)],
  { stdio: "inherit", cwd: root }
);
process.exit(r.status ?? 1);
