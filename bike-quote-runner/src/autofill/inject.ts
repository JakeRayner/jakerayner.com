import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Question } from "./knowledge.js";
import type { AnswerSet } from "./answers.js";

export interface AutofillPayload {
  questions: Question[];
  answers: AnswerSet;
  markers: string[];
  /** Overwrite fields that already have a value. */
  overwrite: boolean;
  /** Fill automatically as the page changes, rather than only on Alt+F. */
  auto: boolean;
}

const ENGINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "browser.js");

/**
 * Build the script Playwright injects on every navigation, in every frame.
 *
 * The engine is injected as source text rather than as a serialised function:
 * a transpiler wrapping the function (esbuild's keepNames, for one) leaves it
 * referencing helpers that don't exist in the page, and it fails silently.
 */
export function injectionScript(payload: AutofillPayload): string {
  const engine = fs.readFileSync(ENGINE, "utf8");
  return `window.__bqrPayload = ${JSON.stringify(payload)};\n${engine}`;
}
