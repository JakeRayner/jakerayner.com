// `bqr sites | head` closes the pipe early; that is not an error worth a stack trace.
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EPIPE") process.exit(0);
    throw e;
  });
}

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code: string) => (s: string) => (useColour ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  dim: wrap("2"),
  bold: wrap("1"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  blue: wrap("34"),
  cyan: wrap("36"),
};

export const log = {
  info: (...a: unknown[]) => console.log(...a),
  step: (s: string) => console.log(c.cyan("→ ") + s),
  ok: (s: string) => console.log(c.green("✓ ") + s),
  warn: (s: string) => console.log(c.yellow("! ") + s),
  err: (s: string) => console.error(c.red("✗ ") + s),
  hint: (s: string) => console.log(c.dim("  " + s)),
};

export class UserError extends Error {}
