import fs from "node:fs";
import path from "node:path";
import { UserError } from "../util/log.js";
import { extractBike, type ExtractedBike } from "../llm/client.js";

const MEDIA: Record<string, "image/png" | "image/jpeg" | "image/gif" | "image/webp"> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function isImagePath(p: string): boolean {
  return path.extname(p).toLowerCase() in MEDIA;
}

export async function bikeFromImage(file: string, anthropicKey: string | undefined): Promise<ExtractedBike> {
  if (!fs.existsSync(file)) throw new UserError(`No such file: ${file}`);
  const media = MEDIA[path.extname(file).toLowerCase()];
  if (!media) throw new UserError(`Unsupported image type: ${path.extname(file)}. Use png, jpg, gif or webp.`);

  const bytes = fs.statSync(file).size;
  if (bytes > 5 * 1024 * 1024) {
    throw new UserError(`${file} is ${(bytes / 1048576).toFixed(1)}MB. Screenshots over 5MB get rejected, crop or resize it.`);
  }

  return extractBike(anthropicKey, [
    { type: "image", source: { type: "base64", media_type: media, data: fs.readFileSync(file).toString("base64") } },
    { type: "text", text: "This is a screenshot of a motorcycle advert or listing. Pull out the bike's details." },
  ]);
}
