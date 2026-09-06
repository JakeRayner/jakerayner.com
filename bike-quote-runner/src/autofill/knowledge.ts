/**
 * What UK bike insurance forms ask, and which answer key satisfies it.
 *
 * This is deliberately matched against the *visible question text* rather than
 * CSS selectors. Aggregator markup gets rewritten constantly; the questions
 * themselves have been the same for twenty years. When a site changes its DOM
 * this file keeps working; when it changes its wording, you add one pattern.
 *
 * `scope: "person"` questions resolve against whichever rider the surrounding
 * form section is about. `scope: "shared"` questions are bike/policy level.
 */
export interface Question {
  key: string;
  /** "claim" and "conviction" resolve against the numbered row the field sits in. */
  scope: "person" | "shared" | "claim" | "conviction";
  /** Regex sources, matched case-insensitively against the field's label text. */
  patterns: string[];
  /** Patterns that disqualify a match even when one of `patterns` hits. */
  negative?: string[];
  /** Higher wins ties. Use for questions whose wording overlaps a broader one. */
  weight?: number;
}

export const QUESTIONS: Question[] = [
  // ---- Bike -------------------------------------------------------------
  { key: "registration", scope: "shared", weight: 3, patterns: ["registration (number|no|mark)", "\\breg(istration)?\\b", "number ?plate", "vehicle reg", "enter your reg"] },
  { key: "make", scope: "shared", patterns: ["^\\s*make\\s*$", "(bike|motorcycle|vehicle) make", "manufacturer"], negative: ["model", "and model"] },
  { key: "model", scope: "shared", patterns: ["^\\s*model\\s*$", "(bike|motorcycle|vehicle) model"], negative: ["make and"] },
  { key: "makeModel", scope: "shared", weight: 2, patterns: ["make and model", "make ?/ ?model", "which (bike|motorcycle) do you"] },
  { key: "vehicleDescription", scope: "shared", weight: 3, patterns: ["what is your vehicle", "your (vehicle|bike|motorbike) is", "confirm your (vehicle|bike)"] },
  { key: "yearOfManufacture", scope: "shared", patterns: ["year of manufacture", "year of registration", "^\\s*year\\s*$", "what year", "bike year", "manufacture year"] },
  { key: "engineCc", scope: "shared", patterns: ["engine (size|capacity)", "\\bcc\\b", "cubic capacity"] },
  { key: "vehicleValue", scope: "shared", weight: 2, patterns: ["(estimated )?value of (the|your) (bike|motorcycle|vehicle)", "(bike|motorcycle|vehicle) value", "what is your motorbike value", "how much is (it|your bike) worth", "current value", "market value", "^\\s*value\\s*$"] },
  { key: "purchasePrice", scope: "shared", patterns: ["purchase price", "how much did you pay", "price paid", "amount paid"] },
  { key: "vehicleMileage", scope: "shared", patterns: ["current mileage", "mileage on the (bike|clock|odometer)", "odometer"], negative: ["annual", "per year", "each year", "yearly"] },
  { key: "modified", scope: "shared", weight: 2, patterns: ["(any )?modifications", "has (it|the bike) been modified", "is (it|the bike) modified", "modified in any way"] },
  { key: "modificationsList", scope: "shared", patterns: ["(list|describe|details of) (the )?modifications", "what modifications"] },
  { key: "imported", scope: "shared", patterns: ["\\bimport(ed)?\\b", "grey import", "is (it|the bike) an import"] },
  { key: "isOwnerAndKeeper", scope: "shared", weight: 3, patterns: ["owner and (the )?registered keeper", "registered keeper and (the )?(legal )?owner", "both the owner and"] },
  { key: "ownerOfVehicle", scope: "shared", patterns: ["who (is the |)owns? (the|this|your) (bike|motorcycle|vehicle)", "^\\s*owner\\s*$", "legal owner"] },
  { key: "registeredKeeper", scope: "shared", patterns: ["registered keeper"], negative: ["owner and"] },

  // ---- Policy shape -----------------------------------------------------
  { key: "coverType", scope: "shared", weight: 2, patterns: ["(level|type) of (policy )?cover", "cover (type|level)", "what cover do you (want|need)", "comprehensive"] },
  { key: "annualMileage", scope: "shared", weight: 2, patterns: ["annual mileage", "mileage (per|a) year", "miles (per|a) year", "how many miles.*(a )?year", "estimated (annual )?mileage", "yearly mileage"] },
  { key: "voluntaryExcess", scope: "shared", weight: 2, patterns: ["voluntary excess", "excess you.*(choose|willing)", "additional excess"] },
  { key: "vehicleUse", scope: "shared", weight: 2, patterns: ["what.*use (the|your) (bike|motorcycle).*for", "(vehicle|bike|motorcycle) use", "class of use", "how (will|do) you use"] },
  { key: "policyStartDate", scope: "shared", weight: 2, patterns: ["(policy|cover|insurance) start date", "when (do you want|would you like).*(cover|policy) to start", "start date", "cover start", "date you want cover"] },
  { key: "policyStartDateDay", scope: "shared", patterns: ["start date.*day", "^day$"] },
  { key: "policyStartDateMonth", scope: "shared", patterns: ["start date.*month", "^month$"] },
  { key: "policyStartDateYear", scope: "shared", patterns: ["start date.*year", "^year$"] },
  { key: "paymentMethod", scope: "shared", weight: 2, patterns: ["(how|pay).*(monthly|annually|in full)", "payment (method|option|frequency)", "pay (annually|monthly)", "prefer to pay", "how would you like to pay"] },
  { key: "protectedNcb", scope: "shared", patterns: ["protect (your |the )?no.?claims", "ncb protection", "protected no.?claims"] },
  { key: "legalCover", scope: "shared", patterns: ["legal (expenses|cover|protection)", "motor legal"] },
  { key: "breakdownCover", scope: "shared", patterns: ["breakdown (cover|assistance)", "roadside assistance"] },
  { key: "helmetAndLeathers", scope: "shared", patterns: ["helmet and leathers", "helmet & leathers", "riding (kit|gear) cover", "personal effects"] },
  { key: "numberOfRiders", scope: "shared", patterns: ["how many (people|riders).*(ride|use)", "number of riders"] },
  { key: "additionalRiders", scope: "shared", patterns: ["(any|add).*(additional|other|named) (rider|driver)", "anyone else.*(ride|use)", "will anyone else"] },

  { key: "officialUkModel", scope: "shared", weight: 2, patterns: ["official uk model", "uk (spec|specification) model", "is it a uk model"] },
  { key: "purchased", scope: "shared", weight: 2, patterns: ["when did you purchase", "date of purchase", "purchase date", "when did you buy"] },
  { key: "ownedBikeBefore", scope: "shared", weight: 2, patterns: ["owned a (motorbike|motorcycle|bike) before", "previous(ly)? owned.*(bike|motorbike)", "any previous bikes"] },
  { key: "pillionCover", scope: "shared", weight: 3, patterns: ["pillion", "carry(ing)? (a )?passenger"] },
  { key: "optionalExtras", scope: "shared", weight: 2, patterns: ["optional extras", "additional (cover|products|extras)", "any extras"] },
  { key: "physicalSecurityDevice", scope: "shared", weight: 3, patterns: ["physical security (device|feature)", "disc ?lock", "chain and lock", "security device"] },
  { key: "secureMarkings", scope: "shared", weight: 3, patterns: ["secure(ity)? marking", "datatag", "security marking", "\\bmarked\\b.*(security|police)"] },

  // ---- Where it lives ---------------------------------------------------
  { key: "postcode", scope: "shared", weight: 3, patterns: ["post ?code", "\\bpostal code\\b"] },
  { key: "houseNumber", scope: "shared", patterns: ["house (number|name|no)", "building (number|name)"], negative: ["flat", "apartment"] },
  { key: "addressLine1", scope: "shared", patterns: ["address line 1", "^address$", "street address", "first line of.*address"] },
  { key: "addressLine2", scope: "shared", patterns: ["address line 2", "second line of.*address"] },
  { key: "town", scope: "shared", patterns: ["town", "city", "post town"] },
  { key: "county", scope: "shared", patterns: ["county"] },
  { key: "overnightParking", scope: "shared", weight: 3, patterns: ["where.*(kept|parked|stored).*(overnight|at night)", "how is.*(kept|parked|stored).*overnight", "overnight (parking|location|storage)", "where.*bike.*kept", "where is (it|the bike) (kept|stored|parked)", "night ?time (parking|location)", "kept overnight"], negative: ["home address"] },
  { key: "daytimeParking", scope: "shared", patterns: ["(daytime|during the day).*(kept|parked)", "day ?time parking"] },
  { key: "keptAtHomeAddress", scope: "shared", patterns: ["kept at (your|the) home address", "same as (your |the )?home address", "garaged at (your|the) home"] },

  { key: "subBuilding", scope: "shared", patterns: ["flat (number|name)", "apartment (number|name)", "sub ?building"] },

  // ---- Security ---------------------------------------------------------
  { key: "alarm", scope: "shared", patterns: ["\\balarm\\b"], negative: ["immobili"] },
  { key: "immobiliser", scope: "shared", weight: 2, patterns: ["immobili[sz]er"] },
  { key: "tracker", scope: "shared", weight: 2, patterns: ["\\btracker\\b", "tracking device", "gps tracker"] },
  { key: "chainAndGroundAnchor", scope: "shared", patterns: ["ground anchor", "chain and lock", "\\bchain\\b"] },
  { key: "discLock", scope: "shared", patterns: ["disc lock", "disk lock"] },

  // ---- Car licence and mirrored no-claims -------------------------------
  { key: "hasCarLicence", scope: "person", weight: 3, patterns: ["do (you|they) (hold|have) a (full )?car (driving )?(licence|license)", "car (licence|license).*(hold|have)"] },
  { key: "carLicenceType", scope: "person", weight: 4, patterns: ["type of car (driving )?(licence|license)", "car (driving )?(licence|license) type", "what car (licence|license)"] },
  { key: "carLicenceDate", scope: "person", weight: 4, patterns: ["date.*(obtain|get|pass).*car (licence|license)", "car (licence|license).*(obtained|date)"] },
  { key: "carNcbYears", scope: "person", weight: 4, patterns: ["car no.?claims (bonus|discount)", "years car no.?claims", "car \\bncb\\b", "mirrored no.?claims"] },
  { key: "ownsCar", scope: "person", weight: 3, patterns: ["do (you|they) own a car", "own a car", "car owner"] },

  // ---- Person -----------------------------------------------------------
  { key: "title", scope: "person", patterns: ["^\\s*title\\s*$", "\\b(mr|mrs|miss|ms)\\b.*title", "your title"] },
  { key: "firstName", scope: "person", weight: 2, patterns: ["first name", "forename", "given name", "^\\s*name\\s*$"] },
  { key: "lastName", scope: "person", weight: 2, patterns: ["last name", "surname", "family name"] },
  { key: "fullName", scope: "person", patterns: ["full name", "your name"] },
  { key: "dateOfBirth", scope: "person", weight: 3, patterns: ["date of birth", "\\bd\\.?o\\.?b\\.?\\b", "when were you born", "birth ?date", "birthday"] },
  { key: "dateOfBirthDay", scope: "person", weight: 4, patterns: ["date of birth.*day", "\\bdob\\b.*day", "birth.*\\bday\\b"] },
  { key: "dateOfBirthMonth", scope: "person", weight: 4, patterns: ["date of birth.*month", "\\bdob\\b.*month", "birth.*month"] },
  { key: "dateOfBirthYear", scope: "person", weight: 4, patterns: ["date of birth.*year", "\\bdob\\b.*year", "birth.*year"] },
  { key: "age", scope: "person", patterns: ["^\\s*age\\s*$", "your age", "how old"] },
  { key: "gender", scope: "person", patterns: ["gender", "\\bsex\\b", "male.*female"] },
  { key: "maritalStatus", scope: "person", patterns: ["marital status", "married", "relationship status"] },
  { key: "ridingExperienceYears", scope: "person", weight: 4, patterns: ["continuous years riding", "years.*riding experience", "riding experience"] },
  { key: "provideLicenceNumber", scope: "person", weight: 4, patterns: ["(want|like) to provide.*(licence|license) number", "provide your (driving )?(licence|license) number"] },
  { key: "bikingOrganisation", scope: "person", weight: 3, patterns: ["member of a (biking|motorcycle|riding) (organisation|organization|club|group)", "biking organisation", "rider (club|group) member"] },
  { key: "usageFrequency", scope: "person", weight: 3, patterns: ["how (frequently|often) will (they|you) (be )?us(e|ing)", "frequency of use", "how often.*ride"] },
  { key: "relationship", scope: "person", patterns: ["relationship to (you|the|your)\\b", "^relationship$", "how.*related", "their relationship"] },
  { key: "email", scope: "person", weight: 2, patterns: ["e.?mail"] },
  { key: "phone", scope: "person", weight: 2, patterns: ["(phone|telephone|mobile|contact) (number|no)", "\\bmobile\\b", "\\btelephone\\b"] },
  { key: "employmentStatus", scope: "person", weight: 2, patterns: ["employment (status|type)", "are you employed", "working status", "employment"] },
  { key: "occupation", scope: "person", weight: 2, patterns: ["occupation", "job title", "what do you do for a living", "your job"] },
  { key: "industry", scope: "person", patterns: ["industry", "business type", "type of business", "employer.?s business"] },
  { key: "secondJob", scope: "person", patterns: ["second (job|occupation)", "another job", "part.?time job"] },
  { key: "homeowner", scope: "person", patterns: ["home ?owner", "do you own your (home|house|property)", "residential status"] },
  { key: "licenceType", scope: "person", weight: 3, patterns: ["type of (motorbike|motorcycle|bike|riding) (licence|license)", "(motorbike|motorcycle|bike) (licence|license) type", "(licence|license) type", "type of (licence|license)", "what (licence|license) do (you|they) (hold|have)", "(licence|license) held"], negative: ["\\bcar\\b", "driving licence number", "provide"] },
  { key: "licenceNumber", scope: "person", weight: 3, patterns: ["(licence|license) number", "driving (licence|license) no"] },
  { key: "licenceDate", scope: "person", weight: 3, patterns: ["date.*(you|they) obtain.*(motorbike|motorcycle|bike) (licence|license)", "date.*(licence|license).*(obtained|issued|passed)", "when did (you|they) (pass|get|obtain)", "(licence|license).*(obtained|since|date)", "date you passed", "test pass date", "cbt date"], negative: ["\\bcar\\b"] },
  { key: "licenceYearsHeld", scope: "person", weight: 3, patterns: ["how long.*(held|had).*(licence|license)", "years.*(licence|license) held", "(licence|license) held for"] },
  { key: "licenceCountry", scope: "person", patterns: ["country of issue", "where.*(licence|license) issued", "(licence|license) country"] },
  { key: "advancedRiding", scope: "person", weight: 2, patterns: ["advanced (riding|rider|motorcycle) (qualification|training|test)?", "additional qualifications", "bikesafe", "rospa", "\\biam\\b"] },
  { key: "ukResidentSince", scope: "person", weight: 2, patterns: ["resident.*(since|from)", "(living|lived) in the uk since", "uk resident"], negative: ["since birth", "born"] },
  { key: "ukResidentYears", scope: "person", patterns: ["how long.*(lived|resident).*uk", "years.*uk resident"] },
  { key: "bornInUk", scope: "person", weight: 3, patterns: ["resident since birth", "born in the uk", "uk born", "(uk|british) by birth"] },
  { key: "hasClaims", scope: "person", weight: 2, patterns: ["(any|had any).*(claims|accidents|losses)", "claims in the last", "made a claim", "accidents.*last \\d"] },
  { key: "claimsCount", scope: "person", patterns: ["how many claims", "number of claims"] },
  { key: "hasConvictions", scope: "person", weight: 2, patterns: ["(any|had any).*(motoring )?convictions", "convictions.*last \\d", "penalty points", "driving offences", "motoring offences"] },
  { key: "convictionsCount", scope: "person", patterns: ["how many convictions", "number of convictions"] },
  { key: "totalPoints", scope: "person", patterns: ["how many points", "number of points", "total points"] },
  { key: "nonMotoringConvictions", scope: "person", patterns: ["non.?motoring convictions", "criminal convictions", "unspent convictions"] },
  { key: "medicalConditions", scope: "person", weight: 2, patterns: ["medical condition", "dvla report(able|ed) .*(condition|disabilit)", "notify(ing)? the dvla", "health condition", "declared to the dvla", "disabilit(y|ies)"] },
  { key: "insuranceRefused", scope: "person", weight: 2, patterns: ["(refused|declined|cancelled|voided).*insurance", "insurance (declined|refused|cancelled)", "insurance.*(refused|declined|cancelled)", "special terms"] },
  { key: "ncbYears", scope: "person", weight: 3, patterns: ["(motorbike|motorcycle|bike) no.?claims (bonus|discount)", "no.?claims (bonus|discount)", "\\bncb\\b", "\\bncd\\b", "years.*no.?claims", "how many years.*bonus"], negative: ["\\bcar\\b", "protect"] },
  { key: "ncbProtected", scope: "person", patterns: ["no.?claims.*protected", "protected bonus"] },

  // ---- One claim, one row -----------------------------------------------
  { key: "claimDate", scope: "claim", weight: 4, patterns: ["date did (this|the) (incident|claim|accident) occur", "date of (the )?(incident|claim|loss|accident)", "when did (this|the) (incident|claim) (occur|happen)"] },
  { key: "claimDescription", scope: "claim", weight: 4, patterns: ["cause or description", "(cause|type) of (the )?claim", "what happened", "claim type", "nature of (the )?claim"] },
  { key: "claimFault", scope: "claim", weight: 4, patterns: ["(were|was) (you|they).*at fault", "at.?fault", "found to be at fault", "fault claim"] },
  { key: "claimOwnCost", scope: "claim", weight: 4, patterns: ["cost of the claim to your vehicle", "cost.*(your|own) vehicle", "damage to your (own )?(vehicle|bike)"] },
  { key: "claimThirdPartyCost", scope: "claim", weight: 4, patterns: ["third party claim", "cost of the third party"] },
  { key: "claimPersonalInjury", scope: "claim", weight: 4, patterns: ["personal injury", "anyone else suffer", "(were|was) anyone injured"] },
  { key: "claimOnCurrentPolicy", scope: "claim", weight: 4, patterns: ["occur on your current or most recent", "on (your|the) current policy", "most recent (motorbike )?insurance policy"] },

  // ---- One conviction, one row ------------------------------------------
  { key: "convictionDate", scope: "conviction", weight: 4, patterns: ["date of (the )?(conviction|offence|offense)", "when did the offence"] },
  { key: "convictionCode", scope: "conviction", weight: 4, patterns: ["(conviction|offence|offense) code", "offence type", "which offence"] },
  { key: "convictionPoints", scope: "conviction", weight: 4, patterns: ["how many points", "penalty points (received|given)", "points (received|awarded)"] },
  { key: "convictionFine", scope: "conviction", weight: 4, patterns: ["fine (amount|received)", "how much.*fine"] },
  { key: "convictionBan", scope: "conviction", weight: 4, patterns: ["(disqualif|ban)", "were you banned"] },
  { key: "convictionBanMonths", scope: "conviction", weight: 4, patterns: ["(length|months).*(ban|disqualif)", "how long.*(ban|disqualif)"] },
];

/** Wording that marks a form section as being about an additional rider. */
export const ADDITIONAL_RIDER_MARKERS = [
  "additional rider",
  "additional driver",
  "other rider",
  "other driver",
  "named rider",
  "named driver",
  "second rider",
  "rider 2",
  "driver 2",
  "about them",
  "their details",
];
