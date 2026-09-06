import { UserError } from "../util/log.js";
import { extractBike, type ExtractedBike } from "../llm/client.js";

/** Strip a fetched page down to the text a human would read. */
export function pageToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&pound;/g, "£")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function fetchListing(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        // Plain browser headers. Some classifieds 403 an obvious script.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      redirect: "follow",
    });
  } catch (e) {
    throw new UserError(`Could not reach ${url}: ${(e as Error).message}`);
  }
  if (!res.ok) {
    throw new UserError(
      `${url} returned ${res.status}.\n` +
        "Some classifieds block scripts. Screenshot the advert and run:\n" +
        "  bqr bike add ./that-screenshot.png"
    );
  }
  return res.text();
}

export async function bikeFromUrl(url: string, anthropicKey: string | undefined): Promise<ExtractedBike> {
  const html = await fetchListing(url);
  const text = pageToText(html).slice(0, 60000);
  if (text.length < 120) {
    throw new UserError(
      `${url} rendered almost no text (it is probably a JavaScript-only page).\n` +
        "Screenshot the advert instead: bqr bike add ./screenshot.png"
    );
  }
  return extractBike(anthropicKey, [
    { type: "text", text: `Motorcycle advert from ${url}\n\n---\n${text}` },
  ]);
}
