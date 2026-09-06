import { addDays, ageAt, iso, ukDate, yearsSince } from "../util/dates.js";
import { addressById, riderById, proposer } from "../config/load.js";
import type { Profile, Rider } from "../config/schema.js";
import type { Scenario } from "../scenarios/expand.js";
import type { Bike } from "../store/db.js";

export type AnswerKind = "text" | "number" | "date" | "email" | "tel" | "choice" | "boolean" | "postcode";

export interface Answer {
  value: string;
  /** Extra strings that should also count as a match for a <select> option or radio label. */
  alt?: string[];
  kind: AnswerKind;
}

export type Fields = Record<string, Answer>;

export interface PersonAnswers {
  fields: Fields;
  /** One entry per claim, in the order the form will ask for them. */
  claims: Fields[];
  convictions: Fields[];
}

export interface AnswerSet {
  /** Index 0 is the proposer; 1..n are the named riders for this scenario. */
  people: PersonAnswers[];
  peopleNames: string[];
  shared: Fields;
  meta: {
    bikeId: string;
    bikeLabel: string;
    scenarioId: string;
    scenarioLabel: string;
    policyStartDate: string;
  };
}

const yes = (b: boolean): Answer => ({
  value: b ? "Yes" : "No",
  alt: b ? ["yes", "y", "true", "1"] : ["no", "n", "false", "0", "none"],
  kind: "boolean",
});

const text = (v: string, alt?: string[]): Answer => ({ value: v, alt, kind: "text" });
const num = (v: number | string, alt?: string[]): Answer => ({ value: String(v), alt, kind: "number" });
const choice = (v: string, alt: string[]): Answer => ({ value: v, alt, kind: "choice" });

/**
 * A named security product, or "None".
 *
 * Forms list these as dropdowns of exact product names, so the value doubles as
 * both the answer to "does it have one" and the option to pick.
 */
const product = (v: string): Answer =>
  v.trim()
    ? { value: v.trim(), alt: [v.trim().toLowerCase(), "yes"], kind: "choice" }
    : { value: "None", alt: ["none", "no", "not fitted", "none fitted"], kind: "choice" };

function dateParts(prefix: string, isoDate: string): Fields {
  const [y, m, d] = isoDate.split("-") as [string, string, string];
  return {
    [prefix]: { value: ukDate(isoDate), alt: [isoDate, `${d}-${m}-${y}`, `${d}${m}${y}`], kind: "date" },
    [`${prefix}Day`]: num(Number(d)),
    [`${prefix}Month`]: num(Number(m)),
    [`${prefix}Year`]: num(Number(y)),
  };
}

const LICENCE_LABELS: Record<string, string[]> = {
  full: ["full uk", "full motorcycle licence", "full uk motorcycle", "full bike licence", "full", "full licence"],
  "full-a2": ["full a2", "a2 licence", "full motorcycle licence (a2)", "a2"],
  "full-a1": ["full a1", "a1 licence", "a1"],
  cbt: ["cbt", "compulsory basic training", "provisional with cbt", "cbt only"],
  provisional: ["provisional", "provisional licence", "learner"],
};

const PARKING_LABELS: Record<string, string[]> = {
  garage: ["garage", "locked garage", "private locked garage", "in a garage"],
  driveway: ["driveway", "drive", "private drive", "on a driveway", "private property"],
  "secure-car-park": ["secure car park", "locked car park", "private car park", "car park"],
  "locked-compound": ["locked compound", "compound", "secure compound", "locked communal area"],
  carport: ["carport", "car port"],
  street: ["street", "on the street", "public road", "roadside", "kerbside", "on road"],
};

const COVER_LABELS: Record<string, string[]> = {
  comprehensive: ["comprehensive", "fully comprehensive", "comp"],
  tpft: ["third party fire and theft", "third party, fire and theft", "tpft", "third party fire & theft"],
  tpo: ["third party only", "third party", "tpo"],
};

const USE_LABELS: Record<string, string[]> = {
  social: ["social only (sd&p)", "social only", "social domestic and pleasure", "social, domestic and pleasure", "sdp", "social"],
  "social-commuting": [
    "social domestic pleasure and commuting",
    "social and commuting",
    "sdp and commuting",
    "commuting",
    "social including commuting",
  ],
  business: ["business use", "class 1 business", "business", "commuting and business"],
};

const EMPLOYMENT_LABELS: Record<string, string[]> = {
  employed: ["employed", "employed full time", "full time employed", "employee"],
  "self-employed": ["self employed", "self-employed"],
  student: ["student", "in full time education"],
  unemployed: ["unemployed", "not employed", "not in work"],
  retired: ["retired"],
  houseperson: ["houseperson", "homemaker", "house person"],
};

const FREQUENCY_LABELS: Record<string, string[]> = {
  main: ["main rider", "main user", "most often", "main"],
  frequent: ["frequent", "frequently", "often", "regularly"],
  occasional: ["occasional", "occasionally", "sometimes"],
  infrequent: ["infrequent", "infrequently", "rarely", "seldom"],
};

function claimAnswers(claim: Rider["history"]["claims"][number]): Fields {
  return {
    ...dateParts("claimDate", claim.date),
    claimType: text(claim.description || claim.type, [claim.type, claim.description].filter(Boolean)),
    claimDescription: text(claim.description || claim.type),
    claimFault: yes(claim.fault),
    claimOwnCost: num(claim.ownVehicleCost ?? ""),
    claimThirdPartyCost: num(claim.thirdPartyCost ?? ""),
    claimPersonalInjury: yes(claim.personalInjury),
    claimOnCurrentPolicy: yes(claim.onCurrentPolicy),
  };
}

function convictionAnswers(cv: Rider["history"]["convictions"][number]): Fields {
  return {
    ...dateParts("convictionDate", cv.date),
    convictionCode: text(cv.code),
    convictionPoints: num(cv.points),
    convictionFine: num(cv.fine ?? ""),
    convictionBan: yes(cv.ban),
    convictionBanMonths: num(cv.banMonths ?? ""),
  };
}

function personFields(r: Rider, opts: { isProposer: boolean; startDate: string }): Fields {
  const claims = r.history.claims;
  const convictions = r.history.convictions;
  const lic = r.licence;

  const out: Fields = {
    title: choice(r.title, [r.title.toLowerCase(), r.title.replace(".", "")]),
    firstName: text(r.firstName),
    lastName: text(r.lastName),
    fullName: text(`${r.firstName} ${r.lastName}`),
    ...dateParts("dateOfBirth", r.dateOfBirth),
    age: num(ageAt(r.dateOfBirth)),
    gender: choice(r.gender, [r.gender, r.gender === "male" ? "m" : r.gender === "female" ? "f" : "x"]),
    maritalStatus: choice(r.maritalStatus, [r.maritalStatus, r.maritalStatus === "single" ? "never married" : r.maritalStatus]),
    email: { value: r.email ?? "", kind: "email" },
    phone: { value: r.phone ?? "", kind: "tel" },
    employmentStatus: choice(r.employment.status, EMPLOYMENT_LABELS[r.employment.status] ?? [r.employment.status]),
    occupation: text(r.employment.occupation),
    industry: text(r.employment.industry),
    secondJob: yes(r.employment.secondJob),
    homeowner: yes(r.homeowner),

    licenceType: choice(lic.type, LICENCE_LABELS[lic.type] ?? [lic.type]),
    licenceNumber: text(lic.number),
    provideLicenceNumber: yes(lic.provideNumber),
    ...dateParts("licenceDate", lic.dateObtained),
    licenceYearsHeld: num(yearsSince(lic.dateObtained, new Date(startDateSafe(opts.startDate)))),
    licenceCountry: choice(lic.countryOfIssue, ["uk", "united kingdom", "gb", "great britain"]),
    ridingExperienceYears: num(lic.ridingExperienceYears ?? yearsSince(lic.dateObtained)),
    advancedRiding: lic.advancedRiding && lic.advancedRiding !== "none" ? text(lic.advancedRiding) : yes(false),
    bikingOrganisation: lic.bikingOrganisation && lic.bikingOrganisation !== "none" ? text(lic.bikingOrganisation) : yes(false),

    hasClaims: yes(claims.length > 0),
    claimsCount: num(claims.length),
    hasConvictions: yes(convictions.length > 0),
    convictionsCount: num(convictions.length),
    totalPoints: num(convictions.reduce((n, cv) => n + cv.points, 0)),
    nonMotoringConvictions: yes(r.history.nonMotoringConvictions),
    medicalConditions: yes(r.history.medicalConditionsNotifiable),
    insuranceRefused: yes(r.history.insuranceRefused),

    ncbYears: num(r.noClaimsBonus.years, [`${r.noClaimsBonus.years} year`, `${r.noClaimsBonus.years} years`]),
    ncbProtected: yes(r.noClaimsBonus.protected),
    relationship: text(opts.isProposer ? "self" : r.relationshipToProposer ?? "other"),
    usageFrequency: choice(r.usageFrequency, FREQUENCY_LABELS[r.usageFrequency] ?? [r.usageFrequency]),
  };

  const car = r.carLicence;
  out.hasCarLicence = yes(car.held);
  out.ownsCar = yes(car.ownsCar);
  if (car.held) {
    out.carLicenceType = text(car.type, ["full uk", "full", car.type.toLowerCase()]);
    out.carNcbYears = num(car.noClaimsBonusYears, [`${car.noClaimsBonusYears} years`]);
    if (car.dateObtained) {
      Object.assign(out, dateParts("carLicenceDate", car.dateObtained));
      out.carLicenceYearsHeld = num(yearsSince(car.dateObtained));
    }
  }

  if (r.ukResidentSince) {
    Object.assign(out, dateParts("ukResidentSince", r.ukResidentSince));
    out.ukResidentYears = num(yearsSince(r.ukResidentSince));
    out.bornInUk = yes(r.ukResidentSince <= r.dateOfBirth);
  }
  return out;
}

function startDateSafe(s: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : iso(new Date());
}

function personAnswers(r: Rider, opts: { isProposer: boolean; startDate: string }): PersonAnswers {
  return {
    fields: personFields(r, opts),
    claims: r.history.claims.map(claimAnswers),
    convictions: r.history.convictions.map(convictionAnswers),
  };
}

export function buildAnswers(profile: Profile, bike: Bike, scenario: Scenario): AnswerSet {
  const startDate = iso(addDays(new Date(), scenario.policyStartOffsetDays));
  const addr = addressById(profile, scenario.addressId);
  const parking = scenario.overnightParking ?? addr.overnightParking;
  const sec = profile.defaults.security;
  const me = proposer(profile);
  const others = scenario.namedRiders.map((id) => riderById(profile, id));

  const people = [
    personAnswers(me, { isProposer: true, startDate }),
    ...others.map((r) => personAnswers(r, { isProposer: false, startDate })),
  ];

  const bikeValue = bike.value ?? bike.askingPrice;
  const streetLine = [addr.subBuilding, addr.houseNumber, addr.line1].filter(Boolean).join(", ");

  const shared: Fields = {
    registration: text((bike.registration ?? "").toUpperCase()),
    make: text(bike.make),
    model: text(bike.model),
    makeModel: text(`${bike.make} ${bike.model}`),
    vehicleDescription: text(
      [bike.year, bike.make, bike.model, bike.engineCc ? `${bike.engineCc}cc` : ""].filter(Boolean).join(" ")
    ),
    yearOfManufacture: num(bike.year ?? ""),
    engineCc: num(bike.engineCc ?? ""),
    vehicleValue: num(bikeValue ?? ""),
    purchasePrice: num(bike.askingPrice ?? bikeValue ?? ""),
    vehicleMileage: num(bike.mileage ?? ""),
    modified: yes(bike.modifications.length > 0),
    modificationsList: text(bike.modifications.join(", ") || "None"),
    imported: yes(Boolean(bike.imported)),
    officialUkModel: yes(bike.officialUkModel ?? !bike.imported),
    purchased: bike.purchased === false
      ? { value: "Not purchased yet", alt: ["not purchased yet", "i have not bought it yet", "not yet purchased", "no"], kind: "choice" }
      : yes(true),
    ownedBikeBefore: yes(Boolean(bike.ownedBikeBefore)),

    subBuilding: text(addr.subBuilding),
    houseNumber: text(addr.houseNumber),
    addressLine1: text(streetLine),
    addressLine2: text(addr.line2),
    town: text(addr.town),
    county: text(addr.county),
    postcode: { value: addr.postcode.toUpperCase(), kind: "postcode" },

    overnightParking: choice(parking, PARKING_LABELS[parking] ?? [parking]),
    daytimeParking: choice(parking, PARKING_LABELS[parking] ?? [parking]),
    keptAtHomeAddress: yes(true),

    coverType: choice(scenario.coverType, COVER_LABELS[scenario.coverType] ?? [scenario.coverType]),
    annualMileage: num(scenario.annualMileage, [`up to ${scenario.annualMileage}`, `${scenario.annualMileage} miles`]),
    voluntaryExcess: num(scenario.voluntaryExcess, [`£${scenario.voluntaryExcess}`]),
    vehicleUse: choice(scenario.use, USE_LABELS[scenario.use] ?? [scenario.use]),
    paymentMethod: choice(
      scenario.paymentMethod,
      scenario.paymentMethod === "annual"
        ? ["annual", "annually", "in full", "one payment", "pay annually", "yearly"]
        : ["monthly", "instalments", "pay monthly", "direct debit"]
    ),
    ...dateParts("policyStartDate", startDate),

    ownerOfVehicle: choice("proposer", ["proposer", "me", "policyholder", "myself", "yourself"]),
    registeredKeeper: choice("proposer", ["proposer", "me", "policyholder", "myself", "yourself"]),
    isOwnerAndKeeper: yes(profile.defaults.ownerAndKeeper),

    alarm: product(sec.alarm),
    immobiliser: product(sec.immobiliser),
    tracker: product(sec.tracker),
    physicalSecurityDevice: product(sec.physicalDevice),
    secureMarkings: product(sec.secureMarkings),
    chainAndGroundAnchor: yes(sec.chainAndGroundAnchor),

    legalCover: yes(profile.defaults.legalCover),
    breakdownCover: yes(profile.defaults.breakdownCover),
    helmetAndLeathers: yes(profile.defaults.helmetAndLeathers),
    pillionCover: yes(scenario.pillionCover ?? profile.defaults.pillionCover),
    protectedNcb: yes(scenario.protectedNcb),
    optionalExtras: { value: "Decide later", alt: ["decide later", "none", "no thanks"], kind: "choice" },

    numberOfRiders: num(people.length),
    additionalRiders: yes(others.length > 0),
  };

  return {
    people,
    peopleNames: [me, ...others].map((r) => `${r.firstName} ${r.lastName}`),
    shared,
    meta: {
      bikeId: bike.id,
      bikeLabel: `${bike.year ?? ""} ${bike.make} ${bike.model}`.trim(),
      scenarioId: scenario.id,
      scenarioLabel: scenario.label,
      policyStartDate: startDate,
    },
  };
}
