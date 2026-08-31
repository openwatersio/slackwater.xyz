# Canadian station pages: identity, stubs, and the on-request curve

Follow-up to `2026-08-30-station-pages-design.md`, whose section "Canadian stations
cannot be rendered from bundled data" left 1,082 CHS stations out of the corpus and
listed three open questions. This document answers those questions and designs the
work. Tracked as issue #17.

The first design covered the 3,607 stations buildable from published data. This one
covers the rest.

## The constraint that governs everything

`slackwater-ios/Slackwater/ChsStation.swift:6` states the posture:

> the app ships identity we authored. CHS predictions are fetched by each user
> under DFO's own terms, fitted on-device, stored locally, and **never re-served**.
> No CHS data is bundled.

Concretely, for this site:

- **The visitor's browser fetches `api-iwls.dfo-mpo.gc.ca` directly.** Verified:
  it answers a cross-origin request with `access-control-allow-origin: *`.
- **Never proxy IWLS through the Worker**, for CORS or for anything else. The
  moment we fetch, we are the fetcher and the posture breaks. Reaching for a CORS
  proxy is a reflex; it is the single easiest mistake to make on this work.
- **Never prerender a CHS curve.** A prerendered curve is a published prediction.
- **Never bundle the IWLS station id.** It resolves at runtime from position.

If a reason to relax any of these appears, it is a question for the owner, not a
call to take while implementing.

## What changed since the first design

The first design assumed the CHS curve meant porting the on-device fitter to the
browser: `chs-bundle.js` at 120 KB, a 60- or 210-day sample fetch, and a wait long
enough that the interaction had to be built around apologising for it.

None of that is needed, and the evidence is in the app's own data.

### `fitDays: 0` means the fit failed, not that the fit is free

The first design guessed that the nine gates carrying `fitDays: 0` might be derived
gates needing no fit — a fast tier. They are the opposite. `gen-chs-gates.mjs`
documents them in its `ONLINE` map: nine gates that **failed the fit-validation bar**
and ship anyway as identities

> backed by official CHS predictions fetched on demand rather than an on-device fit
> (online-gates spec §1: findable, never fitted, never provisional).

So the app already has a no-fit path, and it runs at the hardest water in the corpus:
Nakwakto Rapids, Sechelt (Skookumchuck), Dent, Gabriola, Beazley, Second Narrows,
Tillicum Bridge, Juan de Fuca East, Masset Sound.

### The fitter exists for offline, and the web is not offline

The fit is what lets the app answer with no signal, weeks ahead, on a boat. A web
page has a network by definition — it is how the reader got there. **Every reason the
fitter exists is absent on the web.** The page fetches the day it is showing and draws
DFO's own published numbers.

This is not a compromise against the first design's promise that the page renders the
real curve. It renders a *more* authoritative curve than the app's: DFO's published
prediction rather than a harmonic model fitted to it.

### DFO publishes exactly the two shapes this repo already has

`src/lib/predict.ts` defines `Sample { time, level }` and
`StationEvent { kind: 'slack' | 'flood' | 'ebb', time, level }`. IWLS serves both,
with no lossy mapping:

| IWLS series | Becomes | Notes |
|---|---|---|
| `wcsp1` speed + `wcdp1` direction | `Sample[]` | Signed by projecting onto the flood axis |
| `wcp1-events` | `StationEvent[]` | `SLACK` → `slack`, `EXTREMA_FLOOD` → `flood`, `EXTREMA_EBB` → `ebb` |
| `wlp` | `Sample[]` | Water level predictions |
| `wlp-hilo` | high/low markers | The published highs and lows |

The current sign comes from direction, not from the speed value, which is an unsigned
magnitude. Projecting onto the flood axis — `speed * cos(direction − floodDirection)`
— is what `fitCurrent` does on device, and `floodDirection` comes from IWLS
`/stations/<id>/metadata`. **Getting this wrong swaps flood and ebb**, which is a
mariner-visible error and colours the whole page wrong, so it carries a test with real
numbers rather than a shape assertion.

### Verified against the live API

All figures below were measured against `api-iwls.dfo-mpo.gc.ca` on 2026-08-31, not
assumed.

**Position resolution works for the whole corpus**, so the provider id never has to be
bundled:

```
current gates   22/22 resolved within 3 km   (worst 0.17 km, Quatsino Narrows)
tide ports    1058/1058 resolved within 3 km  (against the 1,088 wlp-serving stations)
```

**Every station serves what its page needs.** All 22 gates offer
`wcsp1|wcdp1|wcp1-events`; all 1,058 ports offer `wlp` and `wlp-hilo`.

**One day costs one request and about 12 KB.** Dodd Narrows, 1 September 2026:
`wcsp1` is natively 15-minute, so one day is 97 samples and 12,310 bytes in ~0.3 s,
plus 8 published events. Tide ports need the `resolution=FIFTEEN_MINUTES` parameter:
`wlp` is 1-minute native, so a Victoria day is 1,441 samples and 182,834 bytes without
it and 12,314 bytes with it.

The one real cost is resolution itself: `/stations` is 851,671 bytes for 1,575
stations, and it is the only way to turn a position into an id without shipping a
provider-minted identifier. It is fetched from DFO, cached by the browser, and only on
the explicit action. `?code=<chs code>` returns a single 866-byte record, but the code
is provider-minted and bundling it would breach the same rule as the id, so the full
list is the correct cost to pay.

### One difference to state plainly

For the 13 gates the app *does* fit, the web will draw DFO's published curve while the
app draws its own fitted model. They differ — within the validation bar the fit was
held to (slack median ≤15 min, worst ≤30). Anyone comparing the two surfaces at Dodd
Narrows will see small disagreements. The web's numbers are the authoritative ones.
This is worth knowing, not hiding, and it is not a defect in either surface.

## The corpus, counted

`slugs.json` carries 1,082 CHS ids — 1,058 tide and 24 current. The 24 current ids
account for:

| | Count | Where identity lives today |
|---|---|---|
| Validated gates (fitted on device) | 13 | `chs-current-gates.json` |
| Online gates (`fitDays: 0`, fit failed) | 9 | `chs-current-gates.json` |
| `chs-malibu-rapids` (derived: reference port + fixed lag) | 1 | `chs-gates.json` |
| `chs-arran-rapids` | 1 | **nowhere** |

`chs-arran-rapids` has no identity in any bundle file, because `gen-chs-gates.mjs`
excludes it fully — a hazard call ("wrong water under a trusted name"), not a
fittability one. It is **out of scope for this work** by owner decision and needs its
own issue before the curve ships. It cannot be stubbed without someone authoring
identity for it, which is precisely the decision being deferred.

So this work builds **1,081** pages: 1,058 tide ports + 22 gates + `chs-malibu-rapids`.

Afterwards, two registry-style slugs still 404: `chs-arran-rapids` (deferred) and
`noaa-boundary-pass` (which shares the `boundary-pass` slug with `noaa/PUG1717` in
4.1.2 — see Sequencing).

## Project A — publish CHS identity

Blocks everything else. 1,048 of the 1,082 have identity only in
`slackwater-ios/Slackwater/Resources/chs-stations.json`, which this repo's CI never
checks out.

**Home: a generated `data/chs-stations.json` artifact in `@openwaters/station-metadata`.**

That package is the right home because the generator is already its consumer.
`gen-chs-stations.mjs` depends on `station-corrections`/`station-metadata` for the
registry and for the national places gazetteer that derives every region label. Moving
it in is bringing it home rather than importing something foreign. It is also the
smallest possible consumer diff: `slackwater.xyz` already imports
`@openwaters/station-metadata/data/slugs.json` (`src/lib/catalogue.ts:5`), so reading
identity from the same package adds no dependency at all.

### The artifact

One file covering both kinds, mirroring the fields the two iOS resources already
carry, and nothing more:

- Ports and gates: `id`, `kind`, `name`, `region`, `aliases`, `latitude`,
  `longitude`, `timezone`.
- Gates additionally: `tideReference` where the registry pairs one, and
  `magnitudeNote` where it carries one.
- Derived gates (`chs-malibu-rapids`) additionally: `reference`, `referenceName`,
  `hwLagMinutes`, `lwLagMinutes`.

Deliberately **absent**:

- **The IWLS station id and the CHS station code.** Both provider-minted. Resolution
  is by position at runtime, 3 km tolerance, exactly as on device.
- **`fitDays`, `provisionalSlackMinutes`, `online`, `onlineNote`.** These describe the
  on-device fit, which the web does not have. `onlineNote` is app copy — "Slackwater's
  on-device model missed…" — and is false on a page that shows DFO's own numbers.
- **`chs-arran-rapids`.**

### Guard: generated ids must match the published slugs

`slugs.json` already allocated permanent slugs for all 1,082 CHS ids, from a run that
was handed the iOS catalogue files as input. If the generator running inside
`station-metadata` mints even one id differently, that station's permanent slug moves
— and the allocator's collision ladder will make the result look plausible rather than
broken. A test asserts the generated id set equals the CHS keys of `slugs.json`
exactly, in both directions.

A second assertion, in the same test: **the CHS slugs must be distinct.** That fails
against 4.1.2 as published — three CHS tide ports share a slug with a curated twin
(see Sequencing) — which makes it the cheapest available regression test for the
upstream fix, and stops Project B from being built on a table that cannot support it.

### CONTRIBUTING

The rule "never copy a provider station export or add a provider-minted identifier"
must keep holding. The artifact complies — curated names win from the registry,
regions come from the package's own gazetteer, ids are minted by its own slug rules,
and no provider identifier ships — but a generated identity artifact sitting beside a
hand-curated registry needs saying out loud, or the next reader reasonably concludes
one of the two is a mistake.

## Project B — 1,081 stub pages

Identity only: name, region, position, what the station is, Nearby, install CTA. No
prediction and no DFO fetch. Prerendered and indexable like the rest of the corpus.
This is what stops `/currents/dodd-narrows` returning a 404 — the URL
`slackwater-ios#187` opens with.

### Catalogue

`isBuildable(id)` currently answers one question with one rule: an id containing `/`
comes from a provider package that carries constituents. That rule stays true and
stays the right shape; what changes is that a station without constituents is now
buildable as identity. `Station.constituents` becomes optional, and `loadCatalogue`
gains a third source alongside the tide database and the current bundle.

The existing throw — a slug with no data is a broken corpus, not a station to skip —
must survive: a CHS slug with no row in `chs-stations.json` is the same class of
disagreement between the slug table and the data, and must fail the build rather than
silently drop a page.

### What the rest of the corpus inherits

- **Nearby.** CHS stations join `neighbourMap`, which goes from 3,607 to 4,688
  stations. It is O(n²) by design and documented as such; distance calculations go
  from ~13M to ~22M, about 1.7x. It runs once, so this is expected to stay around a
  second — but issue #30 exists because exactly this kind of cost shipped inside a
  green check, so it gets measured rather than reasoned about.
- **Sitemaps.** +1,081 URLs, automatic from `buildSitemaps`.
- **OG cards.** Worker-rendered, and a CHS card has no curve to draw. It needs an
  identity-only variant. The last OG defect was text overlapping the station name, so
  this one is checked by opening the PNG.
- **Prerender.** +1,081 pages.

### The browse index, and why it is in this PR

`/stations/tides/` is already 573,000 bytes raw and 101,050 gzipped. Adding 1,058 rows
makes it materially worse, so the fix goes in the same change rather than being left
behind as a quiet regression.

Measured on the live page: **195,954 of the 573,000 bytes are inline script**, and the
largest single block is TanStack's router dehydration payload, carrying every station
name a second time. The page is 2,765 static `<a>` elements and hydrates into nothing
interactive, so that payload buys nothing.

Dropping it — the route renders its rows without a loader whose data must be
serialised for the client — removes about a third of the page, which roughly cancels
the growth from 1,058 new rows rather than merely softening it. Splitting the index by
letter is the durable answer if it grows again; it is not needed now, and it costs ~26
new URLs per kind plus a navigation design, so it stays unbuilt.

The station counts in `stations.index.tsx` and its meta description are hard-coded
("2,765 worldwide", "842 across the US and Canada") and go stale in this PR.

### Copy that becomes false

`AGENTS.md` states the corpus is 3,607 of 4,690 and that `/currents/dodd-narrows`
genuinely 404s. Both stop being true here and are updated in the same change.

## Project C — the curve, on explicit request

A separate PR. Steps B and C are independently useful and independently reviewable.

On a deliberate action by the visitor — never on load, never automatically — the page
fetches DFO directly and draws the curve.

### Flow

1. `GET /stations` (851 KB, browser-cached), resolve nearest within 3 km. Fail
   visibly past tolerance rather than drawing the wrong water.
2. Current gates only: `GET /stations/<id>/metadata` for `floodDirection`.
3. The series for the displayed window, at `resolution=FIFTEEN_MINUTES`:
   `wcsp1` + `wcdp1` + `wcp1-events` for a gate, `wlp` + `wlp-hilo` for a port.
4. Sign the current samples onto the flood axis; convert tide heights.
5. Hand `Sample[]` and `StationEvent[]` to the existing curve components.

Every request is a plain browser `fetch()`. Nothing touches the Worker. Nothing is
stored by us.

### The seam in the curve components

`TideCurve` and `CurrentCurve` each call `predictSeries(station, start, hours)` in one
place. Each gains an optional `samples` prop that defaults to that call. The NOAA path
synthesises at build; the CHS path supplies fetched samples at runtime. Same component,
same drawing code, same colour ramp.

`CurrentCurve` also derives events via `findEvents`. For CHS these arrive from
`wcp1-events` — DFO's own published slacks — so the derived-events path is bypassed
rather than duplicated. This is the better data: `findEvents` interpolates slack from
sign changes, while DFO publishes the slack time directly.

### Units and datum

DFO publishes heights in **metres on chart datum**. The site speaks feet, and every
existing tide page is MSL-relative (which is why its lows read negative).

CHS pages convert to **feet on chart datum**, with the datum named on the page. One
unit across the whole site, and chart datum is what a mariner reads off a chart — but
a CHS page will not compare like-for-like with a NOAA page, so the page has to say
which datum it is on. The conversion happens once, where provider data enters, exactly
as `FEET_PER_METRE` does in `catalogue.ts`: labelling a metre "ft" is wrong by 3.28x,
looks entirely plausible, and has already shipped here once.

### Privacy

`src/content/privacy.md` is a promise, not boilerplate, and this action makes the
visitor's browser contact a third party. It is updated in the same commit or the
policy is false.

### Deferred within C

`chs-malibu-rapids` is derived — no IWLS current station of its own, slack being the
reference port's high and low water plus a fixed lag. Its page stubs in Project B like
any other; its curve is a different computation and can land separately.

## Sequencing, and a landmine already in the published package

`@openwaters/station-metadata` **4.1.2 is published and `main` already depends on it**
(`7b32275`). It reassigned five slugs to resolve the duplicate identities found by a
position sweep — but it reassigned them **without retiring the twins**, so four slugs
are now claimed by two station ids each. Verified by reading the published 4.1.2
artifact:

```
tide     3823 slugs, 3820 distinct — 3 colliding
  point-atkinson <- chs-point-atkinson + chs-point-atkinson-2
  vancouver      <- chs-vancouver     + chs-vancouver-2
  victoria       <- chs-victoria      + chs-victoria-harbour
current   867 slugs,  866 distinct — 1 colliding
  boundary-pass  <- noaa-boundary-pass + noaa/PUG1717
```

**Three of the four are CHS tide ports, and this work is what detonates them.** They
are invisible today only because `isBuildable` excludes every id without a `/`, so
both halves of each pair are skipped. Project B makes them buildable, and then:

- `catalogue-server.ts` indexes stations in a `Map` keyed `${kind}/${slug}`, so the
  second of each pair **silently overwrites the first**. One page survives, showing
  one of two stations, with no error raised.
- `buildSitemaps` emits the duplicate URL twice.
- Every count stays green. 3,823 slugs, 3,823 rows, 200 on every URL. This is the
  same failure shape as the four defects listed under Verification: structurally
  perfect, wrong on the page.

Issue #17's second comment observed that "a slug-uniqueness check will never catch
this, because the slugs are unique". That was true of 4.0.0. It is no longer true —
in 4.1.2 the slugs are *not* unique, so a plain uniqueness assertion over the
published table now catches all four. That check belongs in `station-metadata` CI,
and it is cheap.

**Project B is blocked until this is resolved upstream.** The fix is the half of the
retirement that did not ship: each pair collapses to one id, with the loser
tombstoned rather than left in the table. Which id survives is an owner decision, not
one to take from here — `slug-tombstones.json` is empty in 4.1.2, so nothing has been
retired yet.

Project A is *not* blocked. It can be built and tested against 4.1.2 as published,
because its guard is that generated ids match the CHS keys of `slugs.json`, and the
keys are correct — it is the values that collide. That guard gains a second
assertion: the CHS slugs must also be **distinct**, which fails today and is the
cheapest possible regression test for the fix.

### Already-shipped collateral, adjacent but not this work

The same reassignment moved `boundary-pass` from `noaa-boundary-pass` to
`noaa/PUG1717`, which is the buildable half. So `/currents/boundary-pass` now returns
200 — and **`/currents/turn-point`, which was prerendered, live and in the sitemap,
now 404s with no redirect.** Confirmed against production: the live
`sitemap-currents.xml` lists `boundary-pass` and no longer lists `turn-point`.

The first design's indexation section says canonical URLs must be the ones that
return 200. An indexed URL that became a 404 wants a redirect, and that is worth its
own issue. It is not #17's to fix, but #17 must not be built on the assumption that
the slug table is settled.

### Order

**A → B → C.** A blocks both and can start now. B additionally waits on the collision
fix upstream. B and C are otherwise separable.

## Rebasing on the currents chart rework

PR #36 (`feat/slack-window-band`) rewrites the currents visualisation and lands
before this work. It replaces `src/lib/ramp.ts` outright: `RAMP`, `rampT`,
`rampColor` and `speedInk` are gone, replaced by `SPEED_STOPS` and `speedColor(t)`,
with the ramp corrected from a six-stop navy→yellow inferno to the app's four stops
(yellow→orange→red). The fill now starts at ±`slackThreshold` rather than the zero
line, with a vertical gradient against the auto-fitted plot.

CHS current gates render through that same `CurrentCurve`, so nothing here should
import the old ramp surface, and any colour described in this document defers to
whatever #36 lands.

**One consequence lands directly on a CHS page.** A derived gate with no slack
windows draws the band with no inked green run — the page shows a band and nothing
else. iOS keeps a hairline tick at the slack instant for that case and the web has no
equivalent yet. `chs-malibu-rapids` is exactly that shape: derived from a reference
port's high and low water plus a fixed lag. It stubs fine in Project B; it is a
question for Project C, and an argument for keeping its curve in a separate change.

## Verification

Four defects reached production during the first station-pages work, and every one
passed its automated checks: heights in metres labelled feet, instant URLs rendering a
frozen build-time moment, pages with no CTA and no links, and an OG card with
overlapping text. Counts, HTTP statuses, byte sizes and structural assertions were
green each time. What caught them was reading a rendered number and opening the PNG.

So:

- **Assert on values a mariner would read.** For any rendered Canadian curve, check
  heights and slack times against DFO's own published predictions for that station,
  and name the stations checked in the PR. Dodd Narrows and Victoria are the two
  already verified by hand here and are the natural first two.
- **Flood and ebb must be checked by sign, not by shape.** A test with real
  direction values, because a sign error swaps them everywhere at once.
- **Measure build wall-clock and prerender p95 before and after**, per issue #30. A
  quadratic per-page cost shipped last week and broke the deploy as a workerd
  "Broken pipe" two PRs later, while a 7x slowdown sat inside a green check.
- **Verify against a real Worker**, not `pnpm dev` — Worker-owned routes do not
  resolve in the dev server:
  `pnpm build && npx wrangler dev -c .output/server/wrangler.json`.
- **Open the OG PNG.**

## Things that will bite

- A server route handler must **return** a `Response`. A thrown `notFound()`
  serialises as a 200 with `{"isNotFound":true}`.
- The catalogue must not reach the client bundle — `src/lib/bundle-size.test.ts`
  guards it. Route loaders are isomorphic; `createServerFn` is the boundary that
  code-splits, `createServerOnlyFn` is not. Project B adds a data source behind that
  same boundary and Project C adds client-side code that must not import it.
- Instant routes use a `$slug_` trailing underscore to opt out of nesting. Do not tidy
  it away; `src/routes/instant-page.test.tsx` explains why. CHS instant URLs inherit
  it, and a CHS instant page still renders no curve.
- IWLS documents caps of 3 requests/second and 30/minute. One visitor asking for one
  station is five requests at most and nowhere near them, but nothing should ever loop
  over stations client-side.

## Open questions

- **`chs-arran-rapids`.** Deferred by owner decision. The app excludes it fully as a
  hazard call; the web fetching official DFO predictions is arguably a different
  question from shipping a bad fit. Two surfaces disagreeing about whether a hazard is
  nameable must be a decision someone makes, not a side effect of a slug table. Needs
  its own issue, resolved before Project C.
- **Whether the fitted gates' pages should say anything about the app's model
  differing from DFO's published curve.** Probably not — the page shows DFO's numbers
  and says so — but it is the kind of thing worth one look once a page exists.
- **Which id survives each of the three colliding CHS tide pairs**, and whether
  `/currents/turn-point` gets a redirect now that `boundary-pass` has taken its slug.
  Both are owner decisions in `station-metadata`, and the first one blocks Project B.
