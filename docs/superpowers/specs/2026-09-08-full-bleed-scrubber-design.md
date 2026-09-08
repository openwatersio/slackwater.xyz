# The landing page as the app's scrubber

The landing page opens on a full-bleed rendering of the app's scrub view: the sky over a tidal curve, filling the viewport. It loads at night, scrubs forward through dawn over about six seconds, and comes to rest a couple of hours after sunrise. It is not interactive — there is nothing to drag and nothing to tap on the curve. Scrolling past it reaches the sections the page already carries.

Where the app puts the station's name, this page puts a pill: the wordmark, the one-line claim, and the TestFlight call to action.

This is the same argument the page has always made, made harder. The hero computes a real prediction for a real station from bundled harmonic constituents, and the sky over it is real astronomy for the visitor's own date. Nothing is fetched to draw either one.

The landing page is the first consumer of these modules, not the only one. The 3,640 station pages take the same sky and the same scrub strip in a later spec, so the boundaries below are drawn for reuse even though only `ScrubHero` crosses them today.

## What the reader sees

A single `100dvh` section, full-bleed, outside the `max-w-5xl` container that holds everything below it. `dvh` rather than `vh` because iOS Safari's toolbar changes the viewport height mid-scroll and `vh` does not follow it.

Top to bottom:

- The sky fills the section.
- The curve strip occupies the bottom band — 22% of the height, floored at 140px and capped at 220px. The app's plot is 150pt of an 850pt screen, so this is the same proportion at any viewport.
- The horizon sits 16px inside the strip's top edge. This is the app's `skyHorizonOverlap`, and it is what lets a rising sun's glow reach the water and keeps a high peak from covering a body that is only a few degrees up.
- The lead readout floats immediately above the strip, horizontally centered — where `TimelineScrubStrip` puts it with `.overlay(alignment: .top)`.
- The pill sits near the top, centered, in the position `DetailHeader` gives the station name.
- A caption runs along the bottom edge, with a chevron as the scroll cue.

The time axis fits **24 hours across the viewport width**. The app is a fixed 18pt per hour, which at phone width is about 21 hours; fitting 24 hours matches that on a phone and, unlike a fixed rate, does not flatten the curve into a straight line on a 1440px display.

## The sky is drawn on canvas, the curve stays SVG

The stars, the sun disc and glow, and the moon glyph are drawn on a `<canvas>` that redraws each frame. The gradient behind them is a DOM element whose two stops are written from `skyPaint(sunAltitude)`. The curve is SVG and pans by a single `transform` write per frame.

The split is what keeps the page's central claim true. The SVG curve prerenders, so a reader who has not run JavaScript — a crawler, an unfurl scraper, anyone on a slow first paint — already has a real curve against a real night gradient. Drawing everything on one canvas is less code and would be faster, but it makes the hero a blank rectangle until JavaScript runs, on a page whose pitch is that it loads instantly, and it takes the curve away from exactly the readers the station corpus exists to serve.

The canvas is `aria-hidden`, matching `SkyBackdrop`'s own `.accessibilityHidden(true)`. The curve keeps an aria label.

Baking the frames at build time is faster still and is rejected outright: the moon phase and the sunrise are only worth showing because they are *today's*. Frozen to build day they drift out of true within a week, and the page starts asserting something false.

### Cost

Recomputing the entire sky — 288 stars, the sun, the moon, and the moon's illumination — from `@openwaters/almanac` for a fresh timestamp costs **0.34 ms per frame** measured in Node. That is comfortably inside a 16 ms frame, so the sky recomputes every frame the way the app's does. No keyframing, no interpolation, no throttling.

## The sky port

`src/lib/sky.ts` ports the sky math from `slackwater-ios/Slackwater/Theme.swift`, which is the single source of truth. It follows the precedent `src/lib/ramp.ts` set: the Swift's literal values live in a lib table with a comment naming their origin, and the tests assert the Swift's own numbers. That is also what satisfies the no-literal-hexes-in-components rule — these are ported data, not styling.

Ported: `skyPaint` and its five altitude anchors, `skyOpacity`, `starOpacity`, `starTwinkle`, `starHazeOpacity`, `moonGlowRadius`, `moonGlareOpacity`, `moonLightAngle`, `HorizonSpan`, and `skyPoint`.

`src/data/stars.json` is the app's own 7 KB cut of the Yale Bright Star Catalog — 288 stars brighter than magnitude 3.5, as `[ra, dec, mag]` rows — copied across with its provenance recorded.

### The projection comes from the app, not from openwaters.io

`openwaters.io/website/src/components/sky/projection.ts` solves a similar-looking problem and must not be reused here. It is a 360° panorama on the chart convention, east on the left. The app's `skyPoint` fits each body's own rise-to-set azimuth span across the frame width and mirrors it — east on the **right** — because the frame is a timeline rather than a compass: as time advances the curve pans right to left under the fixed centerline, and a body has to sweep with the curve it drives. `Theme.swift` names the difference explicitly.

The two agree on `skyPaint`; `skyColor.ts` uses the same five anchors. They disagree on projection, and the app wins.

### Eclipses are deferred, and the seam is held open

The app's `WindowEclipse` path — the copper umbra, the penumbral wash, the dimming both drive through the gradient — is not ported here. The chance one is underway at the landing page's rest moment is negligible, and the landing page is the only consumer today.

It is deferred rather than declined. An eclipse is one of the things a station page exists to be shared for, so the station-page spec ports it, and two decisions in this design are what keep that cheap:

- **`Sky.tsx` takes the whole `SkyState`, never spread props.** `SkyBackdrop` does the same (`let sky: SkyState`). Eclipse support then adds fields to one object rather than threading new arguments through every caller. This is the single structural choice that decides whether eclipses are a small change or a wide one.
- **The eclipse search belongs in `skyDays`, not `skyState`.** `Theme.swift` is explicit that searching for an eclipse per scrub frame costs orders of magnitude more than the position lookups, which is why its `SkyState` receives an already-found array. `skyDays` is already the once-per-window function, so it is where the search lands.

When it arrives: `skyState` gains the Swift's own defaulted `eclipses` argument, `SkyState` gains `shadow` and `wash`, and `Sky.tsx`'s moon draw reads them for the copper core and the dimmed halo. Nothing in this design has to move. No placeholder argument is added now — an always-empty parameter reads as working support for something that does not exist.

`moonLightAngle` **is** ported. It is about eight lines of trigonometry, and a crescent pointing the wrong way at dawn reads as a bug.

## The scrub clock

`introWindow` builds the window on hydration. Today's local date at the station goes to Almanac's `sunEvents`; the scrub **rests at sunrise + 2h** and **starts at sunrise − 4h**.

Both bodies' rise and set azimuths come from `skyDays`, which is one `sunEvents` and one `moonEvents` call covering the days the window spans, computed once. The app does the same, and its comment gives the reason: an event search costs roughly two orders of magnitude more than a position lookup, so doing one per frame is not an option. That cost is why `skyDays` and `skyState` are separate functions rather than one call that does everything.

`useScrubIntro` drives it: about 0.8 s held at night, so the star field registers before anything moves, then about 5 s eased to rest. It plays once and stops. The rAF loop genuinely ends — at rest the sun is up, `starOpacity` is zero, and there is nothing left to twinkle.

The intro lives in the driver rather than in the strip. A station page scrubbing to the present has no use for a marketing opening, and a strip that assumed one would force it on every page that reused it.

`prefers-reduced-motion: reduce` renders the rest frame immediately and never starts the loop, matching the app's `reduceMotion` handling.

Sunrise − 4h falls within about an hour of solar midnight at mid latitudes, which is dark enough for the star field to carry the opening. At a high-latitude station in June it would not be. The ceiling gets a `ponytail:` comment rather than machinery for a station nobody has chosen.

## Pill, readout, and caption

The pill carries the page's single `<h1>`. The wordmark rule holds — one word, capital S, lowercase w, `whitespace-nowrap`. Under it sit the existing one-line claim and the TestFlight link, with its current null-link fallback intact.

The readout mirrors the app's lead card and follows the scrub: speed and unit, Flooding, Ebbing or Slack, the set, and the countdown to the next slack.

The caption reads `Deception Pass (Narrows) · 7:42 AM · computed in this browser`, with the station name linking to its own page. It is what keeps the hero's claim attached to a named body of water now that the pill has the name's position, and it doubles as the scroll cue.

### The readout and the caption's clock are gated on `live`

Prerendered HTML freezes at `SERVER_NOW`, the literal in `src/lib/use-live-now.ts`. A time rendered into that HTML is stale by however long ago the site was built and drifts further every day, which is the exact failure that file's comment exists to prevent.

So the readout and the caption's time render **only once `live` is true**. Before hydration the reader gets the night sky, the real curve, the pill, and the station's name, and no claim about a clock.

## Station

The hero stays on Deception Pass (Narrows), which `src/data/hero-station.json` already bundles.

Nothing structural depends on that choice, but a tide station is not purely a data swap. Colour is state and form is kind: a tide has no direction, no slack and no speed to ramp, so it needs the tide variant of both the strip's fill and the readout — height, Rising or Falling, and the countdown to the next high or low. `TideCurve` and `CurrentCurve` are separate components here for that reason, and `TideScrubStrip` is a sibling of `CurrentScrubStrip` for the same one. Only the current sibling is built here, because only a current station consumes it; the tide sibling arrives with the station pages.

## Modules

The split is by **cadence** and by **what is landing-page-only**. Anything that runs per frame is separated from anything that runs once per window, because that distinction is the whole performance argument; anything that mentions the pill or the download is kept out of the shared path.

Pure, no React:

- `src/lib/sky.ts` — the `Theme.swift` port described above. Stateless functions over numbers.
- `src/lib/sky-state.ts` — `skyDays(latitude, longitude, from, to)` runs **once per window** and returns the sun's and moon's rise and set times, which are what `HorizonSpan` needs. `skyState({ time, latitude, longitude, days })` runs **once per frame** and returns the positions, the illumination, the placed stars and the paint. The port of the Swift `SkyState` initializer, and its comment about event searches costing two orders of magnitude more than position lookups is the reason these are two functions and not one.
- `src/lib/scrub.ts` — `introWindow(station, date)` and the easing curve.

Components:

- `src/components/Sky.tsx` — the gradient and the canvas, given a `SkyState` and a horizon position. `aria-hidden`, decorative, reusable anywhere a sky is wanted.
- `src/components/CurrentScrubStrip.tsx` — the sky, the panning curve, the centerline and the readout. **The unit the station pages reuse.** It knows a station and a scrub time and nothing about why the scrub time is what it is.
- `src/components/ScrubHero.tsx` — `100dvh`, the pill, the caption, and the intro driver. Landing page only, and deliberately thin.

Driver:

- `src/lib/use-scrub-intro.ts` — the rAF loop, the reduced-motion branch, and the stop condition. Separate from the strip because a station page's scrub time comes from `useLiveNow` rather than from a marketing intro, and welding the intro into the shared component would force every station page to inherit it.

The strip is a component rather than a path drawn inline in `ScrubHero`. `CurrentCurve` is not reused for it: that component draws axis labels, extremes, the datum line and a per-window aria description, none of which a panning strip wants, and a bare mode on it would be a flag that changes what the component fundamentally is.

## Files

New:

- `src/lib/sky.ts`, `src/lib/sky-state.ts`, `src/lib/scrub.ts`, `src/lib/use-scrub-intro.ts`, each with tests
- `src/components/Sky.tsx`, `src/components/CurrentScrubStrip.tsx`, `src/components/ScrubHero.tsx`, the last two with tests
- `src/data/stars.json`

Changed:

- `src/routes/index.tsx` — the hero is replaced by `ScrubHero`. Everything from "Currents, not just tides" down is untouched.
- `package.json` — adds `@openwaters/almanac`.
- `pnpm-workspace.yaml` — adds `@openwaters/almanac@0.3.0` to `minimumReleaseAgeExclude`, alongside the two `@openwaters` pins already there. The release is a day old and pnpm 11 refuses it otherwise.

`src/content/privacy.md` needs no change, and that is a finding rather than an omission: Almanac and `stars.json` are bundled, so the hero issues no network request and measures nothing.

## What the station pages will need

Recorded here so the boundaries hold, and designed in their own spec:

- **The tide sibling.** `TideScrubStrip`, over the same `Sky` and the same centerline frame.
- **Eclipses.** They are a reason a station page gets shared, so they ship with the station pages. The seam is described above; the search goes in `skyDays`.
- **The 33 CHS stations have no curve to pan.** They prerender no prediction, and 32 of them fetch IWLS in the visitor's own browser on load. The sky is unaffected — astronomy is not DFO's data, so it prerenders like anywhere else — which means those pages show a real sky and an empty plot until the fetch lands, alongside the Cancel button that already exists. That is a deliberate design question, not an edge case to discover.
- **The bundle.** Almanac and `stars.json` reach every station page rather than one landing page. The budget in `src/lib/bundle-size.test.ts` is the check.
- **Whatever the share-landing and indexing job needs.** The station pages exist to be linked and crawled; a scrub view must not cost them the content that makes them worth crawling.

## Verification

- `src/lib/sky.test.ts` asserts `skyPaint` at all five anchors and at midpoints between them, `starOpacity`'s clamp at 0.7, `skyOpacity`, `starHazeOpacity`, `moonGlareOpacity` at the touching and clear boundaries, and `skyPoint`'s mirroring in both hemispheres. Every expected value comes from `Theme.swift`.
- `src/lib/sky-state.test.ts` asserts that `skyDays` returns the rise and set times a `HorizonSpan` needs across a multi-day window, and that `skyState` places the sun, the moon and the stars for a known time and place.
- `src/lib/scrub.test.ts` asserts the rest target against the station's local sunrise, the night start, and the easing endpoints. `src/lib/use-scrub-intro.test.ts` asserts that the reduced-motion branch returns the rest frame without starting a loop, and that the loop stops at rest.
- `src/components/CurrentScrubStrip.test.tsx` asserts that the strip renders from a station and a scrub time alone, with no reference to the pill, the intro, or anything else the landing page owns — the test that keeps the reuse boundary honest.
- `src/components/ScrubHero.test.tsx` asserts that a server render carries no time string, that the pill holds the page's only `<h1>`, that the canvas is `aria-hidden`, and that the caption links to the station's page.
- `pnpm test`, `pnpm typecheck`, and `pnpm build`, plus the existing budget in `src/lib/bundle-size.test.ts`.
- The PR preview URL from `.github/workflows/preview.yml`, opened and looked at. A six-second animation is not signed off from a green test run.

## Out of scope

- Interactivity of any kind. No dragging, no tapping, no scroll-driven scrubbing.
- Replaying the scrub.
- Eclipse rendering. Deferred to the station pages, not declined — the seam is held open above.
- Pinning the hero under the sections below it.
- Choosing a different station.
- Adopting the strip on the station pages, and the tide sibling it needs. That is the next spec, written once this is running on a preview URL and has been looked at.
