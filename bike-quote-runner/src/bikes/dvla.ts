import { UserError } from "../util/log.js";

const ENDPOINT = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

export interface VesVehicle {
  registrationNumber: string;
  make?: string;
  yearOfManufacture?: number;
  engineCapacity?: number;
  fuelType?: string;
  colour?: string;
  wheelplan?: string;
  taxStatus?: string;
  motStatus?: string;
  monthOfFirstRegistration?: string;
  markedForExport?: boolean;
  typeApproval?: string;
}

export function normaliseReg(reg: string): string {
  return reg.replace(/\s+/g, "").toUpperCase();
}

/**
 * DVLA Vehicle Enquiry Service. Free, official, and authoritative for
 * make / year / engine size, but it does NOT return a model name, which is
 * why a reg lookup still leaves you naming the model yourself.
 */
export async function lookupReg(reg: string, apiKey: string): Promise<VesVehicle> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ registrationNumber: normaliseReg(reg) }),
  });

  if (res.status === 404) throw new UserError(`DVLA has no record of ${normaliseReg(reg)}. Check the plate.`);
  if (res.status === 403) throw new UserError("DVLA rejected the API key (403). Check DVLA_API_KEY.");
  if (res.status === 429) throw new UserError("DVLA rate limit hit. Wait a minute and retry.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new UserError(`DVLA lookup failed (${res.status}). ${body.slice(0, 200)}`);
  }
  return (await res.json()) as VesVehicle;
}
