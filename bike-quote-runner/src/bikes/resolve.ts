import fs from "node:fs";
import { UserError, log } from "../util/log.js";
import { anthropicKey, dvlaKey } from "../config/load.js";
import type { Profile } from "../config/schema.js";
import type { Bike } from "../store/db.js";
import { lookupReg, normaliseReg } from "./dvla.js";
import { bikeFromUrl } from "./listing.js";
import { bikeFromImage, isImagePath } from "./vision.js";
import type { ExtractedBike } from "../llm/client.js";

const UK_REG = /^[A-Z]{2}\d{2}\s?[A-Z]{3}$|^[A-Z]\d{1,3}\s?[A-Z]{3}$|^[A-Z]{3}\s?\d{1,3}[A-Z]$|^[A-Z]{1,3}\s?\d{1,4}$/i;

export type InputKind = "reg" | "url" | "image" | "unknown";

export function classify(input: string): InputKind {
  if (/^https?:\/\//i.test(input)) return "url";
  if (isImagePath(input) || (fs.existsSync(input) && /\.(png|jpe?g|gif|webp)$/i.test(input))) return "image";
  if (UK_REG.test(input.trim())) return "reg";
  return "unknown";
}

function blank(): Omit<Bike, "id" | "addedAt"> {
  return { source: "manual", make: "", model: "", modifications: [], gaps: [] };
}

function fromExtracted(e: ExtractedBike, source: Bike["source"], sourceRef: string): Omit<Bike, "id" | "addedAt"> {
  return {
    source,
    sourceRef,
    make: e.make,
    model: e.model,
    year: e.year ?? undefined,
    engineCc: e.engineCc ?? undefined,
    value: e.value ?? undefined,
    askingPrice: e.askingPrice ?? undefined,
    mileage: e.mileage ?? undefined,
    registration: e.registration ? normaliseReg(e.registration) : undefined,
    modifications: e.modifications ?? [],
    imported: e.imported ?? undefined,
    notes: e.notes || undefined,
    gaps: e.gaps ?? [],
  };
}

/** Fields a quote journey will definitely ask for. */
export function missingFields(b: Omit<Bike, "id" | "addedAt">): string[] {
  const gaps: string[] = [];
  if (!b.make) gaps.push("make");
  if (!b.model) gaps.push("model");
  if (!b.year) gaps.push("year");
  if (!b.engineCc) gaps.push("engineCc");
  if (!b.value && !b.askingPrice) gaps.push("value");
  return gaps;
}

/**
 * Turn whatever you pasted into a bike.
 *
 * A reg goes to the DVLA, which is authoritative but has no model name, so
 * where a key is available the two sources get merged: DVLA wins on make, year
 * and engine size; the advert fills in model, value and mileage.
 */
export async function resolveBike(
  input: string,
  profile: Profile,
  opts: { kind?: InputKind } = {}
): Promise<Omit<Bike, "id" | "addedAt">> {
  const kind = opts.kind ?? classify(input);

  if (kind === "url") {
    log.step(`Reading the advert at ${input}`);
    const e = await bikeFromUrl(input, anthropicKey(profile));
    const bike = fromExtracted(e, "url", input);
    if (bike.registration) await enrichFromDvla(bike, profile);
    bike.gaps = missingFields(bike);
    return bike;
  }

  if (kind === "image") {
    log.step(`Reading ${input}`);
    const e = await bikeFromImage(input, anthropicKey(profile));
    const bike = fromExtracted(e, "image", input);
    if (bike.registration) await enrichFromDvla(bike, profile);
    bike.gaps = missingFields(bike);
    return bike;
  }

  if (kind === "reg") {
    const reg = normaliseReg(input);
    const key = dvlaKey(profile);
    if (!key) {
      throw new UserError(
        `No DVLA API key, so ${reg} can't be looked up.\n` +
          "Get a free key at https://developer-portal.driver-vehicle-licensing.api.gov.uk\n" +
          "then set DVLA_API_KEY, or add it to config/profile.yaml under apiKeys.dvla.\n" +
          "Or add the bike by hand: bqr bike add --manual"
      );
    }
    log.step(`Asking the DVLA about ${reg}`);
    const v = await lookupReg(reg, key);
    const bike: Omit<Bike, "id" | "addedAt"> = {
      ...blank(),
      source: "reg",
      sourceRef: reg,
      registration: reg,
      make: titleCase(v.make ?? ""),
      model: "",
      year: v.yearOfManufacture,
      engineCc: v.engineCapacity,
      imported: v.markedForExport === true ? undefined : undefined,
      notes: [v.colour, v.motStatus ? `MOT ${v.motStatus}` : "", v.taxStatus ? `Tax ${v.taxStatus}` : ""]
        .filter(Boolean)
        .join(" · "),
    };
    bike.gaps = missingFields(bike);
    return bike;
  }

  throw new UserError(
    `Not sure what "${input}" is.\n` +
      "Give me one of:\n" +
      "  a registration   bqr bike add LN68 XYZ\n" +
      "  a listing URL    bqr bike add https://www.autotrader.co.uk/bike-details/...\n" +
      "  a screenshot     bqr bike add ./advert.png\n" +
      "  nothing at all   bqr bike add --manual"
  );
}

async function enrichFromDvla(bike: Omit<Bike, "id" | "addedAt">, profile: Profile): Promise<void> {
  const key = dvlaKey(profile);
  if (!key || !bike.registration) return;
  try {
    const v = await lookupReg(bike.registration, key);
    if (v.make) bike.make = titleCase(v.make);
    if (v.yearOfManufacture) bike.year = v.yearOfManufacture;
    if (v.engineCapacity) bike.engineCc = v.engineCapacity;
    log.ok(`DVLA confirmed the plate: ${bike.make} ${bike.engineCc ?? "?"}cc ${bike.year ?? "?"}`);
  } catch (e) {
    log.warn(`DVLA cross-check skipped: ${(e as Error).message}`);
  }
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 3 && /^[a-z]+$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .trim();
}
