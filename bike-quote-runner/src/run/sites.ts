export interface Site {
  id: string;
  label: string;
  startUrl: string;
  /** Anything worth knowing before you sit down to this one. */
  notes?: string;
}

export const SITES: Site[] = [
  { id: "comparethemarket", label: "Compare the Market", startUrl: "https://www.comparethemarket.com/bike-insurance/", notes: "Aggregator. Reg lookup up front; the multi-step journey is where the autofill earns its keep." },
  { id: "confused", label: "Confused.com", startUrl: "https://www.confused.com/motorbike-insurance", notes: "Aggregator. Panel overlaps CtM but not completely." },
  { id: "gocompare", label: "GoCompare", startUrl: "https://www.gocompare.com/motorbike-insurance/", notes: "Aggregator." },
  { id: "mcn", label: "MCN Compare", startUrl: "https://www.mcncompare.com/", notes: "Bike-specific aggregator. Often better on older or oddball bikes." },
  { id: "thebikeinsurer", label: "The Bike Insurer", startUrl: "https://www.thebikeinsurer.co.uk/", notes: "Bike-specific aggregator." },
  { id: "bennetts", label: "Bennetts", startUrl: "https://www.bennetts.co.uk/bike-insurance", notes: "Direct broker, not on every aggregator." },
  { id: "devitt", label: "Devitt", startUrl: "https://www.devittinsurance.com/motorbike-insurance/", notes: "Direct broker. Good on modified and classic." },
  { id: "carolenash", label: "Carole Nash", startUrl: "https://www.carolenash.com/", notes: "Direct broker. Multi-bike and classic." },
  { id: "lexham", label: "Lexham", startUrl: "https://www.lexhaminsurance.co.uk/", notes: "Direct. Strong on small capacity, young riders and learners." },
  { id: "bikesure", label: "Bikesure", startUrl: "https://www.bikesure.co.uk/", notes: "Direct broker. Modified and non-standard." },
];

export function siteById(id: string): Site | undefined {
  return SITES.find((s) => s.id === id);
}
