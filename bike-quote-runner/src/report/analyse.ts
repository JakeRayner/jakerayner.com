import type { Bike, Quote } from "../store/db.js";

export interface BikeSummary {
  bike: Bike;
  quotes: Quote[];
  cheapest?: Quote;
  median?: number;
  declines: number;
  sitesQuoted: string[];
  /** How many of the attempted sites actually returned a price. */
  insurability: number;
}

export function median(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function summarise(bikes: Bike[], quotes: Quote[]): BikeSummary[] {
  return bikes
    .map((bike) => {
      const mine = quotes.filter((q) => q.bikeId === bike.id);
      const priced = mine.filter((q) => !q.declined && q.annualPremium > 0);
      const sites = Array.from(new Set(mine.map((q) => q.site)));
      const cheapest = priced.length
        ? priced.reduce((a, b) => (b.annualPremium < a.annualPremium ? b : a))
        : undefined;
      return {
        bike,
        quotes: mine,
        cheapest,
        median: median(priced.map((q) => q.annualPremium)),
        declines: mine.filter((q) => q.declined).length,
        sitesQuoted: sites,
        insurability: mine.length ? priced.length / mine.length : 0,
      };
    })
    .sort((a, b) => {
      if (!a.cheapest && !b.cheapest) return 0;
      if (!a.cheapest) return 1;
      if (!b.cheapest) return -1;
      return a.cheapest.annualPremium - b.cheapest.annualPremium;
    });
}

export interface LeverEffect {
  axis: string;
  /** Each setting, and what it costs relative to the best setting, like for like. */
  values: { value: string; extraCost: number; n: number }[];
  /** Cost of the worst setting over the best, in GBP. */
  spread: number;
  /** How many controlled comparisons this rests on. */
  comparisons: number;
}

const AXES = [
  "addressId",
  "namedRiders",
  "policyStartOffsetDays",
  "voluntaryExcess",
  "coverType",
  "annualMileage",
  "use",
  "paymentMethod",
  "overnightParking",
  "protectedNcb",
];

function axisValue(scenario: Record<string, unknown>, axis: string): string | undefined {
  const v = scenario[axis];
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v.length ? v.join("+") : "none";
  return String(v);
}

/**
 * Which levers actually moved the price.
 *
 * Strictly like for like: quotes are only compared when they share the same
 * bike, the same site, and identical settings on every *other* axis. A naive
 * average over all quotes reverses its own answer as soon as you quote one bike
 * more often at one address than another, which is exactly what happens when
 * you follow the leads rather than run a balanced grid.
 */
export function leverEffects(quotes: Quote[]): LeverEffect[] {
  const priced = quotes.filter((q) => !q.declined && q.annualPremium > 0 && q.scenario);
  const out: LeverEffect[] = [];

  for (const axis of AXES) {
    // Everything held constant: bike, site, and every other lever.
    const groups = new Map<string, { value: string; premium: number }[]>();
    for (const q of priced) {
      const value = axisValue(q.scenario, axis);
      if (value === undefined) continue;
      const held = AXES.filter((a) => a !== axis)
        .map((a) => `${a}=${axisValue(q.scenario, a) ?? ""}`)
        .join("|");
      const key = `${q.bikeId}|${q.site}|${held}`;
      const list = groups.get(key) ?? [];
      list.push({ value, premium: q.annualPremium });
      groups.set(key, list);
    }

    const deltas = new Map<string, number[]>();
    let comparisons = 0;
    for (const [, members] of groups) {
      const distinct = new Set(members.map((m) => m.value));
      if (distinct.size < 2) continue; // nothing varied here, so nothing to learn
      comparisons++;
      const cheapest = Math.min(...members.map((m) => m.premium));
      // Within a group a setting can appear twice (two insurers); take its best.
      const bestPer = new Map<string, number>();
      for (const m of members) {
        const cur = bestPer.get(m.value);
        if (cur === undefined || m.premium < cur) bestPer.set(m.value, m.premium);
      }
      for (const [value, premium] of bestPer) {
        const list = deltas.get(value) ?? [];
        list.push(premium - cheapest);
        deltas.set(value, list);
      }
    }

    if (deltas.size < 2) continue;
    const values = Array.from(deltas.entries())
      .map(([value, ds]) => ({ value, extraCost: median(ds) ?? 0, n: ds.length }))
      .sort((a, b) => a.extraCost - b.extraCost);
    const floor = values[0]!.extraCost;
    for (const v of values) v.extraCost -= floor;
    out.push({ axis, values, spread: values[values.length - 1]!.extraCost, comparisons });
  }

  return out.sort((a, b) => b.spread - a.spread);
}

export const AXIS_LABELS: Record<string, string> = {
  addressId: "Address",
  namedRiders: "Named riders",
  policyStartOffsetDays: "Days ahead you quote",
  voluntaryExcess: "Voluntary excess",
  coverType: "Cover level",
  annualMileage: "Annual mileage",
  use: "Class of use",
  paymentMethod: "Payment method",
  overnightParking: "Overnight parking",
  protectedNcb: "Protected NCB",
};
