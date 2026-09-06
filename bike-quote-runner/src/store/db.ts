import fs from "node:fs";
import path from "node:path";
import { paths, ensureDir } from "../util/paths.js";

export interface Bike {
  id: string;
  addedAt: string;
  source: "reg" | "url" | "image" | "manual";
  sourceRef?: string;
  registration?: string;
  make: string;
  model: string;
  year?: number;
  engineCc?: number;
  value?: number;
  askingPrice?: number;
  mileage?: number;
  modifications: string[];
  imported?: boolean;
  notes?: string;
  /** Set when a source could not fill a field the quote journeys will ask for. */
  gaps: string[];
}

export interface Quote {
  id: string;
  recordedAt: string;
  bikeId: string;
  scenarioId: string;
  scenarioLabel: string;
  /** Snapshot of the levers this quote was taken under, so reports survive config edits. */
  scenario: Record<string, unknown>;
  site: string;
  insurer?: string;
  /** Annual premium in GBP. Monthly deals are normalised to their annual total. */
  annualPremium: number;
  monthlyPremium?: number;
  compulsoryExcess?: number;
  totalExcess?: number;
  declined?: boolean;
  notes?: string;
}

interface Db {
  version: 1;
  bikes: Bike[];
  quotes: Quote[];
}

const EMPTY: Db = { version: 1, bikes: [], quotes: [] };

function read(): Db {
  if (!fs.existsSync(paths.db)) return structuredClone(EMPTY);
  const raw = JSON.parse(fs.readFileSync(paths.db, "utf8")) as Partial<Db>;
  return { version: 1, bikes: raw.bikes ?? [], quotes: raw.quotes ?? [] };
}

function write(db: Db): void {
  ensureDir(path.dirname(paths.db));
  const tmp = paths.db + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, paths.db);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export const db = {
  bikes(): Bike[] {
    return read().bikes;
  },
  quotes(): Quote[] {
    return read().quotes;
  },
  findBike(idOrPrefix: string): Bike | undefined {
    const bikes = read().bikes;
    return (
      bikes.find((b) => b.id === idOrPrefix) ??
      bikes.find((b) => b.id.startsWith(idOrPrefix)) ??
      bikes.find((b) => b.registration?.replace(/\s/g, "").toUpperCase() === idOrPrefix.replace(/\s/g, "").toUpperCase())
    );
  },
  addBike(bike: Omit<Bike, "id" | "addedAt">): Bike {
    const d = read();
    const base = slug(`${bike.year ?? ""}-${bike.make}-${bike.model}`) || "bike";
    let id = base;
    for (let n = 2; d.bikes.some((b) => b.id === id); n++) id = `${base}-${n}`;
    const full: Bike = { ...bike, id, addedAt: new Date().toISOString() };
    d.bikes.push(full);
    write(d);
    return full;
  },
  updateBike(id: string, patch: Partial<Bike>): Bike {
    const d = read();
    const i = d.bikes.findIndex((b) => b.id === id);
    if (i === -1) throw new Error(`no bike ${id}`);
    const existing = d.bikes[i]!;
    d.bikes[i] = { ...existing, ...patch, id: existing.id };
    write(d);
    return d.bikes[i]!;
  },
  removeBike(id: string): boolean {
    const d = read();
    const before = d.bikes.length;
    d.bikes = d.bikes.filter((b) => b.id !== id);
    d.quotes = d.quotes.filter((q) => q.bikeId !== id);
    write(d);
    return d.bikes.length < before;
  },
  addQuote(q: Omit<Quote, "id" | "recordedAt">): Quote {
    const d = read();
    const full: Quote = {
      ...q,
      id: `q${(d.quotes.length + 1).toString().padStart(4, "0")}-${Date.now().toString(36)}`,
      recordedAt: new Date().toISOString(),
    };
    d.quotes.push(full);
    write(d);
    return full;
  },
  removeQuote(id: string): boolean {
    const d = read();
    const before = d.quotes.length;
    d.quotes = d.quotes.filter((q) => q.id !== id && !q.id.startsWith(id));
    write(d);
    return d.quotes.length < before;
  },
};
