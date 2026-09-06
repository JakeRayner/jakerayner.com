import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { c } from "./log.js";

/**
 * One interface for the whole process. Opening a fresh readline per question
 * throws away whatever else was already buffered on stdin, which silently
 * breaks piped input (`printf 'a\nb\n' | bqr ...`) and scripted runs.
 */
let rl: readline.Interface | undefined;

/**
 * Piped stdin is read once, up front, and served line by line.
 *
 * readline over a non-TTY stream emits every buffered line immediately, so only
 * the first `question()` ever sees an answer and the rest are silently dropped.
 * Draining it ourselves makes `printf 'a\nb\n' | bqr ...` behave, which in turn
 * makes the whole CLI scriptable.
 */
let piped: string[] | undefined;

async function drainStdin(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").split("\n");
}

function iface(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({ input: stdin, output: stdout });
    rl.on("close", () => { rl = undefined; });
  }
  return rl;
}

export function closePrompts(): void {
  rl?.close();
  rl = undefined;
}

export async function ask(question: string, fallback = ""): Promise<string> {
  const suffix = fallback ? c.dim(` [${fallback}]`) : "";
  const label = `${c.cyan("?")} ${question}${suffix} `;

  if (!stdin.isTTY) {
    if (piped === undefined) piped = await drainStdin();
    const next = piped.shift();
    const answer = (next ?? "").trim();
    stdout.write(label + (answer || c.dim("(default)")) + "\n");
    return answer || fallback;
  }

  try {
    const answer = (await iface().question(label)).trim();
    return answer || fallback;
  } catch {
    return fallback; // stdin ended; take the default rather than hanging
  }
}

export async function askNumber(question: string, fallback?: number): Promise<number | undefined> {
  const raw = await ask(question, fallback === undefined ? "" : String(fallback));
  if (!raw) return undefined;
  const n = Number(raw.replace(/[£,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export async function confirm(question: string, fallback = true): Promise<boolean> {
  const raw = await ask(`${question} ${fallback ? "(Y/n)" : "(y/N)"}`, "");
  if (!raw) return fallback;
  return /^y/i.test(raw);
}

export interface Choice<T> {
  label: string;
  hint?: string;
  value: T;
}

export async function choose<T>(title: string, choices: Choice<T>[]): Promise<T> {
  if (!choices.length) throw new Error(`Nothing to choose from for "${title}"`);
  if (choices.length === 1) return choices[0]!.value;
  console.log("\n" + c.bold(title));
  choices.forEach((ch, i) => {
    console.log(`  ${c.cyan(String(i + 1).padStart(2))}  ${ch.label}${ch.hint ? c.dim("  " + ch.hint) : ""}`);
  });
  for (let attempt = 0; attempt < 20; attempt++) {
    const raw = await ask("Pick a number", "1");
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= choices.length) return choices[n - 1]!.value;
    console.log(c.red(`  Enter 1-${choices.length}.`));
  }
  throw new Error("No valid choice given.");
}
