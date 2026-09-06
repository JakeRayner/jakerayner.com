import { createHash } from "node:crypto";
import type { Profile, ScenarioConfig, Defaults } from "../config/schema.js";

/** A fully-resolved set of answers-that-vary. One scenario = one quote journey. */
export interface Scenario {
  id: string;
  /** Human label, e.g. "+dad · parents · 21d". */
  label: string;
  addressId: string;
  namedRiders: string[];
  policyStartOffsetDays: number;
  voluntaryExcess: number;
  coverType: Defaults["coverType"];
  annualMileage: number;
  use: Defaults["use"];
  paymentMethod: Defaults["paymentMethod"];
  /** Overrides the address's own overnightParking when the axis is swept. */
  overnightParking?: string;
  protectedNcb: boolean;
}

export interface Plan {
  scenarios: Scenario[];
  /** Axes that didn't fit the budget at all. */
  dropped: string[];
  /** Axes kept but with some values cut, and what survived. */
  trimmed: { axis: string; kept: number; of: number }[];
}

const AXIS_ORDER = [
  "namedRiders",
  "addressId",
  "policyStartOffsetDays",
  "coverType",
  "voluntaryExcess",
  "annualMileage",
  "overnightParking",
  "use",
  "paymentMethod",
  "protectedNcb",
] as const;

function baseScenario(profile: Profile): Omit<Scenario, "id" | "label"> {
  const d = profile.defaults;
  return {
    addressId: d.addressId,
    namedRiders: d.namedRiders,
    policyStartOffsetDays: d.policyStartOffsetDays,
    voluntaryExcess: d.voluntaryExcess,
    coverType: d.coverType,
    annualMileage: d.annualMileage,
    use: d.use,
    paymentMethod: d.paymentMethod,
    protectedNcb: d.protectedNcb,
  };
}

function shortValue(axis: string, v: unknown): string {
  if (axis === "namedRiders") {
    const list = v as string[];
    return list.length ? `+${list.join("+")}` : "solo";
  }
  if (axis === "policyStartOffsetDays") return `${v}d`;
  if (axis === "voluntaryExcess") return `£${v}`;
  if (axis === "annualMileage") return `${Number(v) / 1000}k mi`;
  if (axis === "coverType") return String(v) === "comprehensive" ? "comp" : String(v);
  if (axis === "protectedNcb") return v ? "ncb-prot" : "ncb-open";
  return String(v);
}

/**
 * Keep `n` values spread across the list rather than the first n, so a trimmed
 * numeric axis still spans its extremes, the ends are where the price moves.
 */
function spread<T>(values: T[], n: number): T[] {
  if (n >= values.length) return values;
  if (n === 1) return [values[0]!];
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(values[Math.round((i * (values.length - 1)) / (n - 1))]!);
  }
  return Array.from(new Set(out));
}

/**
 * Expand the axes into concrete scenarios, spending the whole `maxRuns` budget
 * on the highest-priority axes.
 *
 * Greedy in priority order: each axis takes as many of its values as the
 * remaining budget allows, and only gets dropped when there is no room left for
 * even two. That keeps the result a clean factorial you can reason about, while
 * never leaving budget unspent the way "drop whole axes until it fits" does.
 */
export function planScenarios(profile: Profile, cfg: ScenarioConfig): Plan {
  const base = baseScenario(profile);
  const priority = [...cfg.priority, ...AXIS_ORDER.filter((a) => !cfg.priority.includes(a))];

  const pinned = Object.keys(cfg.axes).filter((a) => cfg.axes[a]?.length === 1);
  const candidates = priority.filter((a) => (cfg.axes[a]?.length ?? 0) > 1);

  const dropped: string[] = [];
  const trimmed: { axis: string; kept: number; of: number }[] = [];
  const chosen: { axis: string; values: unknown[] }[] = [];
  let size = 1;

  for (const axis of candidates) {
    const values = cfg.axes[axis]!;
    const budget = Math.floor(cfg.maxRuns / size);
    if (budget < 2) {
      dropped.push(axis);
      continue;
    }
    const kept = spread(values, Math.min(values.length, budget));
    if (kept.length < values.length) trimmed.push({ axis, kept: kept.length, of: values.length });
    chosen.push({ axis, values: kept });
    size *= kept.length;
  }

  let combos: Record<string, unknown>[] = [{}];
  for (const axis of pinned) {
    const only = cfg.axes[axis]![0];
    combos = combos.map((cmb) => ({ ...cmb, [axis]: only }));
  }
  for (const { axis, values } of chosen) {
    combos = combos.flatMap((cmb) => values.map((v) => ({ ...cmb, [axis]: v })));
  }

  const labelAxes = chosen.map((ch) => ch.axis);

  const scenarios = combos.map((overrides) => {
    const merged = { ...base, ...overrides } as Omit<Scenario, "id" | "label">;
    const id = createHash("sha1")
      .update(JSON.stringify(merged, Object.keys(merged).sort()))
      .digest("hex")
      .slice(0, 8);
    const label = labelAxes.length
      ? labelAxes.map((a) => shortValue(a, (merged as Record<string, unknown>)[a])).join(" · ")
      : "defaults";
    return { ...merged, id, label } as Scenario;
  });

  return { scenarios, dropped, trimmed };
}
