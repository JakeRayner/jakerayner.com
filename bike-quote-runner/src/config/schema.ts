import { z } from "zod";

/** Optional number that also accepts an explicit YAML `null`. */
const optNumber = z.number().nonnegative().nullish().transform((v) => v ?? undefined);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const ClaimSchema = z.object({
  date: isoDate,
  type: z.enum(["theft", "accident", "fire", "vandalism", "windscreen", "other"]).default("other"),
  /** The wording the form's own dropdown uses, e.g. "Multiple Vehicle - Third party hit rider". */
  description: z.string().default(""),
  fault: z.boolean().default(false),
  /** Cost of the claim to your own vehicle. */
  ownVehicleCost: optNumber,
  thirdPartyCost: optNumber,
  personalInjury: z.boolean().default(false),
  /** Whether it happened on your current or most recent motorbike policy. */
  onCurrentPolicy: z.boolean().default(false),
});

export const ConvictionSchema = z.object({
  date: isoDate,
  code: z.string(),
  points: z.number().int().nonnegative().default(0),
  fine: optNumber,
  ban: z.boolean().default(false),
  banMonths: optNumber,
});

export const RiderSchema = z.object({
  id: z.string(),
  role: z.enum(["proposer", "named-rider"]).default("named-rider"),
  title: z.string().default("Mr"),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: isoDate,
  gender: z.enum(["male", "female", "other"]).default("male"),
  maritalStatus: z
    .enum(["single", "married", "cohabiting", "divorced", "widowed", "separated"])
    .default("single"),
  relationshipToProposer: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  ukResidentSince: isoDate.optional(),
  homeowner: z.boolean().default(false),
  employment: z
    .object({
      status: z
        .enum(["employed", "self-employed", "student", "unemployed", "retired", "houseperson"])
        .default("employed"),
      occupation: z.string().default(""),
      industry: z.string().default(""),
      secondJob: z.boolean().default(false),
    })
    .default({}),
  licence: z.object({
    type: z.enum(["full", "full-a2", "full-a1", "cbt", "provisional"]).default("full"),
    number: z.string().default(""),
    /** Some journeys ask whether you want to hand over the number at all. */
    provideNumber: z.boolean().default(false),
    dateObtained: isoDate,
    countryOfIssue: z.string().default("UK"),
    /** Continuous years riding, which is not the same as years since you passed. */
    ridingExperienceYears: optNumber,
    advancedRiding: z.string().default("none"),
    bikingOrganisation: z.string().default("none"),
  }),
  /** A car licence and mirrored car NCB are worth real money on a bike policy. */
  carLicence: z
    .object({
      held: z.boolean().default(false),
      type: z.string().default("Full UK"),
      dateObtained: isoDate.optional(),
      noClaimsBonusYears: z.number().int().nonnegative().default(0),
      ownsCar: z.boolean().default(false),
    })
    .default({}),
  /** Named riders only: how often they will actually be on it. */
  usageFrequency: z.enum(["main", "frequent", "occasional", "infrequent"]).default("infrequent"),
  history: z
    .object({
      claims: z.array(ClaimSchema).default([]),
      convictions: z.array(ConvictionSchema).default([]),
      nonMotoringConvictions: z.boolean().default(false),
      medicalConditionsNotifiable: z.boolean().default(false),
      insuranceRefused: z.boolean().default(false),
    })
    .default({}),
  noClaimsBonus: z
    .object({
      years: z.number().int().nonnegative().default(0),
      protected: z.boolean().default(false),
      source: z.enum(["motorcycle", "car", "none"]).default("motorcycle"),
    })
    .default({}),
});

export const AddressSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  /** Flat or apartment, where the address has one above the house number. */
  subBuilding: z.string().default(""),
  houseNumber: z.string().default(""),
  line1: z.string(),
  line2: z.string().default(""),
  town: z.string(),
  county: z.string().default(""),
  postcode: z.string(),
  residentSince: isoDate.optional(),
  overnightParking: z
    .enum(["garage", "driveway", "secure-car-park", "street", "locked-compound", "carport"])
    .default("street"),
  homeowner: z.boolean().default(false),
});

/**
 * Security is free text, not an enum, because real journeys ask you to pick the
 * exact product from a list ("Datatool Stealth", "Honda HISS2 INJ (Thatcham 2)").
 * Write what the dropdown says; blank means none.
 */
export const SecuritySchema = z.object({
  alarm: z.string().default(""),
  immobiliser: z.string().default(""),
  tracker: z.string().default(""),
  physicalDevice: z.string().default(""),
  secureMarkings: z.string().default(""),
  chainAndGroundAnchor: z.boolean().default(false),
});

export const DefaultsSchema = z.object({
  addressId: z.string(),
  namedRiders: z.array(z.string()).default([]),
  coverType: z.enum(["comprehensive", "tpft", "tpo"]).default("comprehensive"),
  annualMileage: z.number().int().positive().default(3000),
  voluntaryExcess: z.number().int().nonnegative().default(250),
  use: z.enum(["social", "social-commuting", "business"]).default("social"),
  paymentMethod: z.enum(["annual", "monthly"]).default("annual"),
  policyStartOffsetDays: z.number().int().min(0).max(60).default(21),
  ownerAndKeeper: z.boolean().default(true),
  legalCover: z.boolean().default(false),
  breakdownCover: z.boolean().default(false),
  helmetAndLeathers: z.boolean().default(false),
  pillionCover: z.boolean().default(false),
  protectedNcb: z.boolean().default(false),
  security: SecuritySchema.default({}),
});

export const ProfileSchema = z
  .object({
    riders: z.array(RiderSchema).min(1),
    addresses: z.array(AddressSchema).min(1),
    defaults: DefaultsSchema,
    apiKeys: z
      .object({ dvla: z.string().default(""), anthropic: z.string().default("") })
      .default({}),
  })
  .superRefine((p, ctx) => {
    const ids = new Set<string>();
    for (const r of p.riders) {
      if (ids.has(r.id)) ctx.addIssue({ code: "custom", message: `duplicate rider id "${r.id}"`, path: ["riders"] });
      ids.add(r.id);
    }
    if (!p.riders.some((r) => r.role === "proposer")) {
      ctx.addIssue({ code: "custom", message: "no rider has role: proposer", path: ["riders"] });
    }
    if (!p.addresses.some((a) => a.id === p.defaults.addressId)) {
      ctx.addIssue({
        code: "custom",
        message: `defaults.addressId "${p.defaults.addressId}" is not an address id`,
        path: ["defaults", "addressId"],
      });
    }
    for (const id of p.defaults.namedRiders) {
      if (!ids.has(id)) {
        ctx.addIssue({ code: "custom", message: `defaults.namedRiders references unknown rider "${id}"`, path: ["defaults", "namedRiders"] });
      }
    }
  });

export const SCENARIO_AXES = [
  "addressId",
  "namedRiders",
  "policyStartOffsetDays",
  "voluntaryExcess",
  "coverType",
  "annualMileage",
  "use",
  "paymentMethod",
  "overnightParking",
  "protectedNcb",
  "pillionCover",
] as const;

export type AxisName = (typeof SCENARIO_AXES)[number];

export const ScenarioConfigSchema = z.object({
  axes: z.record(z.string(), z.array(z.any())).default({}),
  priority: z.array(z.string()).default([]),
  maxRuns: z.number().int().positive().default(12),
  sites: z.array(z.string()).default(["comparethemarket"]),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Rider = z.infer<typeof RiderSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type Defaults = z.infer<typeof DefaultsSchema>;
export type ScenarioConfig = z.infer<typeof ScenarioConfigSchema>;
