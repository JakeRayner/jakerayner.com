/** Format a Date as YYYY-MM-DD in local time (never UTC-shifted). */
export function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + n);
  return out;
}

/** DD/MM/YYYY, what most UK insurance forms actually want. */
export function ukDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return d && m && y ? `${d}/${m}/${y}` : isoDate;
}

export function yearsSince(isoDate: string, at = new Date()): number {
  const then = new Date(isoDate);
  let years = at.getFullYear() - then.getFullYear();
  const monthDelta = at.getMonth() - then.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && at.getDate() < then.getDate())) years--;
  return Math.max(0, years);
}

export function ageAt(dobIso: string, at = new Date()): number {
  return yearsSince(dobIso, at);
}
