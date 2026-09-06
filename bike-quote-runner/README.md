# bike-quote-runner

Work out which bike you can actually get insured on, without retyping your life
story into forty boxes for every bike, on every site, every time.

Point it at a bike (a reg, a listing link, or a screenshot), pick which version
of your circumstances you want to test, and it opens the quote journey with all
your answers armed. You drive, it types. Then it records what came back and
tells you which bikes are cheap, which insurers won't touch you, and which of
your levers actually moved the price.

```
  BIKE                              CHEAPEST MEDIAN   BEST FROM         QUOTES
  2021 Honda CB500F                 £355     £395     Bennetts          4 priced
  2019 Yamaha MT-07                 £505     £618     Devitt            5 priced
  2020 Kawasaki Z900                £1102    £1295    Devitt            3 priced, 1 declined

  What actually moves the price
  Address   worth £237, over 3 like-for-like comparisons
    parents                 best  n=3
    home            +£237   ████████████████████  n=3
```

## What it does and does not do

It fills forms. It does not submit them, click through consent, solve a
challenge, or run while you are not there. The browser opens on your screen, in
your own session, with your own true details, and stops wherever you stop. That
is deliberate: unattended scraping of aggregator sites breaches their terms and
gets you blocked within a run or two, and a premium obtained by fudging an
answer is not a premium, it is a voided policy waiting to happen.

So the loop is: it does the typing, you do the clicking and the reading.
Realistically that turns a twelve minute journey into about three.

## Setup

```bash
npm install
npx playwright install chromium     # once
npm run bqr -- init
```

Then open `config/profile.yaml` and fill it in properly. This is the whole point
of the tool: answer everything once, honestly, and never type it again. It holds
you, any additional riders (your dad), and every address the bike could
genuinely be kept at.

`config/profile.yaml`, `config/scenarios.yaml` and everything under `data/` are
gitignored. Your licence number and date of birth stay on your machine.

### Optional keys

Neither is required, but each unlocks a way of adding bikes:

| Key | Gets you | Where |
|---|---|---|
| `DVLA_API_KEY` | reg lookup: make, year, engine size, straight from the DVLA | [DVLA developer portal](https://developer-portal.driver-vehicle-licensing.api.gov.uk) (free) |
| `ANTHROPIC_API_KEY` | pulling bike details out of a listing URL or a screenshot | [console.anthropic.com](https://console.anthropic.com) |

Set them as environment variables, or put them in `profile.yaml` under
`apiKeys`. Without either you can still add bikes with `bqr bike add --manual`.

## Adding bikes

```bash
npm run bqr -- bike add LN68 XYZ                              # a registration
npm run bqr -- bike add https://www.autotrader.co.uk/...      # a listing link
npm run bqr -- bike add ~/Desktop/that-advert.png             # a screenshot
npm run bqr -- bike add --manual                              # type it in
```

A reg goes to the DVLA, which is authoritative on make, year and engine size but
does not return a model name, so it will ask you for that. A link or a
screenshot gets read for model, price, mileage and modifications, and if a plate
is visible the DVLA confirms the rest.

Anything it could not work out is listed as a gap, and it offers to ask you.
Fix things later with:

```bash
npm run bqr -- bike edit 2019-yamaha-mt-07 --set value=5200 model="MT-07"
```

### The awkward bits it handles

Real journeys ask things a flat list of answers cannot express, so the profile
models them properly:

- **Claims and convictions repeat.** They are asked one numbered block at a
  time ("Claim 1", "Claim 2"), and each block gets the right row's date, cause,
  fault and costs rather than the first one's.
- **A car licence is its own thing.** Its date, and mirrored car no-claims, are
  worth real money on a bike policy and are asked separately from your bike
  licence. Nothing gets crossed over.
- **Security is a product, not a yes/no.** Journeys want you to pick "Datatool
  Stealth" or "Honda HISS2 INJ (Thatcham 2)" from a list, so write the exact
  wording in `security:` and it selects it.
- **Additional riders get their own section**, and their fields are filled from
  that rider, not from you.

## Scenarios: the bit that finds the money

`config/scenarios.yaml` lists the levers you want to sweep. Same bike, same you,
different shape of the question:

```yaml
axes:
  addressId: [home, parents]
  namedRiders: [[], [dad]]
  policyStartOffsetDays: [1, 14, 21, 29]
  voluntaryExcess: [150, 250, 500]
priority: [namedRiders, addressId, policyStartOffsetDays]
maxRuns: 12
```

`bqr plan` expands that into concrete runs. The full grid is usually hundreds,
so `maxRuns` caps it and `priority` decides what survives: the budget is spent
top-down, and a trimmed axis keeps its extremes rather than its first few
values, because the ends are where the price moves.

Every axis is something you can honestly vary. Where the bike is kept, who else
rides it, how far ahead you buy. None of them is a lie, and none of them should
become one.

## Running a quote

```bash
npm run bqr -- run
```

Pick a bike, a scenario and a site. A browser opens and starts filling. Then:

- **Alt+F** fill the page again, after each step of a multi-page journey
- **Alt+P** grab every price on screen and send it back to the terminal
- the panel bottom right lists anything it could not fill, with the answer to
  type, click to copy

Close the browser when you are done and it asks what to record, including
"declined", which is a genuinely useful result when you are working out which
bikes are insurable at all.

Each site keeps its own browser profile under `.browser-profiles/`, so cookie
banners and consent stay accepted between runs.

## Reading the results

```bash
npm run bqr -- compare     # ranked bikes, plus which levers paid
npm run bqr -- report      # the same thing as HTML
```

The lever analysis only compares quotes that share the same bike, the same site,
and identical settings on every other axis. Averaging across everything reverses
its own answer as soon as you happen to quote one bike more often at one
address, which is exactly what happens when you follow the promising leads
instead of running a balanced grid.

## When a field does not fill

Matching is done against the question text a human reads, not CSS selectors,
because aggregator markup gets rewritten constantly while the questions have
been the same for twenty years. When a site does change its wording:

```bash
npm run probe -- https://www.comparethemarket.com/bike-insurance/
```

Navigate to the step that misbehaved, press Enter, and it prints every control
on the page, the question text it read, and which of your answers it matched.
Anything marked `?` needs one more pattern in `src/autofill/knowledge.ts`. That
file is the whole vocabulary, and adding a line to it is the normal maintenance.

It prefers an empty box to a wrong one. A field it cannot identify is left for
you and listed in the panel, rather than guessed at from the wording of the
question next to it.

```bash
npm test          # 101 fields across two realistic journeys, including
                  # repeating claim blocks and an additional-rider section
```

## Commands

```
bqr init                      write the config templates
bqr bike add <reg|url|image>  add a bike (--manual to type it)
bqr bike list | edit | rm     manage them
bqr plan                      show the scenarios your config expands to
bqr answers -b <bike>         print every answer, to fill something by hand
bqr run                       open a quote journey with answers armed
bqr quote add                 record a premium you got elsewhere
bqr quote list | rm           manage recorded quotes
bqr compare                   rank bikes, show which levers paid
bqr report                    write data/reports/report.html
bqr sites                     the quote sites it knows about
```

Add `-- ` after `npm run bqr` when passing flags, or `npm link` once and just
type `bqr`.

## A note on honesty

Every answer this tool types is one you gave it. Insurers price on the truth,
and the levers here are real choices about where the bike lives, who rides it,
and when you buy, not creative ways of describing them. Getting a cheaper quote
by shading an answer buys you a policy that does not pay out.
