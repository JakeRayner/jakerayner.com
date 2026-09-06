import Anthropic from "@anthropic-ai/sdk";
import { UserError } from "../util/log.js";

export const MODEL = "claude-opus-5";

/** JSON Schema for what a quote journey needs to know about a bike. */
export const BIKE_SCHEMA = {
  type: "object",
  properties: {
    make: { type: "string", description: "Manufacturer, e.g. Yamaha, Honda, Triumph." },
    model: { type: "string", description: "Model as an insurer would list it, e.g. 'MT-07', 'CB500F', 'Street Triple R'. No trim waffle." },
    year: { type: ["integer", "null"], description: "Year of manufacture or first registration." },
    engineCc: { type: ["integer", "null"], description: "Engine capacity in cc." },
    askingPrice: { type: ["number", "null"], description: "Advertised price in GBP, if this is a listing." },
    value: { type: ["number", "null"], description: "Best estimate of market value in GBP." },
    mileage: { type: ["integer", "null"], description: "Odometer reading in miles." },
    registration: { type: ["string", "null"], description: "UK registration plate if visible." },
    modifications: { type: "array", items: { type: "string" }, description: "Non-standard parts mentioned: exhaust, crash bobbins, tail tidy, etc. Empty if standard." },
    imported: { type: ["boolean", "null"], description: "True only if explicitly described as an import." },
    notes: { type: "string", description: "One short line worth remembering: condition, category S/N marker, history." },
    gaps: { type: "array", items: { type: "string" }, description: "Field names you could not determine from the source." },
  },
  required: ["make", "model", "year", "engineCc", "askingPrice", "value", "mileage", "registration", "modifications", "imported", "notes", "gaps"],
  additionalProperties: false,
} as const;

export interface ExtractedBike {
  make: string;
  model: string;
  year: number | null;
  engineCc: number | null;
  askingPrice: number | null;
  value: number | null;
  mileage: number | null;
  registration: string | null;
  modifications: string[];
  imported: boolean | null;
  notes: string;
  gaps: string[];
}

const SYSTEM = [
  "You read motorcycle adverts and pull out exactly the facts a UK insurance quote form asks for.",
  "Be literal: only report what the source states or shows. Never invent a registration, price or mileage.",
  "If a field is not determinable, use null (or an empty array) and name it in `gaps`.",
  "For `model`, give the name an insurer's dropdown would carry, without the year or trim prose.",
  "If the advert mentions an insurance write-off category (S, N, C, D), say so in `notes`, it changes who will quote.",
].join(" ");

export function client(apiKey: string | undefined): Anthropic {
  if (!apiKey) {
    throw new UserError(
      "No Anthropic API key. Set ANTHROPIC_API_KEY, or put one in config/profile.yaml under apiKeys.anthropic.\n" +
        "Without it you can still add bikes by reg (DVLA) or with `bqr bike add --manual`."
    );
  }
  return new Anthropic({ apiKey });
}

/** One strict tool call, so the result is always schema-valid or an error. */
export async function extractBike(
  apiKey: string | undefined,
  content: Anthropic.MessageParam["content"]
): Promise<ExtractedBike> {
  const res = await client(apiKey).messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    tools: [
      {
        name: "record_bike",
        description: "Record the motorcycle's details as found in the source.",
        strict: true,
        input_schema: BIKE_SCHEMA as unknown as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: "record_bike" },
    messages: [{ role: "user", content }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new UserError("The model did not return bike details. Try `bqr bike add --manual`.");
  }
  return block.input as ExtractedBike;
}
