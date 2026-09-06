import { c } from "../util/log.js";
import { AXIS_LABELS, leverEffects, summarise, type BikeSummary } from "./analyse.js";
import type { Bike, Quote } from "../store/db.js";

const money = (n: number) => "£" + n.toFixed(0);

function pad(s: string, w: number): string {
  const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
  return s + " ".repeat(Math.max(0, w - visible.length));
}

export function bikeTable(bikes: Bike[], quotes: Quote[]): string {
  const rows = summarise(bikes, quotes);
  if (!rows.length) return c.dim("  No bikes yet. Add one with `bqr bike add <reg|url|screenshot>`.");

  const lines: string[] = [];
  const w = { bike: 34, cheap: 9, median: 9, site: 18 };
  lines.push(
    c.dim(
      "  " + pad("BIKE", w.bike) + pad("CHEAPEST", w.cheap) + pad("MEDIAN", w.median) + pad("BEST FROM", w.site) + "QUOTES"
    )
  );

  for (const r of rows) {
    const name = `${r.bike.year ?? ""} ${r.bike.make} ${r.bike.model}`.trim() || r.bike.id;
    const cheap = r.cheapest ? c.green(money(r.cheapest.annualPremium)) : c.dim("-");
    const med = r.median !== undefined ? money(r.median) : c.dim("-");
    const from = r.cheapest ? (r.cheapest.insurer ?? r.cheapest.site) : c.dim("no price yet");
    const count =
      `${r.quotes.length - r.declines} priced` + (r.declines ? c.red(`, ${r.declines} declined`) : "");
    lines.push("  " + pad(name.slice(0, w.bike - 1), w.bike) + pad(cheap, w.cheap) + pad(med, w.median) + pad(String(from).slice(0, w.site - 1), w.site) + c.dim(count));
    if (r.bike.gaps.length) lines.push(c.yellow("    ↳ still missing: " + r.bike.gaps.join(", ")));
  }
  return lines.join("\n");
}

export function leverTable(quotes: Quote[]): string {
  const effects = leverEffects(quotes);
  if (!effects.length) {
    return c.dim(
      "  Nothing to compare yet. This needs the same bike quoted on the same site\n" +
        "  with exactly one lever changed, that's what `bqr run` walks you through."
    );
  }
  const lines: string[] = [];
  for (const e of effects) {
    const headline = e.spread > 0 ? `worth ${money(e.spread)}` : "made no difference";
    lines.push(
      "  " + c.bold(AXIS_LABELS[e.axis] ?? e.axis) +
      c.dim(`   ${headline}, over ${e.comparisons} like-for-like comparison${e.comparisons === 1 ? "" : "s"}`)
    );
    const worst = e.values[e.values.length - 1]!.extraCost || 1;
    for (const v of e.values) {
      const bar = v.extraCost === 0 ? c.green("best") : c.dim("█".repeat(Math.max(1, Math.round((v.extraCost / worst) * 20))));
      const cost = v.extraCost === 0 ? "" : "+" + money(v.extraCost);
      lines.push("    " + pad(v.value, 16) + pad(cost, 8) + bar + c.dim(`  n=${v.n}`));
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function quoteList(quotes: Quote[], bikes: Bike[]): string {
  if (!quotes.length) return c.dim("  No quotes recorded yet.");
  const name = (id: string) => {
    const b = bikes.find((x) => x.id === id);
    return b ? `${b.make} ${b.model}` : id;
  };
  return [...quotes]
    .sort((a, b) => a.annualPremium - b.annualPremium)
    .map((q) =>
      "  " +
      pad(c.dim(q.id.split("-")[0]!), 8) +
      pad(q.declined ? c.red("DECLINED") : c.green(money(q.annualPremium)), 10) +
      pad(name(q.bikeId).slice(0, 24), 25) +
      pad((q.insurer ?? q.site).slice(0, 18), 19) +
      c.dim(q.scenarioLabel)
    )
    .join("\n");
}

export function summaryLine(rows: BikeSummary[]): string {
  const withPrice = rows.filter((r) => r.cheapest);
  if (!withPrice.length) return "";
  const best = withPrice[0]!;
  return (
    c.green("  Best so far: ") +
    `${best.bike.make} ${best.bike.model} at ${money(best.cheapest!.annualPremium)} ` +
    c.dim(`(${best.cheapest!.insurer ?? best.cheapest!.site}, ${best.cheapest!.scenarioLabel})`)
  );
}
