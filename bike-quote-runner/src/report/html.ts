import fs from "node:fs";
import path from "node:path";
import { paths, ensureDir } from "../util/paths.js";
import { AXIS_LABELS, leverEffects, summarise } from "./analyse.js";
import type { Bike, Quote } from "../store/db.js";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));
const money = (n: number) => "£" + n.toFixed(0);

const CSS = `
:root{color-scheme:light dark;--bg:#fbfaf8;--panel:#fff;--ink:#1a1d21;--muted:#6b7280;--line:#e6e3de;--accent:#0f766e;--warn:#b45309;--bad:#b91c1c}
@media (prefers-color-scheme:dark){:root{--bg:#101215;--panel:#171a1f;--ink:#e8eaed;--muted:#9aa3ae;--line:#262b32;--accent:#5eead4;--warn:#fbbf24;--bad:#f87171}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:40px 24px 80px}
h1{font-size:26px;margin:0 0 4px;letter-spacing:-.02em}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin:44px 0 14px;font-weight:600}
.sub{color:var(--muted);margin:0 0 8px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:12px}
.headline{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px}
.headline .name{font-weight:650;font-size:17px}
.price{font-variant-numeric:tabular-nums;font-weight:650;color:var(--accent);font-size:22px}
.price.none{color:var(--muted);font-size:15px;font-weight:400}
.meta{color:var(--muted);font-size:13px}
.gaps{color:var(--warn);font-size:13px;margin-top:6px}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:14px;min-width:600px}
th{text-align:left;font-weight:600;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em;padding:6px 12px 6px 0;border-bottom:1px solid var(--line)}
td{padding:8px 12px 8px 0;border-bottom:1px solid var(--line);vertical-align:top}
td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.declined{color:var(--bad)}
.bar{height:9px;border-radius:5px;background:var(--accent);opacity:.85}
.lever{display:grid;grid-template-columns:minmax(90px,150px) 74px 1fr auto;gap:10px;align-items:center;margin:5px 0;font-size:14px}
.lever .v{color:var(--muted)}
.lever .n{color:var(--muted);font-size:12px}
.spread{color:var(--muted);font-weight:400;font-size:13px;margin-left:8px}
footer{color:var(--muted);font-size:13px;margin-top:56px;border-top:1px solid var(--line);padding-top:16px}
`;

export function writeReport(bikes: Bike[], quotes: Quote[]): string {
  const rows = summarise(bikes, quotes);
  const effects = leverEffects(quotes);
  const priced = quotes.filter((q) => !q.declined && q.annualPremium > 0);
  const best = rows.find((r) => r.cheapest);

  const bikeCards = rows
    .map((r) => {
      const name = `${r.bike.year ?? ""} ${r.bike.make} ${r.bike.model}`.trim() || r.bike.id;
      const spec = [
        r.bike.engineCc ? `${r.bike.engineCc}cc` : null,
        r.bike.value ? `worth ~${money(r.bike.value)}` : null,
        r.bike.registration,
        r.bike.mileage ? `${r.bike.mileage.toLocaleString("en-GB")} mi` : null,
      ].filter(Boolean).join(" · ");
      const mine = [...r.quotes].sort((a, b) => Number(a.declined) - Number(b.declined) || a.annualPremium - b.annualPremium);
      return `<div class="card">
  <div class="headline">
    <span class="name">${esc(name)}</span>
    <span class="${r.cheapest ? "price" : "price none"}">${r.cheapest ? money(r.cheapest.annualPremium) : "no price yet"}</span>
    <span class="meta">${esc(spec)}</span>
  </div>
  ${r.bike.notes ? `<div class="meta">${esc(r.bike.notes)}</div>` : ""}
  ${r.bike.gaps.length ? `<div class="gaps">Still missing: ${esc(r.bike.gaps.join(", "))}</div>` : ""}
  ${mine.length ? `<div class="scroll"><table>
    <thead><tr><th>Premium</th><th>Insurer</th><th>Via</th><th>Scenario</th><th>Excess</th></tr></thead>
    <tbody>${mine.map((q) => `<tr>
      <td class="num ${q.declined ? "declined" : ""}">${q.declined ? "declined" : money(q.annualPremium)}${q.monthlyPremium ? `<br><span class="meta">${money(q.monthlyPremium)}/mo</span>` : ""}</td>
      <td>${esc(q.insurer ?? "-")}</td>
      <td>${esc(q.site)}</td>
      <td>${esc(q.scenarioLabel)}</td>
      <td class="num">${q.totalExcess ? money(q.totalExcess) : "-"}</td>
    </tr>`).join("")}</tbody></table></div>` : `<div class="meta" style="margin-top:8px">No quotes recorded.</div>`}
</div>`;
    })
    .join("\n");

  const worstOf = (e: (typeof effects)[number]) => e.values[e.values.length - 1]!.extraCost || 1;
  const leverBlocks = effects
    .map((e) => `<div class="card">
  <div><strong>${esc(AXIS_LABELS[e.axis] ?? e.axis)}</strong><span class="spread">${
    e.spread > 0 ? `worth ${money(e.spread)}` : "made no difference"
  }, over ${e.comparisons} like-for-like comparison${e.comparisons === 1 ? "" : "s"}</span></div>
  ${e.values.map((v) => `<div class="lever">
    <span class="v">${esc(v.value)}</span>
    <span class="num">${v.extraCost === 0 ? "best" : "+" + money(v.extraCost)}</span>
    <span><span class="bar" style="display:block;width:${Math.max(2, (v.extraCost / worstOf(e)) * 100).toFixed(1)}%"></span></span>
    <span class="n">n=${v.n}</span>
  </div>`).join("")}
</div>`)
    .join("\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bike insurance comparison</title>
<style>${CSS}</style></head>
<body><div class="wrap">
  <h1>Which bike can I get insured on?</h1>
  <p class="sub">${bikes.length} bike${bikes.length === 1 ? "" : "s"} · ${priced.length} price${priced.length === 1 ? "" : "s"} recorded · generated ${new Date().toLocaleString("en-GB")}</p>
  ${best ? `<p class="sub">Cheapest so far: <strong>${esc(best.bike.make)} ${esc(best.bike.model)}</strong> at <strong>${money(best.cheapest!.annualPremium)}</strong> from ${esc(best.cheapest!.insurer ?? best.cheapest!.site)} (${esc(best.cheapest!.scenarioLabel)}).</p>` : ""}

  <h2>By bike, cheapest first</h2>
  ${bikeCards || '<div class="card meta">Nothing yet.</div>'}

  <h2>Which levers actually move the price</h2>
  ${leverBlocks || '<div class="card meta">This fills in once the same bike has been quoted on the same site with exactly one lever changed.</div>'}

  <footer>
    Every premium here was recorded by you from a real quote journey. Figures are indicative
    until an insurer confirms them, and depend on every answer being true.
  </footer>
</div></body></html>`;

  const dir = ensureDir(paths.reports);
  const file = path.join(dir, "report.html");
  fs.writeFileSync(file, html);
  return file;
}
